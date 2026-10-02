import { normalizeSalaryAgreement, type SalaryAgreement } from "./salary-agreement";
import type { BasisPoints } from "../money/money";

/**
 * How a job turns worked minutes into pay. Stored per job as JSON
 * (`jobs.pay_rules_json`) so the user can edit every value, and so new rules
 * can be added later without a schema migration — `normalizePayRules` fills
 * anything missing from the defaults.
 *
 * Defaults follow the common Israeli rules for a 5-day work week
 * (Hours of Work and Rest Law). They are estimates, not legal advice.
 */
export type PayRules = {
  /** Optional exact weekly rest window; null keeps the selected-weekdays behavior. */
  restWindow?: WeeklyRestWindow | null;
  salaryAgreement?: SalaryAgreement;
  /** When false, use daytime overtime thresholds and pay no night premium. */
  nightShiftsEnabled: boolean;
  /** When false, every worked minute is paid at the regular (or rest-day) rate. */
  overtimeEnabled: boolean;
  /** When true, the shift break is subtracted from paid time. */
  unpaidBreaks: boolean;
  /** Extra rate for minutes worked inside the night window (10000 = no premium, 12500 = +25%). */
  nightPremiumRateBp: BasisPoints;
  /** Minutes per day paid at the regular rate before overtime starts. */
  dailyOvertimeThresholdMinutes: number;
  /** Shorter threshold applied to a night shift. */
  nightShiftThresholdMinutes: number;
  /** Local minute-of-day the night window starts (22:00 = 1320). */
  nightWindowStartMinute: number;
  /** Local minute-of-day the night window ends (06:00 = 360). */
  nightWindowEndMinute: number;
  /** A shift is a night shift when at least this many minutes are in the night window. */
  nightShiftMinNightMinutes: number;
  /** Length of the first overtime tier (the first 2 hours). */
  overtimeTier1Minutes: number;
  overtimeTier1RateBp: BasisPoints;
  /** Rate for every overtime minute after tier 1. */
  overtimeTier2RateBp: BasisPoints;
  /** Local weekdays treated as the weekly rest day (0 = Sunday … 6 = Saturday). */
  restDays: number[];
  restDayRateBp: BasisPoints;
  restDayOvertimeTier1RateBp: BasisPoints;
  restDayOvertimeTier2RateBp: BasisPoints;
};

export const ISRAEL_DEFAULT_PAY_RULES: PayRules = {
  restWindow: null,
  nightShiftsEnabled: true,
  overtimeEnabled: true,
  unpaidBreaks: true,
  nightPremiumRateBp: 10_000,
  dailyOvertimeThresholdMinutes: 516, // 8.6 h — 42 h week over 5 days
  nightShiftThresholdMinutes: 420, // 7 h
  nightWindowStartMinute: 22 * 60,
  nightWindowEndMinute: 6 * 60,
  nightShiftMinNightMinutes: 120,
  overtimeTier1Minutes: 120,
  overtimeTier1RateBp: 12_500,
  overtimeTier2RateBp: 15_000,
  restDays: [6], // Saturday
  restDayRateBp: 15_000,
  restDayOvertimeTier1RateBp: 17_500,
  restDayOvertimeTier2RateBp: 20_000,
};

function wholeNumber(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

/** Accepts anything (e.g. parsed JSON) and returns complete, valid rules. */
export function normalizePayRules(input: unknown): PayRules {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const d = ISRAEL_DEFAULT_PAY_RULES;
  const restDays = Array.isArray(raw.restDays)
    ? [...new Set(raw.restDays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))]
    : d.restDays;

  return {
    restWindow: normalizeWeeklyRestWindow(raw.restWindow),
    salaryAgreement: normalizeSalaryAgreement(raw.salaryAgreement),
    nightShiftsEnabled: typeof raw.nightShiftsEnabled === "boolean" ? raw.nightShiftsEnabled : d.nightShiftsEnabled,
    overtimeEnabled: typeof raw.overtimeEnabled === "boolean" ? raw.overtimeEnabled : d.overtimeEnabled,
    unpaidBreaks: typeof raw.unpaidBreaks === "boolean" ? raw.unpaidBreaks : d.unpaidBreaks,
    nightPremiumRateBp: wholeNumber(raw.nightPremiumRateBp, d.nightPremiumRateBp, 10_000),
    dailyOvertimeThresholdMinutes: wholeNumber(raw.dailyOvertimeThresholdMinutes, d.dailyOvertimeThresholdMinutes, 0, 1440),
    nightShiftThresholdMinutes: wholeNumber(raw.nightShiftThresholdMinutes, d.nightShiftThresholdMinutes, 0, 1440),
    nightWindowStartMinute: wholeNumber(raw.nightWindowStartMinute, d.nightWindowStartMinute, 0, 1439),
    nightWindowEndMinute: wholeNumber(raw.nightWindowEndMinute, d.nightWindowEndMinute, 0, 1439),
    nightShiftMinNightMinutes: wholeNumber(raw.nightShiftMinNightMinutes, d.nightShiftMinNightMinutes, 0, 1440),
    overtimeTier1Minutes: wholeNumber(raw.overtimeTier1Minutes, d.overtimeTier1Minutes, 0, 1440),
    overtimeTier1RateBp: wholeNumber(raw.overtimeTier1RateBp, d.overtimeTier1RateBp),
    overtimeTier2RateBp: wholeNumber(raw.overtimeTier2RateBp, d.overtimeTier2RateBp),
    restDays,
    restDayRateBp: wholeNumber(raw.restDayRateBp, d.restDayRateBp),
    restDayOvertimeTier1RateBp: wholeNumber(raw.restDayOvertimeTier1RateBp, d.restDayOvertimeTier1RateBp),
    restDayOvertimeTier2RateBp: wholeNumber(raw.restDayOvertimeTier2RateBp, d.restDayOvertimeTier2RateBp),
  };
}

export type WeeklyRestWindow = { startDay: number; startMinute: number; endDay: number; endMinute: number };

export const DEFAULT_WEEKLY_REST_WINDOW: WeeklyRestWindow = {
  startDay: 5, startMinute: 18 * 60, endDay: 0, endMinute: 3 * 60,
};

function normalizeWeeklyRestWindow(input: unknown): WeeklyRestWindow | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const d = DEFAULT_WEEKLY_REST_WINDOW;
  return {
    startDay: wholeNumber(raw.startDay, d.startDay, 0, 6),
    startMinute: wholeNumber(raw.startMinute, d.startMinute, 0, 1439),
    endDay: wholeNumber(raw.endDay, d.endDay, 0, 6),
    endMinute: wholeNumber(raw.endMinute, d.endMinute, 0, 1439),
  };
}
