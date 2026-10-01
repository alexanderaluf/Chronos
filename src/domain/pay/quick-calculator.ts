import type { PayComponent } from "../entities";
import { payForMinutes, type BasisPoints, type MinorUnits } from "../money/money";
import type { TaxRules } from "../tax/tax-rules";
import type { TaxStatus } from "../tax/tax-status";
import { computePayslip, type Payslip } from "./payslip";

export type QuickCalculatorInput = {
  hourlyRate: MinorUnits;
  regularMinutes: number;
  overtimeMinutes: number;
  overtimeRateBp: BasisPoints;
  workDays: number;
  travelPerDay: MinorUnits;
  creditPointsHundredths: number;
  taxRules: TaxRules;
  taxStatus: TaxStatus;
  /** The user's recurring deductions (pension…) — pass [] to ignore them. */
  deductions: PayComponent[];
};

/** "What would I earn?" without recording shifts. Same payslip logic as the monthly report. */
export function quickSalaryEstimate(input: QuickCalculatorInput): Payslip {
  return computePayslip({
    baseEarnings: [
      { key: "basePay", label: "Base pay", amount: payForMinutes(input.hourlyRate, input.regularMinutes) },
      {
        key: "overtime",
        label: "Overtime",
        amount: payForMinutes(input.hourlyRate, input.overtimeMinutes, input.overtimeRateBp),
      },
      { key: "travel", label: "Travel", amount: input.travelPerDay * input.workDays },
    ].filter((line) => line.key === "basePay" || line.amount > 0),
    daysWorked: input.workDays,
    workedMinutes: input.regularMinutes + input.overtimeMinutes,
    components: input.deductions.filter((item) => item.kind === "deduction"),
    oneOffBonuses: [],
    oneOffDeductions: [],
    taxRules: input.taxRules,
    taxStatus: input.taxStatus,
    creditPoints: {
      totalHundredths: input.creditPointsHundredths,
      lines: [{ code: "manual", hundredths: input.creditPointsHundredths }],
    },
  });
}
