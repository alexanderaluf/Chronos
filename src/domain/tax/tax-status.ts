import type { BasisPoints, MinorUnits } from "../money/money";
import type { LocalDateKey } from "../time/time";

/**
 * The user's PERSONAL situation, as opposed to the tax system in
 * `tax-rules.ts`. Stored in the `settings` table, edited on the
 * "Personal info" and "Taxes & insurance" screens.
 */

export type Gender = "male" | "female";
export type MaritalStatus = "single" | "married";

/** Used to calculate income-tax credit points automatically. */
export type PersonalInfo = {
  birthDate: LocalDateKey | null;
  gender: Gender;
  maritalStatus: MaritalStatus;
  isSingleParent: boolean;
  /** Eligible this year for the first-degree credit point. */
  hasFirstDegree: boolean;
  childrenBirthDates: LocalDateKey[];
};

export type EmploymentType = "employee" | "selfEmployed";

export type TaxStatus = {
  employmentType: EmploymentType;
  creditPointsMode: "auto" | "manual";
  /** Used when `creditPointsMode` is "manual". 225 = 2.25 points. */
  manualCreditPointsHundredths: number;
  /** Exempt from national insurance (health tax still applies). */
  nationalInsuranceExempt: boolean;
  /** Monthly taxable benefit value (e.g. company car). Taxed but not paid out. */
  taxableBenefitMonthly: MinorUnits;
  /** Tax credit for residents of eligible localities: rate of income… */
  settlementCreditRateBp: BasisPoints;
  /** …up to this monthly income. */
  settlementCreditMonthlyCeiling: MinorUnits;
};

export const DEFAULT_PERSONAL_INFO: PersonalInfo = {
  birthDate: null,
  gender: "male",
  maritalStatus: "single",
  isSingleParent: false,
  hasFirstDegree: false,
  childrenBirthDates: [],
};

export const DEFAULT_TAX_STATUS: TaxStatus = {
  employmentType: "employee",
  creditPointsMode: "auto",
  manualCreditPointsHundredths: 225,
  nationalInsuranceExempt: false,
  taxableBenefitMonthly: 0,
  settlementCreditRateBp: 0,
  settlementCreditMonthlyCeiling: 0,
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function nonNegativeInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizePersonalInfo(input: unknown): PersonalInfo {
  const raw = record(input);
  const d = DEFAULT_PERSONAL_INFO;
  return {
    birthDate: typeof raw.birthDate === "string" && DATE_KEY.test(raw.birthDate) ? raw.birthDate : d.birthDate,
    gender: raw.gender === "female" ? "female" : "male",
    maritalStatus: raw.maritalStatus === "married" ? "married" : "single",
    isSingleParent: bool(raw.isSingleParent, d.isSingleParent),
    hasFirstDegree: bool(raw.hasFirstDegree, d.hasFirstDegree),
    childrenBirthDates: Array.isArray(raw.childrenBirthDates)
      ? raw.childrenBirthDates.filter((date): date is string => typeof date === "string" && DATE_KEY.test(date))
      : d.childrenBirthDates,
  };
}

export function normalizeTaxStatus(input: unknown): TaxStatus {
  const raw = record(input);
  const d = DEFAULT_TAX_STATUS;
  return {
    employmentType: raw.employmentType === "selfEmployed" ? "selfEmployed" : "employee",
    creditPointsMode: raw.creditPointsMode === "manual" ? "manual" : "auto",
    manualCreditPointsHundredths: nonNegativeInt(raw.manualCreditPointsHundredths, d.manualCreditPointsHundredths),
    nationalInsuranceExempt: bool(raw.nationalInsuranceExempt, d.nationalInsuranceExempt),
    taxableBenefitMonthly: nonNegativeInt(raw.taxableBenefitMonthly, d.taxableBenefitMonthly),
    settlementCreditRateBp: nonNegativeInt(raw.settlementCreditRateBp, d.settlementCreditRateBp),
    settlementCreditMonthlyCeiling: nonNegativeInt(raw.settlementCreditMonthlyCeiling, d.settlementCreditMonthlyCeiling),
  };
}
