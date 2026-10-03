/// <reference types="node" />
/**
 * Integration tests for the data layer: migrations, repositories and reports
 * against a real (in-memory) SQLite database. Run with `npm test`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readFileSync } from "node:fs";
import { normalizeHebcalResponse, isPremiumHoliday, hebcalUrl, fetchHolidayYear } from "./holidays/hebcal-client";
import { ensureHolidayDataForRange } from "./holidays/holiday-service";
import { getHolidayYearCache, saveHolidayYearCache } from "./repositories/holiday-cache-repository";
import { DEFAULT_HOLIDAY_PAY_SETTINGS, normalizeHolidayPaySettings } from "../domain/holidays/holiday-settings";
import { createHolidayWindows } from "../domain/holidays/holiday-windows";
import { israelWallTime } from "../domain/holidays/zoned-time";
import type { HolidayCalendar } from "../domain/holidays/premium-intervals";
import { loadPeriodReport, loadYearReport } from "./reports/period-report";
import { createAdjustment } from "./repositories/adjustments-repository";
import { DEFAULT_SALARY_AGREEMENT } from "../domain/pay/salary-agreement";
import { listJobs, updateJob } from "./repositories/jobs-repository";
import { createPaidDay } from "./repositories/paid-days-repository";
import { createPayComponent, listPayComponents } from "./repositories/pay-components-repository";
import { clearPlannedShift, getNextPlannedShift, savePlannedShift } from "./repositories/planned-shifts-repository";
import { getSettings, updateSettings } from "./repositories/settings-repository";
import { createShiftTemplate, listShiftTemplates } from "./repositories/shift-templates-repository";
import { clockIn, clockOut, createShift, deleteShift, getOpenShift, getShift, restoreShift, saveHolidayPaySettings, saveSalarySettings, updateShift } from "./repositories/shifts-repository";
import { getActiveTaxProfile } from "./repositories/tax-profiles-repository";
import { createTestDatabase, migrateTestDatabase } from "./testing/node-sqlite-database";

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe("migrations", () => {
  it("moves v1 travel and pension into pay components and upgrades the untouched tax profile", async () => {
    const db = await createTestDatabase(1);
    await db.execAsync("UPDATE jobs SET travel_per_day_minor = 1100");
    await migrateTestDatabase(db, 1, 2);

    const components = await listPayComponents(db);
    assert.deepEqual(
      components.map((c) => [c.kind, c.name, c.calculation, c.amount, c.rateBp]).sort(),
      [
        ["addition", "Travel", "perWorkDay", 1100, 0],
        ["deduction", "Pension fund", "percentOfGross", 0, 600],
      ],
    );
    const profile = await getActiveTaxProfile(db);
    assert.equal(profile.taxYear, 2026);
    assert.equal(profile.rules.insuranceReducedThreshold, 770_300);
  });

  it("seeds a usable fresh install", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    assert.equal((await getSettings(db)).defaultJobId, job.id);
    assert.deepEqual((await listPayComponents(db)).map((c) => c.name), ["Pension fund"]);
  });
});

describe("shifts", () => {
  it("snapshots the rate and enforces time rules", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    await updateJob(db, job.id, { hourlyRate: 4_263 });

    const shift = await createShift(db, {
      jobId: job.id,
      startAt: local(2026, 9, 2, 7),
      endAt: local(2026, 9, 2, 15),
      timeZone: "Asia/Jerusalem",
      label: "Morning",
    });
    assert.equal(shift.hourlyRate, 4_263);
    await updateJob(db, job.id, { hourlyRate: 5_000 });
    assert.equal((await loadPeriodReport(db, "2026-09")).shifts[0].shift.hourlyRate, 4_263, "history is kept");

    await assert.rejects(
      createShift(db, { jobId: job.id, startAt: local(2026, 9, 2, 14), endAt: local(2026, 9, 2, 20), timeZone: "UTC" }),
      /overlaps/,
    );
    await assert.rejects(
      createShift(db, { jobId: job.id, startAt: local(2026, 9, 3, 14), endAt: local(2026, 9, 3, 10), timeZone: "UTC" }),
      /end after/,
    );
    await deleteShift(db, shift.id);
    assert.equal((await loadPeriodReport(db, "2026-09")).shiftCount, 0);
    await restoreShift(db, shift.id);
    assert.equal((await loadPeriodReport(db, "2026-09")).shiftCount, 1);
  });

  it("copies the global bonus onto new shifts, and lets a shift override it", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    await updateJob(db, job.id, { hourlyRate: 4_000, defaultShiftBonus: 2_500 });
    const usesGlobal = await createShift(db, {
      jobId: job.id,
      startAt: local(2026, 9, 2, 7),
      endAt: local(2026, 9, 2, 15),
      timeZone: "Asia/Jerusalem",
    });
    const custom = await createShift(db, {
      jobId: job.id,
      startAt: local(2026, 9, 3, 7),
      endAt: local(2026, 9, 3, 15),
      timeZone: "Asia/Jerusalem",
      hourlyRate: 5_000,
      bonus: 0,
    });
    assert.deepEqual([usesGlobal.hourlyRate, usesGlobal.bonus], [4_000, 2_500]);
    assert.deepEqual([custom.hourlyRate, custom.bonus], [5_000, 0]);
  });

  it("allows only one running shift", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    await clockIn(db, job.id, "Asia/Jerusalem", local(2026, 9, 10, 8));
    await assert.rejects(clockIn(db, job.id, "Asia/Jerusalem", local(2026, 9, 10, 9)), /already clocked in/);
    await clockOut(db, local(2026, 9, 10, 16, 30));
    assert.equal(await getOpenShift(db), null);
  });
});

describe("monthly report", () => {
  it("combines shifts, paid days, components, one-off items and personal status", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    await updateJob(db, job.id, { hourlyRate: 4_263 });
    await createShift(db, { jobId: job.id, startAt: local(2026, 9, 2, 7), endAt: local(2026, 9, 2, 15), timeZone: "Asia/Jerusalem" });
    await createShift(db, { jobId: job.id, startAt: local(2026, 9, 3, 22), endAt: local(2026, 9, 4, 6), timeZone: "Asia/Jerusalem" });
    await createPaidDay(db, { jobId: job.id, date: "2026-09-15", kind: "vacation", minutes: 480, rateBp: 10_000 });
    await createPayComponent(db, { kind: "addition", name: "Travel", calculation: "perWorkDay", amount: 1_100, rateBp: 0, isTaxable: true, isActive: true });
    await createPayComponent(db, { kind: "deduction", name: "Study fund", calculation: "percentOfGross", amount: 0, rateBp: 250, isTaxable: false, isActive: true });
    await createAdjustment(db, { jobId: null, periodKey: "2026-09", kind: "bonus", label: "Holiday gift", amount: 50_000, isTaxable: true });
    const settings = await getSettings(db);
    await updateSettings(db, { personalInfo: { ...settings.personalInfo, gender: "female" } });

    const report = await loadPeriodReport(db, "2026-09");
    assert.equal(report.shiftCount, 2);
    assert.equal(report.daysWorked, 2);
    assert.equal(report.paidDays.length, 1);
    assert.equal(report.payslip.creditPoints.totalHundredths, 275);
    assert.equal(report.payslip.earnings.find((line) => line.label === "Travel")?.amount, 2_200);
    assert.ok(report.payslip.earnings.some((line) => line.label === "Holiday gift"));
    assert.deepEqual(report.payslip.voluntaryLines.map((line) => line.label), ["Pension fund", "Study fund"]);
    assert.equal(report.payslip.net, report.payslip.gross - report.payslip.totalDeductions);

    const year = await loadYearReport(db, 2026);
    assert.equal(year[8].net, report.payslip.net);
    assert.equal(year[9].net, 0);
  });
});

describe("other records", () => {
  it("stores fixed shifts, settings and the weekly schedule", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    await createShiftTemplate(db, { jobId: job.id, name: "Night", color: "#A79BE0", startMinute: 1320, endMinute: 360, breakMinutes: 0, hourlyRate: null, bonus: 0 });
    await assert.rejects(
      createShiftTemplate(db, { jobId: job.id, name: "Broken", color: "#A79BE0", startMinute: 600, endMinute: null, breakMinutes: 0, hourlyRate: null, bonus: 0 }),
      /both a start and an end/,
    );
    assert.equal((await listShiftTemplates(db)).length, 1);

    await updateSettings(db, { roundingMinutes: 5, calendarDirection: "rtl" });
    const settings = await getSettings(db);
    assert.equal(settings.roundingMinutes, 5);
    assert.equal(settings.calendarDirection, "rtl");

    await savePlannedShift(db, { date: "2026-10-05", startMinute: 420, endMinute: 900, note: null });
    assert.equal((await getNextPlannedShift(db, "2026-10-01"))?.startMinute, 420);
    await clearPlannedShift(db, "2026-10-05");
    assert.equal(await getNextPlannedShift(db, "2026-10-01"), null);
  });
});


describe("Hebcal and holiday cache", () => {
  const wall = (date: string, hour: number) => israelWallTime(date, hour * 60);
  const settings = { ...DEFAULT_HOLIDAY_PAY_SETTINGS, windowMode: "custom" as const, customEndMinute: 1140 };
  const calendar: HolidayCalendar = { events: [{ id: "holiday", name: "Shavuot", holidayDate: "2027-06-11", kind: "yomTov", source: "hebcal" }], times: [] };
  const start = wall("2027-06-10", 14), end = wall("2027-06-10", 22);

  it("recognizes only Yom Tov and Independence Day, including spelling variants", () => {
    for (const title of ["Yom HaAtzma'ut", "Yom HaAtzma’ut", "Yom HaAtzmaut"]) {
      assert.equal(isPremiumHoliday({ title, date: "2027-05-12", category: "holiday" }), true);
    }
    assert.equal(isPremiumHoliday({ title: "different", hebrew: "יום העצמאות", date: "2027-05-12", category: "holiday" }), true);
    for (const title of ["Chanukah", "Purim", "Lag BaOmer", "Yom HaShoah", "Yom HaZikaron", "Pesach II (CH''M)", "Tzom Gedaliah", "Rosh Chodesh"]) {
      assert.equal(isPremiumHoliday({ title, date: "2027-05-12", category: "holiday" }), false);
    }
    assert.equal(isPremiumHoliday({ title: "Pesach", date: "2027-05-12", category: "holiday", yomtov: true }), true);
    assert.equal(isPremiumHoliday({ title: "Pesach", date: "2027-05-12", category: "other", yomtov: true }), false);
  });
  it("requests the Israel schedule, modern holidays, and selected location only", () => {
    const params = new URL(hebcalUrl(2035, "telAviv")).searchParams;
    for (const key of ["i", "maj", "mod", "c", "M"]) assert.equal(params.get(key), "on");
    assert.equal(params.get("year"), "2035"); assert.equal(params.get("tzid"), "Asia/Jerusalem");
    assert.equal(params.has("yto"), false);
    assert.equal(new URL(hebcalUrl(2035, null)).searchParams.has("latitude"), false);
  });
  it("normalizes the live 2026 fixture and builds complete automatic windows", () => {
    // Public API snapshot, Tel Aviv / Israel, fetched 2026-10-02. Data: Hebcal.com.
    const result = normalizeHebcalResponse(JSON.parse(readFileSync(new URL("./testing/hebcal-2026-tel-aviv.json", import.meta.url), "utf8")));
    assert.equal(result.events.length, 9);
    assert.equal(result.events.filter((event) => event.kind === "independence").length, 1);
    const windows = createHolidayWindows(result, { ...settings, windowMode: "automatic", workCity: "telAviv" });
    assert.equal(windows.missingTimes, false); assert.equal(windows.intervals.length, 8);
    const roshHashana = windows.intervals.find((item) => item.holidayIds.length === 2)!;
    assert.equal(roshHashana.startsAt.slice(0, 10), "2026-09-11");
    assert.equal(roshHashana.endsAt.slice(0, 10), "2026-09-13");
  });
  it("rejects empty, malformed and incomplete API responses", async () => {
    for (const value of [null, {}, { items: [] }, { items: [{}] }, { items: [{ title: "Pesach", date: "2027-02-30", category: "holiday", yomtov: true }] }]) {
      assert.throws(() => normalizeHebcalResponse(value));
    }
    await assert.rejects(fetchHolidayYear(2027, null, async () => new Response("{}", { status: 503 })), /503/);
    await assert.rejects(fetchHolidayYear(2027, null, async () => new Response("not json")));
    await assert.rejects(fetchHolidayYear(2027, null, async () => { throw new Error("Network unavailable"); }));
  });
  it("persists yearly caches and serves fresh data with no network request", async () => {
    const db = await createTestDatabase();
    await saveHolidayYearCache(db, "v1:2027:dates", 2027, calendar);
    assert.deepEqual((await getHolidayYearCache(db, "v1:2027:dates"))?.calendar, calendar);
    let calls = 0;
    const result = await ensureHolidayDataForRange(db, start, end, settings, async () => { calls++; throw new Error("offline"); });
    assert.equal(calls, 0); assert.equal(result.status, "ready"); assert.equal(result.intervals.length, 1);
  });
  it("uses stale cached data when offline", async () => {
    const db = await createTestDatabase();
    await saveHolidayYearCache(db, "v1:2027:dates", 2027, calendar);
    await db.runAsync("UPDATE holiday_year_cache SET fetched_at = ?", "2020-01-01T00:00:00Z");
    let calls = 0;
    const loader = async () => { calls++; throw new Error("offline"); };
    const result = await ensureHolidayDataForRange(db, start, end, settings, loader);
    assert.equal(result.status, "ready"); assert.equal(result.intervals.length, 1);
    await ensureHolidayDataForRange(db, start, end, settings, loader);
    assert.equal(calls, 1, "failed requests back off instead of repeating each render");
  });
  it("fails gracefully without cached data and invents no premium", async () => {
    const db = await createTestDatabase();
    const result = await ensureHolidayDataForRange(db, start, end, settings, async () => { throw new Error("offline"); });
    assert.equal(result.status, "unavailable"); assert.deepEqual(result.intervals, []);
    assert.equal((await ensureHolidayDataForRange(db, start, end, DEFAULT_HOLIDAY_PAY_SETTINGS)).status, "needsLocation");
    assert.equal((await ensureHolidayDataForRange(db, start, end, { ...settings, enabled: false })).status, "disabled");
  });
  it("deduplicates concurrent yearly requests and separates work cities", async () => {
    const db = await createTestDatabase();
    let calls = 0;
    const loader = async () => { calls++; return calendar; };
    await Promise.all(Array.from({ length: 5 }, () => ensureHolidayDataForRange(db, start, end, settings, loader)));
    assert.equal(calls, 1);
    await ensureHolidayDataForRange(db, start, end, { ...settings, windowMode: "automatic", workCity: "telAviv" }, loader);
    await ensureHolidayDataForRange(db, start, end, { ...settings, windowMode: "automatic", workCity: "jerusalem" }, loader);
    assert.equal(calls, 3);
  });
  it("fetches both years for overnight year transitions and any future year", async () => {
    const db = await createTestDatabase();
    const years: number[] = [];
    await ensureHolidayDataForRange(db, wall("2031-12-31", 22), wall("2032-01-01", 6), settings, async (year) => { years.push(year); return calendar; });
    assert.deepEqual(years.sort(), [2031, 2032]);
  });
  it("can switch from automatic to custom hours offline using already-downloaded dates", async () => {
    const db = await createTestDatabase();
    await ensureHolidayDataForRange(db, start, end, { ...settings, windowMode: "automatic", workCity: "telAviv" }, async () => calendar);
    let calls = 0;
    const result = await ensureHolidayDataForRange(db, start, end, settings, async () => { calls++; throw new Error("offline"); });
    assert.equal(calls, 0);
    assert.equal(result.status, "ready");
    assert.equal(result.intervals[0].startsAt, wall("2027-06-10", 18).toISOString());
  });
  it("ignores corrupt cache data and does not calculate invented holidays", async () => {
    const db = await createTestDatabase();
    await saveHolidayYearCache(db, "v1:2027:dates", 2027, calendar);
    for (const json of ["broken", '{"events":[{}],"times":[]}', '{"events":[],"times":[]}']) {
      await db.runAsync("UPDATE holiday_year_cache SET calendar_json = ?", json);
      assert.equal(await getHolidayYearCache(db, "v1:2027:dates"), null);
    }
    const result = await ensureHolidayDataForRange(db, start, end, settings, async () => { throw new Error("offline"); });
    assert.equal(result.status, "unavailable");
    assert.deepEqual(result.intervals, []);
  });
  it("normalizes persisted settings and fixes the premium at 150%", () => {
    assert.deepEqual(normalizeHolidayPaySettings(null), DEFAULT_HOLIDAY_PAY_SETTINGS);
    const normalized = normalizeHolidayPaySettings({ enabled: false, rateBp: 99999, timezone: "UTC", customStartMinute: -1, customEndMinute: 1140, workCity: "unknown" });
    assert.equal(normalized.rateBp, 15000); assert.equal(normalized.timezone, "Asia/Jerusalem");
    assert.equal(normalized.customStartMinute, 1080); assert.equal(normalized.customEndMinute, 1140); assert.equal(normalized.workCity, null);
  });
  it("keeps each shift's holiday settings unless the user applies a change to this month", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    await updateJob(db, job.id, { hourlyRate: 5000, payRules: { ...job.payRules, overtimeEnabled: false, restDays: [] } });
    await saveHolidayYearCache(db, "v1:2027:dates", 2027, calendar);
    await updateSettings(db, { holidayPay: settings });
    const shift = await createShift(db, { jobId: job.id, startAt: start, endAt: end, timeZone: "Asia/Jerusalem" });
    assert.deepEqual(shift.holidayPay, normalizeHolidayPaySettings(settings));
    const before = await loadPeriodReport(db, "2027-06");
    assert.equal(before.shifts[0].pay.total, 50000);
    assert.equal(before.payslip.earnings.find((line) => line.key === "holidayPremium")?.amount, 10000);

    // "Only new shifts": the saved shift keeps its settings; a new one uses the change.
    const june = wall("2027-06-15", 12);
    await saveHolidayPaySettings(db, { ...settings, customStartMinute: 1095 }, "newShiftsOnly", june);
    assert.equal((await loadPeriodReport(db, "2027-06")).shifts[0].pay.total, 50000);
    const later = await createShift(db, { jobId: job.id, startAt: wall("2027-06-20", 8), endAt: wall("2027-06-20", 9), timeZone: "Asia/Jerusalem" });
    assert.equal(later.holidayPay?.customStartMinute, 1095);

    // "All shifts this month": the earlier shift is recalculated with the change.
    await saveHolidayPaySettings(db, { ...settings, customStartMinute: 1095 }, "currentPeriod", june);
    assert.equal((await loadPeriodReport(db, "2027-06")).shifts[0].pay.total, 49375);
    await saveHolidayPaySettings(db, { ...settings, enabled: false }, "currentPeriod", june);
    assert.equal((await loadPeriodReport(db, "2027-06")).shifts[0].pay.total, 40000);
    // Saving while in a later month leaves June untouched.
    await saveHolidayPaySettings(db, settings, "currentPeriod", wall("2027-07-15", 12));
    assert.equal((await loadPeriodReport(db, "2027-06")).shifts[0].pay.total, 40000);
  });
});


describe("salary agreement storage", () => {
  it("snapshots supplements for new shifts and keeps past settings when the job changes", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    await updateJob(db, job.id, { hourlyRate: 3900, payRules: { ...job.payRules, salaryAgreement: { ...DEFAULT_SALARY_AGREEMENT, enabled: true } } });
    const first = await createShift(db, { jobId: job.id, startAt: local(2026, 10, 4, 8), endAt: local(2026, 10, 4, 9), timeZone: "Asia/Jerusalem" });
    await updateJob(db, job.id, { payRules: { ...job.payRules, salaryAgreement: { ...DEFAULT_SALARY_AGREEMENT, enabled: true, rateBp: 1000 } } });
    await createShift(db, { jobId: job.id, startAt: local(2026, 10, 5, 8), endAt: local(2026, 10, 5, 9), timeZone: "Asia/Jerusalem" });
    await updateShift(db, first.id, { note: "Edited after agreement change" });
    const report = await loadPeriodReport(db, "2026-10");
    assert.deepEqual(report.shifts.map((item) => item.pay.total), [4251, 4290]);
    assert.equal(report.payslip.earnings.find((line) => line.key === "agreementPay")?.amount, 741);
  });
  it("migrates old shifts without retroactively adding supplements", async () => {
    const db = await createTestDatabase(4);
    const [job] = await listJobs(db);
    await db.runAsync("INSERT INTO shifts (id, job_id, start_at, end_at, time_zone, hourly_rate_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", "legacy", job.id, local(2026, 10, 4, 8).toISOString(), local(2026, 10, 4, 9).toISOString(), "Asia/Jerusalem", 3900, "2026-10-04", "2026-10-04");
    await migrateTestDatabase(db, 4, 5);
    await updateJob(db, job.id, { payRules: { ...job.payRules, salaryAgreement: { ...DEFAULT_SALARY_AGREEMENT, enabled: true } } });
    assert.equal((await loadPeriodReport(db, "2026-10")).shifts[0].pay.total, 3900);
  });
  it("adds a monthly supplement once even without recorded shifts", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    await updateJob(db, job.id, { payType: "monthly", monthlySalary: 1000000, payRules: { ...job.payRules, salaryAgreement: { ...DEFAULT_SALARY_AGREEMENT, enabled: true } } });
    const report = await loadPeriodReport(db, "2026-10");
    assert.equal(report.payslip.earnings.find((line) => line.key === "agreementPay")?.amount, 90000);
    assert.equal(report.payslip.gross, 1090000);
  });
});


describe("applying salary settings to shifts", () => {
  const october = local(2026, 10, 15, 12);

  async function setUp() {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    await updateJob(db, job.id, { hourlyRate: 4_000, defaultShiftBonus: 1_000, payRules: { ...job.payRules, overtimeEnabled: false, restDays: [] } });
    const shift = (day: Date, extra: { hourlyRate?: number } = {}) =>
      createShift(db, { jobId: job.id, startAt: day, endAt: new Date(day.getTime() + 8 * 3_600_000), timeZone: "Asia/Jerusalem", breakMinutes: 30, ...extra });
    const september = await shift(local(2026, 9, 20, 8));
    const usesGlobal = await shift(local(2026, 10, 2, 8));
    const custom = await shift(local(2026, 10, 3, 8), { hourlyRate: 6_000 });
    return { db, job: (await listJobs(db))[0], september, usesGlobal, custom };
  }

  it("updates every shift of this pay period with the changed values only", async () => {
    const { db, job, september, usesGlobal, custom } = await setUp();
    await saveSalarySettings(db, job.id, { hourlyRate: 5_000, payRules: { ...job.payRules, unpaidBreaks: false } }, "currentPeriod", october);

    for (const shift of [usesGlobal, custom]) {
      const saved = (await getShift(db, shift.id))!;
      assert.equal(saved.hourlyRate, 5_000, "the new rate replaces global and custom rates this month");
      assert.equal(saved.bonus, 1_000, "an unchanged bonus is left alone");
      assert.equal(saved.unpaidBreaks, false);
    }
    const old = (await getShift(db, september.id))!;
    assert.deepEqual([old.hourlyRate, old.unpaidBreaks], [4_000, true], "earlier months never change");
    // 8 h paid (the break is now paid) x 50.00 + 10.00 bonus.
    assert.deepEqual((await loadPeriodReport(db, "2026-10")).shifts.map((item) => item.pay.total), [41_000, 41_000]);
    // 7.5 h x 40.00 + 10.00 bonus: September keeps its rate and its unpaid break.
    assert.equal((await loadPeriodReport(db, "2026-09")).shifts[0].pay.total, 31_000);
  });

  it("keeps every existing shift when the change is for new shifts only", async () => {
    const { db, job, usesGlobal } = await setUp();
    await saveSalarySettings(db, job.id, { hourlyRate: 5_000, defaultShiftBonus: 0, payRules: { ...job.payRules, unpaidBreaks: false } }, "newShiftsOnly", october);

    assert.deepEqual((await loadPeriodReport(db, "2026-10")).shifts.map((item) => item.pay.total), [31_000, 46_000]);
    assert.equal((await getShift(db, usesGlobal.id))!.updatedAt, usesGlobal.updatedAt, "the record is not rewritten");
    const next = await createShift(db, { jobId: job.id, startAt: local(2026, 10, 4, 8), endAt: local(2026, 10, 4, 16), timeZone: "Asia/Jerusalem", breakMinutes: 30 });
    assert.deepEqual([next.hourlyRate, next.bonus, next.unpaidBreaks], [5_000, 0, false]);
  });

  it("migrates old shifts with the break and holiday settings they were calculated with", async () => {
    const db = await createTestDatabase(5);
    const [job] = await listJobs(db);
    await updateJob(db, job.id, { payRules: { ...job.payRules, unpaidBreaks: false } });
    await updateSettings(db, { holidayPay: { ...DEFAULT_HOLIDAY_PAY_SETTINGS, enabled: false } });
    await db.runAsync("INSERT INTO shifts (id, job_id, start_at, end_at, time_zone, hourly_rate_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", "legacy", job.id, local(2026, 10, 4, 8).toISOString(), local(2026, 10, 4, 9).toISOString(), "Asia/Jerusalem", 3900, "2026-10-04", "2026-10-04");
    await migrateTestDatabase(db, 5, 6);
    const legacy = (await getShift(db, "legacy"))!;
    assert.equal(legacy.unpaidBreaks, false);
    assert.equal(legacy.holidayPay?.enabled, false);
  });
});

describe("night-shift toggle persistence", () => {
  it("keeps the disabled state and configured night values when saving a job", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    await updateJob(db, job.id, { payRules: { ...job.payRules, nightShiftsEnabled: false, nightPremiumRateBp: 12500, nightShiftThresholdMinutes: 390 } });
    const [saved] = await listJobs(db);
    assert.equal(saved.payRules.nightShiftsEnabled, false);
    assert.equal(saved.payRules.nightPremiumRateBp, 12500);
    assert.equal(saved.payRules.nightShiftThresholdMinutes, 390);
    await updateJob(db, job.id, { payRules: { ...saved.payRules, nightShiftsEnabled: true } });
    assert.equal((await listJobs(db))[0].payRules.nightPremiumRateBp, 12500);
  });
});


describe("weekly Shabbat settings", () => {
  it("persists the window and uses it in reports without changing shift snapshots", async () => {
    const db = await createTestDatabase();
    const [job] = await listJobs(db);
    const window = { startDay: 5, startMinute: 1080, endDay: 0, endMinute: 180 };
    const updated = await updateJob(db, job.id, { hourlyRate: 6000, payRules: { ...job.payRules, restWindow: window } });
    assert.deepEqual(updated.payRules.restWindow, window);
    assert.deepEqual((await listJobs(db))[0].payRules.restWindow, window);
    const shift = await createShift(db, { jobId: job.id, startAt: local(2026, 10, 2, 16), endAt: local(2026, 10, 2, 20), timeZone: "Asia/Jerusalem" });
    const report = await loadPeriodReport(db, "2026-10");
    assert.equal(report.shifts.find(item => item.shift.id === shift.id)?.pay.total, 30000);
    await updateJob(db, job.id, { payRules: { ...updated.payRules, restWindow: null } });
    const reverted = await loadPeriodReport(db, "2026-10");
    assert.equal(reverted.shifts.find(item => item.shift.id === shift.id)?.pay.total, 24000);
    assert.equal(reverted.shifts.find(item => item.shift.id === shift.id)?.shift.hourlyRate, 6000);
  });
});
