import { agreementPayRate, agreementSupplement, normalizeSalaryAgreement, type SalaryAgreement } from "./salary-agreement";
import {
  FULL_RATE_BP,
  divideRounded,
  payForMinutes,
  type BasisPoints,
  type MinorUnits,
} from "../money/money";
import { minutesBetween, minutesInDailyWindow, minutesOnWeekdays } from "../time/time";
import type { PayRules } from "./pay-rules";
import { weeklyRestIntervals } from "../time/weekly-rest";
import { splitShiftByPremiumIntervals, type HolidayPremiumInterval } from "../holidays/premium-intervals";

export type PayType = "hourly" | "monthly";

export type ShiftPayInput = {
  salaryAgreement?: SalaryAgreement;
  holidayIntervals?: readonly HolidayPremiumInterval[];
  startAt: Date;
  endAt: Date;
  breakMinutes: number;
  /** Hourly rate snapshot saved on the shift, or the monthly salary's hourly equivalent. */
  hourlyRate: MinorUnits;
  payType: PayType;
  isHoliday: boolean;
  bonus: MinorUnits;
  tips: MinorUnits;
  rules: PayRules;
};

export type PaySegmentKind = "regular" | "overtimeTier1" | "overtimeTier2";

export type PaySegment = {
  /** Agreement pay for this slice (night additions are separate). */
  agreementAmount: MinorUnits;
  agreementApplied: boolean;
  hourlyBasePay: MinorUnits;
  hourlyAgreementPay: MinorUnits;
  hourlyPay: MinorUnits;
  total: MinorUnits;
  restDay?: boolean;
  holiday?: boolean;
  startsAt?: string;
  endsAt?: string;
  kind: PaySegmentKind;
  minutes: number;
  rateBp: BasisPoints;
  amount: MinorUnits;
};

export type ShiftPay = {
  /** Night premium including any agreement supplement on that premium. */
  totalNightPremium: MinorUnits;
  agreementPay: MinorUnits;
  holidayMinutes: number;
  holidayPremium: MinorUnits;
  elapsedMinutes: number;
  workedMinutes: number;
  nightMinutes: number;
  isNightShift: boolean;
  isRestDay: boolean;
  regularMinutes: number;
  overtimeMinutes: number;
  segments: PaySegment[];
  /** Pay for the regular segment (only rest-day premium for monthly jobs). */
  basePay: MinorUnits;
  overtimePay: MinorUnits;
  /** Extra pay for worked minutes inside the night window (rules.nightPremiumRateBp). */
  nightPremium: MinorUnits;
  bonus: MinorUnits;
  tips: MinorUnits;
  total: MinorUnits;
};

/**
 * Pay for one finished shift.
 *
 * - Worked time = elapsed time − break (unless breaks are paid).
 * - A night shift (enough minutes in the night window) uses the shorter
 *   overtime threshold.
 * - A shift is on the rest day when it is flagged as a holiday or at least half
 *   of it falls on a rest weekday; then the rest-day rates replace the normal ones.
 *   A custom weekly window instead applies rest rates only to its worked minutes.
 * - With overtime disabled, all worked minutes use the regular rate.
 * - An optional night premium is paid on top for minutes in the night window.
 * - Hourly jobs earn every segment. Monthly jobs already earn regular hours
 *   through the salary, so they only get the premium above 100% for them.
 */
export function calculateShiftPay(input: ShiftPayInput): ShiftPay {
  const { rules } = input;
  const elapsedMinutes = minutesBetween(input.startAt, input.endAt);
  const breakMinutes = rules.unpaidBreaks ? Math.max(0, input.breakMinutes) : 0;
  const workedMinutes = Math.max(0, elapsedMinutes - breakMinutes);

  const nightMinutes = rules.nightShiftsEnabled !== false ? minutesInDailyWindow(
    input.startAt,
    input.endAt,
    rules.nightWindowStartMinute,
    rules.nightWindowEndMinute,
  ) : 0;
  const isNightShift = nightMinutes > 0 && nightMinutes >= rules.nightShiftMinNightMinutes;
  const restMinutes = minutesOnWeekdays(input.startAt, input.endAt, rules.restDays);
  // Unpaid breaks have no recorded placement; allocate them at the end, like holidays.
  const paidEnd = new Date(input.startAt.getTime() + workedMinutes * 60_000);
  const restIntervals = rules.restWindow ? weeklyRestIntervals(input.startAt, paidEnd, rules.restWindow) : [];
  const weeklyRest = rules.restWindow ? restIntervals.length > 0 : elapsedMinutes > 0 && restMinutes * 2 >= elapsedMinutes;
  const isRestDay = input.isHoliday || weeklyRest;

  const threshold = isNightShift
    ? rules.nightShiftThresholdMinutes
    : rules.dailyOvertimeThresholdMinutes;
  const regularMinutes = rules.overtimeEnabled ? Math.min(workedMinutes, threshold) : workedMinutes;
  const tier1Minutes = Math.min(workedMinutes - regularMinutes, rules.overtimeTier1Minutes);
  const tier2Minutes = workedMinutes - regularMinutes - tier1Minutes;

  const restRates: Record<PaySegmentKind, BasisPoints> = {
    regular: rules.restDayRateBp,
    overtimeTier1: rules.restDayOvertimeTier1RateBp,
    overtimeTier2: rules.restDayOvertimeTier2RateBp,
  };
  const rates: Record<PaySegmentKind, BasisPoints> = input.isHoliday || (!rules.restWindow && weeklyRest)
    ? restRates
    : {
        regular: FULL_RATE_BP,
        overtimeTier1: rules.overtimeTier1RateBp,
        overtimeTier2: rules.overtimeTier2RateBp,
      };

  const segment = (kind: PaySegmentKind, minutes: number): Omit<PaySegment, "agreementAmount" | "agreementApplied" | "hourlyBasePay" | "hourlyAgreementPay" | "hourlyPay" | "total"> => {
    const paidRate =
      kind === "regular" && input.payType === "monthly"
        ? Math.max(0, rates.regular - FULL_RATE_BP)
        : rates[kind];
    return {
      kind,
      minutes,
      rateBp: rates[kind],
      amount: payForMinutes(input.hourlyRate, minutes, paidRate),
    };
  };

  let segments = [
    segment("regular", regularMinutes),
    segment("overtimeTier1", tier1Minutes),
    segment("overtimeTier2", tier2Minutes),
  ].filter((item) => item.minutes > 0);

  if (rules.restWindow) {
    let cursor = input.startAt.getTime();
    segments = segments.flatMap((base) => {
      const end = new Date(cursor + base.minutes * 60_000);
      const slices = splitShiftByPremiumIntervals(new Date(cursor), end, restIntervals);
      cursor = end.getTime();
      return slices.filter((slice) => slice.minutes > 0).map((slice) => {
        const restDay = restIntervals.some((interval) => Date.parse(interval.startsAt) <= slice.start.getTime() && Date.parse(interval.endsAt) >= slice.end.getTime());
        const rateBp = restDay || input.isHoliday ? restRates[base.kind] : rates[base.kind];
        const paidRate = base.kind === "regular" && input.payType === "monthly" ? Math.max(0, rateBp - FULL_RATE_BP) : rateBp;
        return { kind: base.kind, minutes: slice.minutes, rateBp, restDay,
          amount: payForMinutes(input.hourlyRate, slice.minutes, paidRate), startsAt: slice.start.toISOString(), endsAt: slice.end.toISOString() };
      });
    });
  }
  const basePay = segments.filter((item) => item.kind === "regular").reduce((total, item) => total + item.amount, 0);
  const overtimePay = segments
    .filter((item) => item.kind !== "regular")
    .reduce((total, item) => total + item.amount, 0);

  let holidayMinutes = 0;
  let holidayWeightedMinutes = 0;
  if (input.holidayIntervals?.length) {
    let cursor = input.startAt.getTime();
    segments = segments.flatMap((base) => {
      const end = new Date(cursor + base.minutes * 60_000);
      const slices = splitShiftByPremiumIntervals(new Date(cursor), end, input.holidayIntervals!);
      cursor = end.getTime();
      return slices.filter((slice) => slice.minutes > 0).map((slice) => {
        const holiday = slice.holidayIds.length > 0;
        const rateBp = Math.max(base.rateBp, slice.rateBp);
        if (holiday) holidayMinutes += slice.minutes;
        holidayWeightedMinutes += slice.minutes * (rateBp - base.rateBp);
        const paidRate = base.kind === "regular" && input.payType === "monthly" ? Math.max(0, rateBp - FULL_RATE_BP) : rateBp;
        return { kind: base.kind, restDay: base.restDay, minutes: slice.minutes, rateBp, amount: payForMinutes(input.hourlyRate, slice.minutes, paidRate),
          holiday, startsAt: slice.start.toISOString(), endsAt: slice.end.toISOString() };
      });
    });
  }
  const holidayPremium = divideRounded(input.hourlyRate * holidayWeightedMinutes, 60 * FULL_RATE_BP);
  // Keep the monetary segment breakdown consistent with the total after rounding.
  if (segments.length && input.holidayIntervals?.length) {
    const roundingDifference = basePay + overtimePay + holidayPremium - segments.reduce((sum, item) => sum + item.amount, 0);
    segments[segments.length - 1].amount += roundingDifference;
  }

  // Night premium applies to worked night minutes; a break is assumed outside the night window
  // only when there is enough day time to hold it.
  const workedNightMinutes = Math.min(nightMinutes, workedMinutes);
  const nightPremium =
    rules.nightPremiumRateBp > FULL_RATE_BP
      ? payForMinutes(input.hourlyRate, workedNightMinutes, rules.nightPremiumRateBp - FULL_RATE_BP)
      : 0;

  const agreement = normalizeSalaryAgreement(input.salaryAgreement);
  const supplement = agreementSupplement(input.hourlyRate, agreement);
  let agreementPay = 0;
  let segmentCursor = input.startAt.getTime();
  const detailedSegments: PaySegment[] = segments.map((item) => {
    let paidRate = agreementPayRate(agreement, item.rateBp, {
      overtime: item.kind !== "regular",
      restDay: item.restDay ?? weeklyRest,
      holiday: Boolean(item.holiday) || input.isHoliday,
    });
    // Monthly salary already contains the regular supplement once.
    if (input.payType === "monthly" && item.kind === "regular") paidRate = Math.max(0, paidRate - FULL_RATE_BP);
    const amount = payForMinutes(supplement, item.minutes, paidRate);
    agreementPay += amount;
    const baseRate = input.payType === "monthly" && item.kind === "regular" ? Math.max(0, item.rateBp - FULL_RATE_BP) : item.rateBp;
    const start = segmentCursor;
    segmentCursor += item.minutes * 60_000;
    const hourlyBasePay = payForMinutes(input.hourlyRate, 60, baseRate);
    const hourlyAgreementPay = payForMinutes(supplement, 60, paidRate);
    return { ...item, restDay: item.restDay ?? weeklyRest, holiday: Boolean(item.holiday) || input.isHoliday,
      startsAt: item.startsAt ?? new Date(start).toISOString(), endsAt: item.endsAt ?? new Date(segmentCursor).toISOString(),
      agreementAmount: amount, agreementApplied: paidRate > 0, hourlyBasePay, hourlyAgreementPay,
      hourlyPay: hourlyBasePay + hourlyAgreementPay, total: item.amount + amount };
  });
  let nightAgreementPay = 0;
  if (agreement.nightPremium && nightPremium > 0) {
    // Rest/holiday exclusions also apply to the night supplement. Unpaid breaks sit at the end, as above.
    let cursor = input.startAt.getTime();
    for (const item of segments) {
      const end = cursor + item.minutes * 60_000;
      const minutes = minutesInDailyWindow(new Date(cursor), new Date(end), rules.nightWindowStartMinute, rules.nightWindowEndMinute);
      if (agreementPayRate(agreement, FULL_RATE_BP, { overtime: item.kind !== "regular", restDay: item.restDay ?? weeklyRest, holiday: Boolean(item.holiday) || input.isHoliday }) > 0) {
        nightAgreementPay += payForMinutes(supplement, minutes, rules.nightPremiumRateBp - FULL_RATE_BP);
      }
      cursor = end;
    }
  }
  agreementPay += nightAgreementPay;

  return {
    totalNightPremium: nightPremium + nightAgreementPay,
    agreementPay,
    holidayMinutes,
    holidayPremium,
    elapsedMinutes,
    workedMinutes,
    nightMinutes,
    isNightShift,
    isRestDay,
    regularMinutes,
    overtimeMinutes: tier1Minutes + tier2Minutes,
    segments: detailedSegments,
    basePay,
    overtimePay,
    nightPremium,
    bonus: input.bonus,
    tips: input.tips,
    total: basePay + overtimePay + holidayPremium + nightPremium + agreementPay + input.bonus + input.tips,
  };
}
