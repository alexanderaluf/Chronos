import { applyBasisPoints, type BasisPoints, type MinorUnits } from "../money/money";
import { tieredInsurance } from "../tax/mandatory-deductions";
import type { InsuranceRates, TaxRules } from "../tax/tax-rules";
import type { TaxStatus } from "../tax/tax-status";
import { computePayslip, type Payslip, type PayslipLine } from "./payslip";

/**
 * The Israeli payroll figures a monthly (global) payslip needs beyond the tax
 * system: pension and study-fund ceilings, the employer's national insurance
 * and the convalescence day rate. All amounts are MONTHLY minor units.
 */
export type PayrollRules = {
  /** Salary up to which the employee's pension deposit earns the 35% credit. */
  pensionCreditSalaryCeiling: MinorUnits;
  /** Share of that salary whose deposit counts for the credit (7%). */
  pensionCreditDepositBp: BasisPoints;
  /** The credit itself: 35% of the counted deposit (section 45). */
  pensionCreditRateBp: BasisPoints;
  /** Salary up to which the employer's study-fund deposit is tax-free. */
  studyFundSalaryCeiling: MinorUnits;
  /** Employer national insurance; it uses the tax rules' threshold and ceiling. */
  employerNationalInsurance: InsuranceRates;
  /** Private-sector convalescence pay (dmei havraa) per day. */
  convalescenceDayRate: MinorUnits;
};

/**
 * 2026 values: pension credit salary ₪9,700, study-fund salary ₪15,712,
 * employer national insurance 4.51% / 7.6%, convalescence ₪451.50 a day
 * (the 2026 private-sector agreement). Verify each January.
 */
export const ISRAEL_2026_PAYROLL_RULES: PayrollRules = {
  pensionCreditSalaryCeiling: 970_000,
  pensionCreditDepositBp: 700,
  pensionCreditRateBp: 3_500,
  studyFundSalaryCeiling: 1_571_200,
  employerNationalInsurance: { reducedRateBp: 451, fullRateBp: 760 },
  convalescenceDayRate: 45_150,
};

export type GlobalSalaryInput = {
  /** The monthly base salary: pension and the study fund are worked out on it. */
  baseSalary: MinorUnits;
  /** A fixed monthly sum for overtime (global overtime). */
  globalOvertime: MinorUnits;
  travel: MinorUnits;
  /** Convalescence pay paid this month. */
  convalescence: MinorUnits;
  /** Any other taxable pay: meals, phone allowance, bonus… */
  otherAdditions: MinorUnits;
  /** Taxed but not paid: company car, phone… */
  taxableBenefit: MinorUnits;
  pensionEmployeeBp: BasisPoints;
  pensionEmployerBp: BasisPoints;
  severanceBp: BasisPoints;
  /** 0 and 0 = no study fund. */
  studyFundEmployeeBp: BasisPoints;
  studyFundEmployerBp: BasisPoints;
  creditPointsHundredths: number;
  taxRules: TaxRules;
  /** The user's personal status; the estimate always treats them as an employee. */
  taxStatus: TaxStatus;
  payrollRules: PayrollRules;
};

export type GlobalSalaryEstimate = {
  /** Gross → income tax, insurance → pension, study fund → net. */
  payslip: Payslip;
  /** Already taken off the income tax. */
  pensionCredit: MinorUnits;
  /** The employer's study-fund deposit above the ceiling, taxed as a benefit. */
  studyFundTaxableExcess: MinorUnits;
  employer: {
    pension: MinorUnits;
    severance: MinorUnits;
    studyFund: MinorUnits;
    nationalInsurance: MinorUnits;
    /** Gross pay + everything the employer deposits or pays on top. */
    totalCost: MinorUnits;
  };
  /** Put aside for the employee this month, by both sides. */
  savings: { pension: MinorUnits; studyFund: MinorUnits };
};

/**
 * The 35% income-tax credit for an employee's pension deposit: on the deposit
 * up to 7% of the salary, counting salary up to the ceiling.
 */
export function pensionDepositCredit(baseSalary: MinorUnits, employeeDeposit: MinorUnits, rules: PayrollRules): MinorUnits {
  const countedSalary = Math.min(Math.max(0, baseSalary), rules.pensionCreditSalaryCeiling);
  const countedDeposit = Math.min(Math.max(0, employeeDeposit), applyBasisPoints(countedSalary, rules.pensionCreditDepositBp));
  return applyBasisPoints(countedDeposit, rules.pensionCreditRateBp);
}

/**
 * "What is my monthly salary worth?" for an Israeli employee: the payslip
 * with income tax, national and health insurance, pension and study fund,
 * plus the employer's cost and what is saved for the employee. Uses the same
 * payslip logic as the monthly report.
 */
export function globalSalaryEstimate(input: GlobalSalaryInput): GlobalSalaryEstimate {
  const base = Math.max(0, input.baseSalary);
  const earningLines: PayslipLine[] = [
    { key: "basePay", label: "Base pay", amount: base },
    { key: "globalOvertime", label: "Global overtime", amount: input.globalOvertime },
    { key: "travel", label: "Travel", amount: input.travel },
    { key: "convalescence", label: "Convalescence pay", amount: input.convalescence },
    { key: "otherAdditions", label: "Other additions", amount: input.otherAdditions },
  ].filter((line) => line.key === "basePay" || line.amount > 0);

  const pensionEmployee = applyBasisPoints(base, input.pensionEmployeeBp);
  const studyFundEmployee = applyBasisPoints(base, input.studyFundEmployeeBp);
  const studyFundEmployer = applyBasisPoints(base, input.studyFundEmployerBp);
  const studyFundTaxableExcess = applyBasisPoints(
    Math.max(0, base - input.payrollRules.studyFundSalaryCeiling),
    input.studyFundEmployerBp,
  );
  const pensionCredit = pensionDepositCredit(base, pensionEmployee, input.payrollRules);
  const taxStatus: TaxStatus = {
    ...input.taxStatus,
    employmentType: "employee",
    taxableBenefitMonthly: input.taxableBenefit + studyFundTaxableExcess,
  };

  const payslip = computePayslip({
    baseEarnings: earningLines,
    daysWorked: 0,
    workedMinutes: 0,
    components: [],
    oneOffBonuses: [],
    oneOffDeductions: [
      { key: "pensionFund", label: "Pension fund", amount: pensionEmployee },
      { key: "studyFund", label: "Study fund", amount: studyFundEmployee },
    ].filter((line) => line.amount > 0),
    taxRules: input.taxRules,
    taxStatus,
    creditPoints: {
      totalHundredths: input.creditPointsHundredths,
      lines: [{ code: "manual", hundredths: input.creditPointsHundredths }],
    },
    pensionCredit,
  });

  const pensionEmployer = applyBasisPoints(base, input.pensionEmployerBp);
  const severance = applyBasisPoints(base, input.severanceBp);
  const employerNationalInsurance = tieredInsurance(
    payslip.taxableIncome,
    input.taxRules.insuranceReducedThreshold,
    input.taxRules.insuranceCeiling,
    input.payrollRules.employerNationalInsurance,
  );

  return {
    payslip,
    pensionCredit: payslip.mandatory.pensionCredit,
    studyFundTaxableExcess,
    employer: {
      pension: pensionEmployer,
      severance,
      studyFund: studyFundEmployer,
      nationalInsurance: employerNationalInsurance,
      totalCost: payslip.gross + pensionEmployer + severance + studyFundEmployer + employerNationalInsurance,
    },
    savings: {
      pension: pensionEmployee + pensionEmployer + severance,
      studyFund: studyFundEmployee + studyFundEmployer,
    },
  };
}
