import type { PayComponent } from "@/domain/entities";
import type { PayslipLine } from "@/domain/pay/payslip";
import type { CreditPointLine } from "@/domain/tax/credit-points";

import { i18n } from "./i18n";

/**
 * Translations for labels the domain layer produces as codes / keys.
 * Names the user typed (pension fund, a bonus description) are shown as-is.
 */

const FIXED_LINES = [
  "basePay",
  "overtime",
  "nightPremium",
  "holidayPremium",
  "paidDays",
  "shiftBonuses",
  "tips",
  "travel",
  "incomeTax",
  "nationalInsurance",
  "healthInsurance",
] as const;

export function payslipLineLabel(line: PayslipLine): string {
  if ((FIXED_LINES as readonly string[]).includes(line.key)) {
    return i18n.t(`payslip.lines.${line.key as (typeof FIXED_LINES)[number]}`);
  }
  if (line.key.startsWith("salary:")) {
    return i18n.t("payslip.lines.salary", { job: line.label });
  }
  if (line.key.startsWith("component:")) {
    if (line.label === "Pension fund") return i18n.t("payslip.lines.pensionFund");
    if (line.label === "Study fund") return i18n.t("payslip.lines.studyFund");
    if (line.label === "Travel") return i18n.t("payslip.lines.travel");
    if (line.label.startsWith("Travel — ")) {
      return i18n.t("payslip.lines.travelForJob", { job: line.label.slice("Travel — ".length) });
    }
  }
  return line.label;
}

export function creditPointLineLabel(line: CreditPointLine): string {
  if (line.code === "child") {
    return i18n.t("personal.lines.child", { number: line.childNumber, age: line.childAge });
  }
  return i18n.t(`personal.lines.${line.code}`);
}

/** "₪11 per work day", "5% of gross"… */
export function describePayComponent(component: PayComponent, formatMoney: (amount: number) => string, formatPercentValue?: (percent: number) => string): string {
  if (component.calculation === "percentOfGross") {
    const percent = component.rateBp / 100;
    const value = formatPercentValue ? formatPercentValue(percent) : Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
    return component.kind === "deduction"
      ? i18n.t("components.describe.percentOfGross", { percent: value })
      : i18n.t("components.describe.percentOfBase", { percent: value });
  }
  return i18n.t(`components.describe.${component.calculation}`, { amount: formatMoney(component.amount) });
}
