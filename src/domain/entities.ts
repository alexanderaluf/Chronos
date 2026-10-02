import type { MinorUnits } from "./money/money";
import type { PayRules } from "./pay/pay-rules";
import type { PayType } from "./pay/shift-pay";
import type { TaxRules } from "./tax/tax-rules";
import type { PersonalInfo, TaxStatus } from "./tax/tax-status";
import type { LocalDateKey, PeriodKey } from "./time/time";

export type { PayComponent, PayComponentCalculation, PayComponentKind } from "./pay/pay-components";

/**
 * The records Chronos keeps. The database layer (`src/data`) maps SQLite rows
 * to these shapes; screens and calculations only ever see these types.
 * Timestamps are ISO-8601 UTC strings.
 */

export type Job = {
  id: string;
  name: string;
  color: string;
  payType: PayType;
  /** Used by hourly jobs, and copied onto each new shift as a snapshot. */
  hourlyRate: MinorUnits;
  /** Global bonus copied onto each new shift; editable per shift. */
  defaultShiftBonus: MinorUnits;
  /** Used by monthly jobs. */
  monthlySalary: MinorUnits;
  /** Monthly salary ÷ this = hourly value for overtime (182 in Israel). */
  monthlyHoursDivisor: number;
  currencyCode: string;
  /** @deprecated since schema v2: travel is a "per work day" addition (PayComponent). Ignored by calculations. */
  travelPerDay: MinorUnits;
  payRules: PayRules;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type Shift = {
  id: string;
  jobId: string;
  startAt: string;
  /** `null` while the user is clocked in. */
  endAt: string | null;
  /** IANA zone the shift was recorded in, e.g. "Asia/Jerusalem". */
  timeZone: string;
  breakMinutes: number;
  /** Hourly rate at the time of the shift, so later rate changes never rewrite history. */
  hourlyRate: MinorUnits;
  isHoliday: boolean;
  bonus: MinorUnits;
  tips: MinorUnits;
  note: string | null;
  /** Display color; falls back to the job color. */
  color: string | null;
  /** Short name, e.g. the fixed shift it was created from ("Morning"). */
  label: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PaidDayKind = "vacation" | "sick" | "holiday" | "other";

/** A paid day without a shift: vacation, sick day, paid holiday. */
export type PaidDay = {
  id: string;
  jobId: string;
  date: LocalDateKey;
  kind: PaidDayKind;
  /** Paid time for the day. */
  minutes: number;
  /** 10000 = full pay; e.g. 5000 for a half-paid sick day. */
  rateBp: number;
  /** Hourly rate when the day was recorded (snapshot, like shifts). */
  hourlyRate: MinorUnits;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** A "fixed shift": a reusable preset for creating shifts quickly. */
export type ShiftTemplate = {
  id: string;
  jobId: string;
  name: string;
  color: string;
  /** Local start / end minute-of-day. Both null = variable hours (entered per shift). */
  startMinute: number | null;
  endMinute: number | null;
  breakMinutes: number;
  /** Replaces the job hourly rate for shifts made from this template. */
  hourlyRate: MinorUnits | null;
  /** Bonus added to each shift made from this template. */
  bonus: MinorUnits;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** A planned shift in the weekly schedule (not worked yet, not paid). */
export type PlannedShift = {
  date: LocalDateKey;
  startMinute: number;
  endMinute: number;
  note: string | null;
  updatedAt: string;
};

export type AdjustmentKind = "bonus" | "deduction";

/** A one-off item for one month: a bonus, or a deduction from net pay. */
export type PayAdjustment = {
  id: string;
  jobId: string | null;
  periodKey: PeriodKey;
  kind: AdjustmentKind;
  label: string;
  amount: MinorUnits;
  /** Bonuses are usually taxable; deductions are taken from net pay. */
  isTaxable: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type TaxProfile = {
  id: string;
  name: string;
  countryCode: string;
  taxYear: number;
  rules: TaxRules;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ThemeMode = "system" | "light" | "dark";

/** App languages. Hebrew is right-to-left; English and Russian are left-to-right. */
export const APP_LANGUAGES = ["en", "he", "ru"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];
export type AccentColorId =
  | "cyan"
  | "blue"
  | "violet"
  | "rose"
  | "coral"
  | "amber"
  | "green"
  | "lime";

export type CalendarDirection = "ltr" | "rtl";

/** Employer details kept on the device (shared only when the user shares a report). */
export type EmployerInfo = {
  name: string;
  email: string;
  notes: string;
};

export type AppSettings = {
  holidayPay: import("./holidays/holiday-settings").HolidayPaySettings;
  /** null = follow the device language (English if it is not supported). */
  appLanguage: AppLanguage | null;
  themeMode: ThemeMode;
  accentColor: AccentColorId;
  /** Day of month a pay period starts (1–28). */
  payPeriodStartDay: number;
  /** 0 = Sunday. */
  weekStartDay: number;
  /** Job used for new shifts and when clocking in. */
  defaultJobId: string | null;
  onboardingCompletedAt: string | null;
  /** Round entered and clocked times to this many minutes (0 = no rounding). */
  roundingMinutes: number;
  /** After saving a new shift, show its hours and pay. */
  showShiftSummaryAfterSave: boolean;
  calendarDirection: CalendarDirection;
  personalInfo: PersonalInfo;
  taxStatus: TaxStatus;
  employer: EmployerInfo;
};
