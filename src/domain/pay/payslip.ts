import type { MinorUnits } from "../money/money";
import type { CreditPointResult } from "../tax/credit-points";
import { calculateMandatoryDeductions, type MandatoryDeductions } from "../tax/mandatory-deductions";
import type { TaxRules } from "../tax/tax-rules";
import type { TaxStatus } from "../tax/tax-status";
import { componentAmount, type PayComponent } from "./pay-components";

/**
 * Builds a monthly payslip from earnings:
 *
 *   earnings (base + additions + one-off bonuses)        = gross
 *   − mandatory (income tax, national + health insurance)
 *   − voluntary (pension, study fund… + one-off deductions)
 *                                                          = net
 *
 * Used by the monthly report and by the quick salary calculator, so both
 * always agree.
 */

export type PayslipLine = {
  key: string;
  label: string;
  amount: MinorUnits;
  /** Earnings only: counted as taxable income. */
  taxable?: boolean;
};

export type PayslipInput = {
  /** Pay from work: shifts, overtime, paid days, salaries, tips… */
  baseEarnings: PayslipLine[];
  daysWorked: number;
  workedMinutes: number;
  /** Recurring additions and deductions (inactive / deleted ones are skipped). */
  components: PayComponent[];
  oneOffBonuses: { key: string; label: string; amount: MinorUnits; isTaxable: boolean }[];
  oneOffDeductions: { key: string; label: string; amount: MinorUnits }[];
  taxRules: TaxRules;
  taxStatus: TaxStatus;
  creditPoints: CreditPointResult;
};

export type Payslip = {
  earnings: PayslipLine[];
  gross: MinorUnits;
  /** Taxable earnings + taxable benefit (e.g. company car). */
  taxableIncome: MinorUnits;
  taxableBenefit: MinorUnits;
  mandatory: MandatoryDeductions;
  mandatoryLines: PayslipLine[];
  voluntaryLines: PayslipLine[];
  totalDeductions: MinorUnits;
  net: MinorUnits;
  creditPoints: CreditPointResult;
};

const sum = (lines: { amount: MinorUnits }[]) => lines.reduce((total, line) => total + line.amount, 0);

export function computePayslip(input: PayslipInput): Payslip {
  const active = input.components.filter((item) => item.isActive && !item.deletedAt);
  const byOrder = (a: PayComponent, b: PayComponent) => a.sortOrder - b.sortOrder;

  const baseEarnings = input.baseEarnings.map((line) => ({ ...line, taxable: line.taxable ?? true }));
  const basePay = sum(baseEarnings);

  const additionLines: PayslipLine[] = active
    .filter((item) => item.kind === "addition")
    .sort(byOrder)
    .map((item) => ({
      key: `component:${item.id}`,
      label: item.name,
      taxable: item.isTaxable,
      amount: componentAmount(item, {
        daysWorked: input.daysWorked,
        workedMinutes: input.workedMinutes,
        percentBase: basePay,
      }),
    }));
  const bonusLines: PayslipLine[] = input.oneOffBonuses.map((item) => ({
    key: item.key,
    label: item.label,
    amount: item.amount,
    taxable: item.isTaxable,
  }));

  const earnings = [...baseEarnings, ...additionLines, ...bonusLines];
  const gross = sum(earnings);
  const taxableBenefit = input.taxStatus.taxableBenefitMonthly;
  const taxableIncome = sum(earnings.filter((line) => line.taxable)) + taxableBenefit;

  const mandatory = calculateMandatoryDeductions({
    taxableIncome,
    creditPointsHundredths: input.creditPoints.totalHundredths,
    rules: input.taxRules,
    status: input.taxStatus,
  });
  const mandatoryLines: PayslipLine[] = [
    { key: "incomeTax", label: "Income tax", amount: mandatory.incomeTax },
    { key: "nationalInsurance", label: "National insurance", amount: mandatory.nationalInsurance },
    { key: "healthInsurance", label: "Health insurance", amount: mandatory.healthInsurance },
  ];

  const voluntaryLines: PayslipLine[] = [
    ...active
      .filter((item) => item.kind === "deduction")
      .sort(byOrder)
      .map((item) => ({
        key: `component:${item.id}`,
        label: item.name,
        amount: componentAmount(item, {
          daysWorked: input.daysWorked,
          workedMinutes: input.workedMinutes,
          percentBase: gross,
        }),
      })),
    ...input.oneOffDeductions.map((item) => ({ key: item.key, label: item.label, amount: item.amount })),
  ];

  const totalDeductions = mandatory.total + sum(voluntaryLines);
  return {
    earnings,
    gross,
    taxableIncome,
    taxableBenefit,
    mandatory,
    mandatoryLines,
    voluntaryLines,
    totalDeductions,
    net: gross - totalDeductions,
    creditPoints: input.creditPoints,
  };
}
