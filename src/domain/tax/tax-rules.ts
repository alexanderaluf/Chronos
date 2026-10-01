import type { BasisPoints, MinorUnits } from "../money/money";

/**
 * The tax SYSTEM: brackets, credit-point rules and insurance rates for one
 * country and year. Stored as JSON in `tax_profiles.rules_json`. Every value
 * is user-editable so people outside Israel can enter their own numbers.
 * The user's PERSONAL status (credit points, exemptions…) lives in
 * `tax-status.ts`. All amounts are MONTHLY minor units.
 */
export type IncomeTaxBracket = {
  /** Upper bound of this bracket (inclusive). `null` = no upper bound. */
  upTo: MinorUnits | null;
  rateBp: BasisPoints;
};

/** Credit points per child, by the child's age in the tax year. */
export type ChildCreditPointRule = {
  fromAge: number;
  toAge: number;
  /** Hundredths of a point: 150 = 1.5 points. */
  motherHundredths: number;
  fatherHundredths: number;
};

export type CreditPointRules = {
  residentHundredths: number;
  womanHundredths: number;
  singleParentHundredths: number;
  firstDegreeHundredths: number;
  children: ChildCreditPointRule[];
};

export type InsuranceRates = {
  reducedRateBp: BasisPoints;
  fullRateBp: BasisPoints;
};

export type TaxRules = {
  incomeTaxBrackets: IncomeTaxBracket[];
  /** Monthly value of one credit point. */
  creditPointValue: MinorUnits;
  creditPointRules: CreditPointRules;
  /** Income up to this amount pays the reduced insurance rates. */
  insuranceReducedThreshold: MinorUnits;
  /** Income above this amount is not insured. 0 = no ceiling. */
  insuranceCeiling: MinorUnits;
  nationalInsuranceEmployee: InsuranceRates;
  nationalInsuranceSelfEmployed: InsuranceRates;
  healthInsurance: InsuranceRates;
};

/**
 * Israeli defaults for 2026. Bracket indexation is frozen for 2025–2027 and
 * these brackets and the credit-point value reproduce a real 2026 payslip.
 * Insurance thresholds change every January, the child credit-point table has
 * been reformed several times, and the self-employed rates are approximate —
 * the user should verify all of them (gov.il / btl.gov.il) and edit as needed.
 *
 * Database migration 2 seeds these values. Do not edit them in place for a
 * new year: add a new constant (e.g. ISRAEL_2027_TAX_RULES) and a migration.
 */
export const ISRAEL_2026_TAX_RULES: TaxRules = {
  incomeTaxBrackets: [
    { upTo: 701_000, rateBp: 1_000 },
    { upTo: 1_006_000, rateBp: 1_400 },
    { upTo: 1_615_000, rateBp: 2_000 },
    { upTo: 2_244_000, rateBp: 3_100 },
    { upTo: 4_669_000, rateBp: 3_500 },
    { upTo: 6_013_000, rateBp: 4_700 },
    { upTo: null, rateBp: 5_000 }, // 47% + 3% surtax
  ],
  creditPointValue: 24_200,
  creditPointRules: {
    residentHundredths: 225,
    womanHundredths: 50,
    singleParentHundredths: 100,
    firstDegreeHundredths: 100,
    children: [
      { fromAge: 0, toAge: 0, motherHundredths: 150, fatherHundredths: 150 },
      { fromAge: 1, toAge: 5, motherHundredths: 250, fatherHundredths: 250 },
      { fromAge: 6, toAge: 17, motherHundredths: 100, fatherHundredths: 0 },
      { fromAge: 18, toAge: 18, motherHundredths: 50, fatherHundredths: 0 },
    ],
  },
  insuranceReducedThreshold: 770_300,
  insuranceCeiling: 5_191_000,
  nationalInsuranceEmployee: { reducedRateBp: 104, fullRateBp: 700 },
  nationalInsuranceSelfEmployed: { reducedRateBp: 447, fullRateBp: 1_283 },
  healthInsurance: { reducedRateBp: 323, fullRateBp: 517 },
};

/** A neutral starting point for people outside Israel: no deductions until they fill them in. */
export const EMPTY_TAX_RULES: TaxRules = {
  incomeTaxBrackets: [{ upTo: null, rateBp: 0 }],
  creditPointValue: 0,
  creditPointRules: {
    residentHundredths: 0,
    womanHundredths: 0,
    singleParentHundredths: 0,
    firstDegreeHundredths: 0,
    children: [],
  },
  insuranceReducedThreshold: 0,
  insuranceCeiling: 0,
  nationalInsuranceEmployee: { reducedRateBp: 0, fullRateBp: 0 },
  nationalInsuranceSelfEmployed: { reducedRateBp: 0, fullRateBp: 0 },
  healthInsurance: { reducedRateBp: 0, fullRateBp: 0 },
};

function nonNegativeInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function normalizeRates(input: unknown, fallback: InsuranceRates): InsuranceRates {
  const raw = record(input);
  return {
    reducedRateBp: nonNegativeInt(raw.reducedRateBp, fallback.reducedRateBp),
    fullRateBp: nonNegativeInt(raw.fullRateBp, fallback.fullRateBp),
  };
}

function normalizeBrackets(input: unknown, fallback: IncomeTaxBracket[]): IncomeTaxBracket[] {
  const parsed = Array.isArray(input)
    ? input
        .map(record)
        .map((bracket) => ({
          upTo: bracket.upTo === null ? null : nonNegativeInt(bracket.upTo, -1),
          rateBp: nonNegativeInt(bracket.rateBp, -1),
        }))
        .filter((bracket) => bracket.rateBp >= 0 && bracket.upTo !== -1)
    : [];
  if (parsed.length === 0) return fallback;
  const bounded = parsed
    .filter((bracket): bracket is { upTo: number; rateBp: number } => bracket.upTo !== null)
    .sort((a, b) => a.upTo - b.upTo);
  const unbounded = parsed.find((bracket) => bracket.upTo === null);
  return [
    ...bounded,
    { upTo: null, rateBp: unbounded?.rateBp ?? bounded[bounded.length - 1]?.rateBp ?? 0 },
  ];
}

function normalizeCreditPointRules(input: unknown, fallback: CreditPointRules): CreditPointRules {
  const raw = record(input);
  const children = Array.isArray(raw.children)
    ? raw.children
        .map(record)
        .map((rule) => ({
          fromAge: nonNegativeInt(rule.fromAge, -1),
          toAge: nonNegativeInt(rule.toAge, -1),
          motherHundredths: nonNegativeInt(rule.motherHundredths, 0),
          fatherHundredths: nonNegativeInt(rule.fatherHundredths, 0),
        }))
        .filter((rule) => rule.fromAge >= 0 && rule.toAge >= rule.fromAge)
        .sort((a, b) => a.fromAge - b.fromAge)
    : fallback.children;
  return {
    residentHundredths: nonNegativeInt(raw.residentHundredths, fallback.residentHundredths),
    womanHundredths: nonNegativeInt(raw.womanHundredths, fallback.womanHundredths),
    singleParentHundredths: nonNegativeInt(raw.singleParentHundredths, fallback.singleParentHundredths),
    firstDegreeHundredths: nonNegativeInt(raw.firstDegreeHundredths, fallback.firstDegreeHundredths),
    children,
  };
}

/**
 * Accepts anything (e.g. parsed JSON, including the schema-v1 shape) and
 * returns complete, valid rules. Brackets are sorted and the last one is unbounded.
 */
export function normalizeTaxRules(input: unknown, fallback: TaxRules = ISRAEL_2026_TAX_RULES): TaxRules {
  const raw = record(input);
  // Schema v1 kept thresholds inside `nationalInsurance`.
  const legacyNi = record(raw.nationalInsurance);

  return {
    incomeTaxBrackets: normalizeBrackets(raw.incomeTaxBrackets, fallback.incomeTaxBrackets),
    creditPointValue: nonNegativeInt(raw.creditPointValue, fallback.creditPointValue),
    creditPointRules: normalizeCreditPointRules(raw.creditPointRules, fallback.creditPointRules),
    insuranceReducedThreshold: nonNegativeInt(
      raw.insuranceReducedThreshold ?? legacyNi.reducedThreshold,
      fallback.insuranceReducedThreshold,
    ),
    insuranceCeiling: nonNegativeInt(raw.insuranceCeiling ?? legacyNi.ceiling, fallback.insuranceCeiling),
    nationalInsuranceEmployee: normalizeRates(
      raw.nationalInsuranceEmployee ?? (raw.nationalInsurance ? legacyNi : undefined),
      fallback.nationalInsuranceEmployee,
    ),
    nationalInsuranceSelfEmployed: normalizeRates(
      raw.nationalInsuranceSelfEmployed,
      fallback.nationalInsuranceSelfEmployed,
    ),
    healthInsurance: normalizeRates(raw.healthInsurance, fallback.healthInsurance),
  };
}
