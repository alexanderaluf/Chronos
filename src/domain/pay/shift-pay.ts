import {
  FULL_RATE_BP,
  payForMinutes,
  type BasisPoints,
  type MinorUnits,
} from "../money/money";
import { minutesBetween, minutesInDailyWindow, minutesOnWeekdays } from "../time/time";
import type { PayRules } from "./pay-rules";

export type PayType = "hourly" | "monthly";

export type ShiftPayInput = {
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
  kind: PaySegmentKind;
  minutes: number;
  rateBp: BasisPoints;
  amount: MinorUnits;
};

export type ShiftPay = {
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

  const nightMinutes = minutesInDailyWindow(
    input.startAt,
    input.endAt,
    rules.nightWindowStartMinute,
    rules.nightWindowEndMinute,
  );
  const isNightShift = nightMinutes > 0 && nightMinutes >= rules.nightShiftMinNightMinutes;
  const restMinutes = minutesOnWeekdays(input.startAt, input.endAt, rules.restDays);
  const isRestDay = input.isHoliday || (elapsedMinutes > 0 && restMinutes * 2 >= elapsedMinutes);

  const threshold = isNightShift
    ? rules.nightShiftThresholdMinutes
    : rules.dailyOvertimeThresholdMinutes;
  const regularMinutes = rules.overtimeEnabled ? Math.min(workedMinutes, threshold) : workedMinutes;
  const tier1Minutes = Math.min(workedMinutes - regularMinutes, rules.overtimeTier1Minutes);
  const tier2Minutes = workedMinutes - regularMinutes - tier1Minutes;

  const rates: Record<PaySegmentKind, BasisPoints> = isRestDay
    ? {
        regular: rules.restDayRateBp,
        overtimeTier1: rules.restDayOvertimeTier1RateBp,
        overtimeTier2: rules.restDayOvertimeTier2RateBp,
      }
    : {
        regular: FULL_RATE_BP,
        overtimeTier1: rules.overtimeTier1RateBp,
        overtimeTier2: rules.overtimeTier2RateBp,
      };

  const segment = (kind: PaySegmentKind, minutes: number): PaySegment => {
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

  const segments = [
    segment("regular", regularMinutes),
    segment("overtimeTier1", tier1Minutes),
    segment("overtimeTier2", tier2Minutes),
  ].filter((item) => item.minutes > 0);

  const basePay = segments.find((item) => item.kind === "regular")?.amount ?? 0;
  const overtimePay = segments
    .filter((item) => item.kind !== "regular")
    .reduce((total, item) => total + item.amount, 0);

  // Night premium applies to worked night minutes; a break is assumed outside the night window
  // only when there is enough day time to hold it.
  const workedNightMinutes = Math.min(nightMinutes, workedMinutes);
  const nightPremium =
    rules.nightPremiumRateBp > FULL_RATE_BP
      ? payForMinutes(input.hourlyRate, workedNightMinutes, rules.nightPremiumRateBp - FULL_RATE_BP)
      : 0;

  return {
    elapsedMinutes,
    workedMinutes,
    nightMinutes,
    isNightShift,
    isRestDay,
    regularMinutes,
    overtimeMinutes: tier1Minutes + tier2Minutes,
    segments,
    basePay,
    overtimePay,
    nightPremium,
    bonus: input.bonus,
    tips: input.tips,
    total: basePay + overtimePay + nightPremium + input.bonus + input.tips,
  };
}
