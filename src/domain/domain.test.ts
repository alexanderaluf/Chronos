/// <reference types="node" />
/** Unit tests for the pure calculation layer. Run with `npm test`. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_HOLIDAY_PAY_SETTINGS } from "./holidays/holiday-settings";
import { createHolidayWindows } from "./holidays/holiday-windows";
import { mergePremiumIntervals, splitShiftByPremiumIntervals, type HolidayCalendar } from "./holidays/premium-intervals";
import { calendarDay, holidayYearsForRange, israelWallTime } from "./holidays/zoned-time";
import type { Job, PaidDay, PayComponent, Shift } from "./entities";
import { divideRounded, parseMajorToMinor, payForMinutes } from "./money/money";
import { componentAmount } from "./pay/pay-components";
import { ISRAEL_DEFAULT_PAY_RULES, normalizePayRules } from "./pay/pay-rules";
import { computePayslip } from "./pay/payslip";
import { summarizePeriod } from "./pay/period-summary";
import { quickSalaryEstimate } from "./pay/quick-calculator";
import { calculateShiftPay } from "./pay/shift-pay";
import { calculateAutoCreditPoints } from "./tax/credit-points";
import { calculateMandatoryDeductions, calculateProgressiveTax } from "./tax/mandatory-deductions";
import { ISRAEL_2026_TAX_RULES, normalizeTaxRules } from "./tax/tax-rules";
import { DEFAULT_PERSONAL_INFO, DEFAULT_TAX_STATUS } from "./tax/tax-status";
import {
  formatMinuteOfDay,
  getPayPeriod,
  getPayPeriodForDate,
  minutesBetween,
  minutesInDailyWindow,
  roundToStep,
  shiftRangeFromClockTimes,
  toLocalDateKey,
} from "./time/time";

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const NOW = "2026-10-01T00:00:00.000Z";

function component(partial: Partial<PayComponent> & Pick<PayComponent, "kind" | "calculation">): PayComponent {
  return {
    id: partial.name ?? "component",
    name: "Component",
    amount: 0,
    rateBp: 0,
    isTaxable: true,
    isActive: true,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...partial,
  };
}

const POINTS_225 = { totalHundredths: 225, lines: [] };

describe("money", () => {
  it("rounds half away from zero with integer math", () => {
    assert.equal(divideRounded(5, 2), 3);
    assert.equal(divideRounded(-5, 2), -3);
    assert.equal(divideRounded(4, 3), 1);
  });

  it("pays minutes at a multiplier", () => {
    // ₪40/h × 84 min × 125% = ₪70.00
    assert.equal(payForMinutes(4_000, 84, 12_500), 7_000);
  });

  it("parses user input without floats", () => {
    assert.equal(parseMajorToMinor("45.5"), 4_550);
    assert.equal(parseMajorToMinor("45,05"), 4_505);
    assert.equal(parseMajorToMinor("0.1"), 10);
    assert.equal(parseMajorToMinor("1.234"), null);
    assert.equal(parseMajorToMinor("abc"), null);
  });
});

describe("time", () => {
  it("measures real elapsed time across the October DST change", () => {
    // Israel DST ends 25 Oct 2026 at 02:00 → 01:00, so 22:00 → 06:00 is 9 hours.
    assert.equal(minutesBetween(local(2026, 10, 24, 22), local(2026, 10, 25, 6)), 540);
  });

  it("counts night-window minutes across midnight", () => {
    assert.equal(minutesInDailyWindow(local(2026, 3, 1, 20), local(2026, 3, 2, 4), 1320, 360), 360);
    assert.equal(minutesInDailyWindow(local(2026, 3, 1, 8), local(2026, 3, 1, 17), 1320, 360), 0);
  });

  it("builds pay periods with a custom start day", () => {
    const period = getPayPeriod("2026-10", 25);
    assert.equal(toLocalDateKey(period.start), "2026-10-25");
    assert.equal(toLocalDateKey(period.end), "2026-11-25");
    assert.equal(getPayPeriodForDate(local(2026, 10, 10), 25).key, "2026-09");
    assert.equal(getPayPeriodForDate(local(2026, 10, 10), 1).key, "2026-10");
  });

  it("rounds to 5 minutes and handles shifts ending after midnight", () => {
    assert.equal(roundToStep(local(2026, 10, 1, 7, 58), 5).getMinutes(), 0);
    assert.equal(roundToStep(local(2026, 10, 1, 7, 52), 5).getMinutes(), 50);
    const range = shiftRangeFromClockTimes(local(2026, 10, 1), 22 * 60, 6 * 60);
    assert.equal(toLocalDateKey(range.end), "2026-10-02");
    assert.equal(minutesBetween(range.start, range.end), 480);
    assert.equal(formatMinuteOfDay(450), "07:30");
  });
});

describe("shift pay", () => {
  const base = {
    breakMinutes: 0,
    hourlyRate: 4_000,
    payType: "hourly" as const,
    isHoliday: false,
    bonus: 0,
    tips: 0,
    rules: ISRAEL_DEFAULT_PAY_RULES,
  };

  it("splits a long weekday shift into regular and overtime", () => {
    // Thursday 08:00–18:00 = 600 min: 516 regular + 84 at 125%.
    const pay = calculateShiftPay({ ...base, startAt: local(2026, 10, 1, 8), endAt: local(2026, 10, 1, 18) });
    assert.equal(pay.regularMinutes, 516);
    assert.equal(pay.overtimeMinutes, 84);
    assert.equal(pay.basePay, 34_400);
    assert.equal(pay.overtimePay, 7_000);
    assert.equal(pay.total, 41_400);
  });

  it("subtracts the unpaid break, or keeps it when breaks are paid", () => {
    const shift = { ...base, breakMinutes: 30, startAt: local(2026, 10, 1, 8), endAt: local(2026, 10, 1, 16) };
    assert.equal(calculateShiftPay(shift).workedMinutes, 450);
    const paidBreaks = calculateShiftPay({ ...shift, rules: { ...ISRAEL_DEFAULT_PAY_RULES, unpaidBreaks: false } });
    assert.equal(paidBreaks.workedMinutes, 480);
  });

  it("pays everything at 100% when overtime is disabled", () => {
    const pay = calculateShiftPay({
      ...base,
      startAt: local(2026, 10, 1, 8),
      endAt: local(2026, 10, 1, 18),
      rules: { ...ISRAEL_DEFAULT_PAY_RULES, overtimeEnabled: false },
    });
    assert.equal(pay.overtimeMinutes, 0);
    assert.equal(pay.total, 40_000);
  });

  it("uses the 7-hour threshold for a night shift and pays a night premium", () => {
    const pay = calculateShiftPay({
      ...base,
      startAt: local(2026, 10, 1, 22),
      endAt: local(2026, 10, 2, 7),
      rules: { ...ISRAEL_DEFAULT_PAY_RULES, nightPremiumRateBp: 12_500 },
    });
    assert.equal(pay.isNightShift, true);
    assert.equal(pay.regularMinutes, 420);
    assert.equal(pay.segments.find((s) => s.kind === "overtimeTier1")?.minutes, 120);
    assert.equal(pay.nightPremium, payForMinutes(4_000, 480, 2_500)); // 8 night hours × 25%
  });

  it("pays rest-day rates on Saturday", () => {
    const pay = calculateShiftPay({ ...base, startAt: local(2026, 10, 3, 8), endAt: local(2026, 10, 3, 16) });
    assert.equal(pay.isRestDay, true);
    assert.equal(pay.basePay, 48_000); // 8 h × ₪40 × 150%
  });

  it("gives monthly employees only the premium on regular hours", () => {
    const pay = calculateShiftPay({
      ...base,
      payType: "monthly",
      hourlyRate: 5_495,
      startAt: local(2026, 10, 1, 8),
      endAt: local(2026, 10, 1, 18),
    });
    assert.equal(pay.basePay, 0);
    assert.equal(pay.overtimePay, payForMinutes(5_495, 84, 12_500));
  });

  it("fills missing or invalid stored rules from the defaults", () => {
    const rules = normalizePayRules({ overtimeTier1RateBp: 13_000, restDays: [5, 6, 9], nightWindowStartMinute: "x" });
    assert.equal(rules.overtimeTier1RateBp, 13_000);
    assert.deepEqual(rules.restDays, [5, 6]);
    assert.equal(rules.nightWindowStartMinute, ISRAEL_DEFAULT_PAY_RULES.nightWindowStartMinute);
    assert.equal(rules.overtimeEnabled, true);
  });
});

describe("tax", () => {
  it("applies progressive brackets", () => {
    assert.equal(calculateProgressiveTax(1_000_000, ISRAEL_2026_TAX_RULES), 111_960);
  });

  it("reproduces a real September 2026 payslip to the agora", () => {
    // Hourly worker: base ₪8,859.10 + travel ₪225 = gross ₪9,084.10,
    // 2.25 credit points, study fund 2%, pension 5%.
    const payslip = computePayslip({
      baseEarnings: [
        { key: "basePay", label: "Base pay", amount: 885_910 },
        { key: "travel", label: "Travel", amount: 22_500 },
      ],
      daysWorked: 20,
      workedMinutes: 186 * 60,
      components: [
        component({ name: "Study fund", kind: "deduction", calculation: "percentOfGross", rateBp: 200 }),
        component({ name: "Pension", kind: "deduction", calculation: "percentOfGross", rateBp: 500 }),
      ],
      oneOffBonuses: [],
      oneOffDeductions: [],
      taxRules: ISRAEL_2026_TAX_RULES,
      taxStatus: DEFAULT_TAX_STATUS,
      creditPoints: POINTS_225,
    });
    assert.equal(payslip.gross, 908_410);
    assert.equal(payslip.mandatory.incomeTax, 44_687);
    assert.equal(payslip.mandatory.nationalInsurance, 17_679);
    assert.equal(payslip.mandatory.healthInsurance, 32_021);
    assert.deepEqual(
      payslip.voluntaryLines.map((line) => line.amount),
      [18_168, 45_421],
    );
    assert.equal(payslip.net, 750_434);
  });

  it("never produces negative income tax and honors exemptions", () => {
    const low = calculateMandatoryDeductions({
      taxableIncome: 300_000,
      creditPointsHundredths: 225,
      rules: ISRAEL_2026_TAX_RULES,
      status: { ...DEFAULT_TAX_STATUS, nationalInsuranceExempt: true },
    });
    assert.equal(low.incomeTax, 0);
    assert.equal(low.nationalInsurance, 0);
    assert.ok(low.healthInsurance > 0);
  });

  it("taxes a taxable benefit without paying it out", () => {
    const payslip = computePayslip({
      baseEarnings: [{ key: "basePay", label: "Base pay", amount: 1_000_000 }],
      daysWorked: 0,
      workedMinutes: 0,
      components: [],
      oneOffBonuses: [],
      oneOffDeductions: [],
      taxRules: ISRAEL_2026_TAX_RULES,
      taxStatus: { ...DEFAULT_TAX_STATUS, taxableBenefitMonthly: 200_000 },
      creditPoints: POINTS_225,
    });
    assert.equal(payslip.gross, 1_000_000);
    assert.equal(payslip.taxableIncome, 1_200_000);
  });

  it("calculates credit points from personal info", () => {
    const result = calculateAutoCreditPoints(
      { ...DEFAULT_PERSONAL_INFO, gender: "female", childrenBirthDates: ["2026-03-01", "2023-05-10", "2015-01-01"] },
      ISRAEL_2026_TAX_RULES.creditPointRules,
      2026,
    );
    // 2.25 resident + 0.5 woman + 1.5 (age 0) + 2.5 (age 3) + 1 (age 11)
    assert.equal(result.totalHundredths, 775);
  });

  it("normalizes user-edited brackets and migrates the v1 rules shape", () => {
    const rules = normalizeTaxRules({
      incomeTaxBrackets: [{ upTo: 2_000, rateBp: 2_000 }, { upTo: 1_000, rateBp: 1_000 }],
      nationalInsurance: { reducedThreshold: 752_200, ceiling: 5_069_500, reducedRateBp: 104, fullRateBp: 700 },
    });
    assert.deepEqual(rules.incomeTaxBrackets, [
      { upTo: 1_000, rateBp: 1_000 },
      { upTo: 2_000, rateBp: 2_000 },
      { upTo: null, rateBp: 2_000 },
    ]);
    assert.equal(rules.insuranceReducedThreshold, 752_200);
    assert.equal(rules.nationalInsuranceEmployee.fullRateBp, 700);
  });
});

describe("pay components", () => {
  it("calculates every component type", () => {
    const base = { daysWorked: 10, workedMinutes: 600, percentBase: 100_000 };
    assert.equal(componentAmount(component({ kind: "addition", calculation: "monthlyFixed", amount: 22_500 }), base), 22_500);
    assert.equal(componentAmount(component({ kind: "addition", calculation: "perWorkDay", amount: 1_100 }), base), 11_000);
    assert.equal(componentAmount(component({ kind: "addition", calculation: "perWorkHour", amount: 500 }), base), 5_000);
    assert.equal(componentAmount(component({ kind: "deduction", calculation: "percentOfGross", rateBp: 600 }), base), 6_000);
  });
});

describe("period summary", () => {
  const job: Job = {
    id: "job-1",
    name: "Cafe",
    color: "#087e8b",
    payType: "hourly",
    hourlyRate: 4_000,
    defaultShiftBonus: 0,
    monthlySalary: 0,
    monthlyHoursDivisor: 182,
    currencyCode: "ILS",
    travelPerDay: 0,
    payRules: ISRAEL_DEFAULT_PAY_RULES,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
  };
  const shift = (id: string, start: Date, end: Date | null, extra: Partial<Shift> = {}): Shift => ({
    id,
    jobId: job.id,
    startAt: start.toISOString(),
    endAt: end?.toISOString() ?? null,
    timeZone: "Asia/Jerusalem",
    breakMinutes: 0,
    hourlyRate: 4_000,
    isHoliday: false,
    bonus: 0,
    tips: 0,
    note: null,
    color: null,
    label: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...extra,
  });
  const vacation: PaidDay = {
    id: "vac",
    jobId: job.id,
    date: "2026-10-05",
    kind: "vacation",
    minutes: 480,
    rateBp: 10_000,
    hourlyRate: 4_000,
    note: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };

  it("totals shifts, paid days, per-day additions and one-off items", () => {
    const summary = summarizePeriod({
      period: getPayPeriod("2026-10"),
      jobs: [job],
      shifts: [
        shift("a", local(2026, 10, 1, 8), local(2026, 10, 1, 12)),
        shift("b", local(2026, 10, 1, 17), local(2026, 10, 1, 21), { tips: 5_000 }),
        shift("open", local(2026, 10, 2, 8), null),
        shift("deleted", local(2026, 10, 3, 8), local(2026, 10, 3, 12), { deletedAt: NOW }),
      ],
      paidDays: [vacation],
      adjustments: [
        {
          id: "meal",
          jobId: null,
          periodKey: "2026-10",
          kind: "deduction",
          label: "Meals",
          amount: 2_000,
          isTaxable: false,
          createdAt: NOW,
          updatedAt: NOW,
          deletedAt: null,
        },
      ],
      components: [component({ name: "Travel", kind: "addition", calculation: "perWorkDay", amount: 1_100 })],
      taxRules: ISRAEL_2026_TAX_RULES,
      taxStatus: DEFAULT_TAX_STATUS,
      creditPoints: POINTS_225,
    });

    assert.equal(summary.shiftCount, 2);
    assert.equal(summary.daysWorked, 1); // the vacation day is not a work day
    assert.equal(summary.workedMinutes, 480);
    assert.equal(summary.paidDayMinutes, 480);
    // 8 h base + 8 h vacation + tips + travel for one day
    assert.equal(summary.payslip.gross, 32_000 + 32_000 + 5_000 + 1_100);
    assert.equal(summary.payslip.voluntaryLines.find((line) => line.label === "Meals")?.amount, 2_000);
    assert.equal(summary.days["2026-10-05"].paidDayCount, 1);
  });

  it("estimates a month in the quick calculator", () => {
    const payslip = quickSalaryEstimate({
      hourlyRate: 4_263,
      regularMinutes: 186 * 60,
      overtimeMinutes: 0,
      overtimeRateBp: 12_500,
      workDays: 0,
      travelPerDay: 0,
      creditPointsHundredths: 225,
      taxRules: ISRAEL_2026_TAX_RULES,
      taxStatus: DEFAULT_TAX_STATUS,
      deductions: [],
    });
    assert.equal(payslip.gross, 4_263 * 186);
  });
});


describe("holiday windows and shift pay", () => {
  const wall = (day: string, hour: number, minute = 0) => israelWallTime(day, hour * 60 + minute);
  const settings = { ...DEFAULT_HOLIDAY_PAY_SETTINGS, windowMode: "custom" as const, customEndMinute: 1140 };
  const calendar: HolidayCalendar = { events: [{ id: "shavuot", name: "Shavuot", holidayDate: "2027-06-11", kind: "yomTov", source: "hebcal" }], times: [
    { date: "2027-06-10", instant: wall("2027-06-10", 18, 15).toISOString(), kind: "candles" },
    { date: "2027-06-11", instant: wall("2027-06-11", 19).toISOString(), kind: "havdalah" },
  ] };
  const intervals = createHolidayWindows(calendar, settings).intervals;
  const base = { breakMinutes: 0, hourlyRate: 5000, payType: "hourly" as const, isHoliday: false, bonus: 0, tips: 0,
    rules: { ...ISRAEL_DEFAULT_PAY_RULES, overtimeEnabled: false, restDays: [] }, holidayIntervals: intervals };
  const pay = (day: string, from: number, to: number) => calculateShiftPay({ ...base, startAt: wall(day, from), endAt: wall(day, to) });

  it("custom 18:00 overrides automatic 18:15: four regular and four holiday hours", () => {
    const result = pay("2027-06-10", 14, 22);
    assert.equal(result.holidayMinutes, 240);
    assert.equal(result.total, 50000);
    assert.deepEqual(result.segments.map((s) => [s.minutes, s.rateBp]), [[240, 10000], [240, 15000]]);
  });
  it("uses exact automatic 18:15 entry rather than whole hours", () => {
    const automatic = createHolidayWindows(calendar, { ...settings, windowMode: "automatic", workCity: "telAviv" });
    const result = calculateShiftPay({ ...base, startAt: wall("2027-06-10", 14), endAt: wall("2027-06-10", 22), holidayIntervals: automatic.intervals });
    assert.equal(result.holidayMinutes, 225);
    assert.deepEqual(result.segments.map((s) => s.minutes), [255, 225]);
    assert.equal(result.total, 49375);
  });
  it("splits a shift at the 19:00 holiday exit", () => {
    assert.deepEqual(pay("2027-06-11", 17, 21).segments.map((s) => [s.minutes, s.rateBp]), [[120, 15000], [120, 10000]]);
  });
  it("pays a wholly enclosed shift at 150%", () => { assert.equal(pay("2027-06-11", 8, 16).total, 60000); });
  it("does not premium a shift outside the holiday", () => { assert.equal(pay("2027-06-10", 8, 16).total, 40000); });
  it("handles an overnight shift without a midnight boundary", () => {
    const result = calculateShiftPay({ ...base, startAt: wall("2027-06-10", 23), endAt: wall("2027-06-11", 7) });
    assert.equal(result.holidayMinutes, 480); assert.equal(result.total, 60000);
  });
  it("merges consecutive overlapping holidays and preserves both identities", () => {
    const consecutive: HolidayCalendar = { events: [calendar.events[0], { ...calendar.events[0], id: "second", holidayDate: "2027-06-12" }], times: [] };
    const windows = createHolidayWindows(consecutive, settings).intervals;
    assert.equal(windows.length, 1); assert.equal(windows[0].holidayIds.length, 2);
    const slices = splitShiftByPremiumIntervals(wall("2027-06-11", 17), wall("2027-06-11", 21), windows);
    assert.equal(slices.reduce((sum, item) => sum + item.minutes, 0), 240);
    assert.ok(slices.every((slice) => slice.rateBp === 15000));
    assert.equal(mergePremiumIntervals([...windows, ...windows]).length, 1);
  });
  it("does not stack holidays on existing rest-day rates", () => {
    const result = calculateShiftPay({ ...base, startAt: wall("2027-06-11", 8), endAt: wall("2027-06-11", 16), isHoliday: true });
    assert.equal(result.total, 60000); assert.equal(result.holidayPremium, 0);
  });
  const independence: HolidayCalendar = { events: [{ ...calendar.events[0], id: "independence", kind: "independence", holidayDate: "2027-05-12" }], times: [] };
  it("uses 20:00–20:00 for Independence Day in automatic mode", () => {
    const result = createHolidayWindows(independence, { ...settings, windowMode: "automatic" }).intervals[0];
    assert.equal(result.startsAt, wall("2027-05-11", 20).toISOString());
    assert.equal(result.endsAt, wall("2027-05-12", 20).toISOString());
  });
  it("custom hours override Independence Day's 20:00 rule", () => {
    const result = createHolidayWindows(independence, settings).intervals[0];
    assert.equal(result.startsAt, wall("2027-05-11", 18).toISOString());
    assert.equal(result.endsAt, wall("2027-05-12", 19).toISOString());
  });
  it("loads both calendar years at December/January and supports future years", () => {
    assert.deepEqual(holidayYearsForRange(wall("2031-12-31", 22), wall("2032-01-01", 6)), [2031, 2032]);
    assert.equal(calendarDay("2032-01-01", -1), "2031-12-31");
  });
  it("uses calendar dates across both Jerusalem DST changes", () => {
    const make = (day: string) => createHolidayWindows({ events: [{ ...calendar.events[0], holidayDate: day }], times: [] }, { ...settings, customEndMinute: 1080 }).intervals[0];
    const spring = make("2026-03-27"), autumn = make("2026-10-25");
    assert.equal((Date.parse(spring.endsAt) - Date.parse(spring.startsAt)) / 3600000, 23);
    assert.equal((Date.parse(autumn.endsAt) - Date.parse(autumn.startsAt)) / 3600000, 25);
    assert.equal(israelWallTime("2026-03-27", 150).toISOString(), "2026-03-27T00:30:00.000Z");
    assert.equal(israelWallTime("2026-10-25", 90).toISOString(), "2026-10-24T22:30:00.000Z");
  });
  it("keeps overtime boundaries and higher overtime rates without multiplication", () => {
    const result = calculateShiftPay({ ...base, startAt: wall("2027-06-10", 8), endAt: wall("2027-06-10", 22), rules: { ...base.rules, overtimeEnabled: true } });
    assert.equal(result.regularMinutes, 516); assert.equal(result.overtimeMinutes, 324);
    assert.ok(result.segments.every((s) => s.rateBp <= 15000));
    assert.equal(result.segments.reduce((sum, s) => sum + s.amount, 0), result.total);
  });
  it("monthly pay adds only the premium above already-paid normal hours", () => {
    const result = calculateShiftPay({ ...base, payType: "monthly", startAt: wall("2027-06-10", 14), endAt: wall("2027-06-10", 22) });
    assert.equal(result.total, 10000); assert.equal(result.holidayPremium, 10000);
  });
  it("places unpaid break minutes at the end and never premiums them", () => {
    const result = calculateShiftPay({ ...base, breakMinutes: 30, startAt: wall("2027-06-10", 14), endAt: wall("2027-06-10", 22) });
    assert.equal(result.workedMinutes, 450); assert.equal(result.holidayMinutes, 210);
    assert.equal(result.total, 46250);
  });
  it("does not invent automatic windows when entry or exit times are missing", () => {
    const result = createHolidayWindows({ events: calendar.events, times: [] }, { ...settings, windowMode: "automatic" });
    assert.equal(result.missingTimes, true); assert.deepEqual(result.intervals, []);
    assert.deepEqual(createHolidayWindows(calendar, { ...settings, enabled: false }).intervals, []);
  });
});
