import { applyBasisPoints, divideRounded, type MinorUnits } from "../money/money";
import type { InsuranceRates, TaxRules } from "./tax-rules";
import type { TaxStatus } from "./tax-status";

export type MandatoryDeductions = {
  /** Income the deductions were calculated on (taxable pay + taxable benefits). */
  taxableIncome: MinorUnits;
  incomeTaxBeforeCredits: MinorUnits;
  creditPointsValue: MinorUnits;
  settlementCredit: MinorUnits;
  incomeTax: MinorUnits;
  nationalInsurance: MinorUnits;
  healthInsurance: MinorUnits;
  total: MinorUnits;
};

/** Progressive tax: each bracket's rate applies only to income inside that bracket. */
export function calculateProgressiveTax(income: MinorUnits, rules: TaxRules): MinorUnits {
  let tax = 0;
  let lowerBound = 0;
  for (const bracket of rules.incomeTaxBrackets) {
    if (income <= lowerBound) break;
    const upper = bracket.upTo === null ? income : Math.min(income, bracket.upTo);
    if (upper > lowerBound) tax += applyBasisPoints(upper - lowerBound, bracket.rateBp);
    if (bracket.upTo === null) break;
    lowerBound = bracket.upTo;
  }
  return tax;
}

/** Insurance: reduced rate up to a threshold, full rate up to the ceiling. Each part rounds separately, like a payslip. */
export function tieredInsurance(
  income: MinorUnits,
  reducedThreshold: MinorUnits,
  ceiling: MinorUnits,
  rates: InsuranceRates,
): MinorUnits {
  const insured = ceiling > 0 ? Math.min(income, ceiling) : income;
  const reducedPart = Math.min(insured, reducedThreshold);
  const fullPart = Math.max(0, insured - reducedPart);
  return applyBasisPoints(reducedPart, rates.reducedRateBp) + applyBasisPoints(fullPart, rates.fullRateBp);
}

/**
 * Income tax (after credit points and locality credit), national insurance
 * and health insurance for one month. An estimate: it ignores annual tax
 * coordination and the tax credit for pension deposits.
 */
export function calculateMandatoryDeductions(input: {
  taxableIncome: MinorUnits;
  creditPointsHundredths: number;
  rules: TaxRules;
  status: TaxStatus;
}): MandatoryDeductions {
  const { rules, status } = input;
  const income = Math.max(0, input.taxableIncome);

  const incomeTaxBeforeCredits = calculateProgressiveTax(income, rules);
  const creditPointsValue = divideRounded(input.creditPointsHundredths * rules.creditPointValue, 100);
  const settlementCredit = applyBasisPoints(
    status.settlementCreditMonthlyCeiling > 0 ? Math.min(income, status.settlementCreditMonthlyCeiling) : 0,
    status.settlementCreditRateBp,
  );
  const incomeTax = Math.max(0, incomeTaxBeforeCredits - creditPointsValue - settlementCredit);

  const niRates =
    status.employmentType === "selfEmployed" ? rules.nationalInsuranceSelfEmployed : rules.nationalInsuranceEmployee;
  const nationalInsurance = status.nationalInsuranceExempt
    ? 0
    : tieredInsurance(income, rules.insuranceReducedThreshold, rules.insuranceCeiling, niRates);
  const healthInsurance = tieredInsurance(
    income,
    rules.insuranceReducedThreshold,
    rules.insuranceCeiling,
    rules.healthInsurance,
  );

  return {
    taxableIncome: income,
    incomeTaxBeforeCredits,
    creditPointsValue,
    settlementCredit,
    incomeTax,
    nationalInsurance,
    healthInsurance,
    total: incomeTax + nationalInsurance + healthInsurance,
  };
}
