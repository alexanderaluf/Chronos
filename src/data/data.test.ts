/// <reference types="node" />
/**
 * Integration tests for the data layer: migrations, repositories and reports
 * against a real (in-memory) SQLite database. Run with `npm test`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadPeriodReport, loadYearReport } from "./reports/period-report";
import { createAdjustment } from "./repositories/adjustments-repository";
import { listJobs, updateJob } from "./repositories/jobs-repository";
import { createPaidDay } from "./repositories/paid-days-repository";
import { createPayComponent, listPayComponents } from "./repositories/pay-components-repository";
import { clearPlannedShift, getNextPlannedShift, savePlannedShift } from "./repositories/planned-shifts-repository";
import { getSettings, updateSettings } from "./repositories/settings-repository";
import { createShiftTemplate, listShiftTemplates } from "./repositories/shift-templates-repository";
import { clockIn, clockOut, createShift, deleteShift, getOpenShift, restoreShift } from "./repositories/shifts-repository";
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
