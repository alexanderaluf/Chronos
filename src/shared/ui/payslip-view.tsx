import { View } from "react-native";
import { useTranslation } from "react-i18next";

import type { Payslip, PayslipLine } from "@/domain/pay/payslip";
import { payslipLineLabel } from "@/localization/labels";
import { formatStatementMoney, formatNumber } from "@/shared/lib/format";

import { Text } from "./app-text";
import { FormSection } from "./form/fields";
import { ValueRow } from "./section";

type Tone = "earning" | "deduction" | "total";

function Line({ label, amount, tone, currency, note }: { label: string; amount: number; tone: Tone; currency: string; note?: string }) {
  const color = tone === "earning" ? "text-success" : tone === "deduction" ? "text-danger" : "text-foreground";
  return (
    <ValueRow
      className={`min-h-14 border-b-2 border-background px-5 py-4 ${tone === "total" ? "bg-surface-secondary/60" : ""}`}
      emphasis={tone === "total"}
      label={label}
      note={note}
      value={formatStatementMoney(tone === "deduction" && amount > 0 ? -amount : amount, currency)}
      valueDirection="ltr"
      valueClassName={color}
    />
  );
}

function GroupTitle({ children }: { children: string }) {
  return <Text className="px-5 pb-2 pt-5 font-manrope-semibold text-xs text-muted">{children}</Text>;
}

/**
 * A payslip: earnings → gross → mandatory deductions → voluntary deductions → net.
 * Used by "My salary" (Stats) and the quick calculator.
 */
export function PayslipView({ payslip, currency, grouped = false }: { payslip: Payslip; currency: string; grouped?: boolean }) {
  const { t } = useTranslation();
  const earningLine = (line: PayslipLine) => (
    <Line
      key={line.key}
      amount={line.amount}
      currency={currency}
      label={payslipLineLabel(line)}
      note={line.taxable === false ? t("payslip.notTaxable") : undefined}
      tone="earning"
    />
  );
  const [base, ...additions] = payslip.earnings;

  const earnings = (
    <>
      {base ? earningLine(base) : null}
      {additions.length > 0 ? <GroupTitle>{t("payslip.additions")}</GroupTitle> : null}
      {additions.map(earningLine)}
      <Line amount={payslip.gross} currency={currency} label={t("payslip.grossSalary")} tone="total" />
      {payslip.taxableBenefit > 0 ? (
        <Line amount={payslip.taxableBenefit} currency={currency} label={t("payslip.taxableBenefit")} note={t("payslip.taxableBenefitNote")} tone="total" />
      ) : null}
    </>
  );
  const mandatory = (
    <>
      {payslip.mandatoryLines.map((line) => (
        <Line
          key={line.key}
          amount={line.amount}
          currency={currency}
          label={payslipLineLabel(line)}
          note={
            line.key === "incomeTax"
              ? t("payslip.creditPoints", { points: formatNumber(payslip.creditPoints.totalHundredths / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
              : undefined
          }
          tone="deduction"
        />
      ))}
    </>
  );
  const voluntary = (
    <>
      {payslip.voluntaryLines.map((line) => (
        <Line key={line.key} amount={line.amount} currency={currency} label={payslipLineLabel(line)} tone="deduction" />
      ))}
    </>
  );
  const net = <Line amount={payslip.net} currency={currency} label={t("payslip.netSalary")} tone="total" />;

  if (grouped) {
    return (
      <View className="gap-6">
        <FormSection title={t("stats.breakdown")}>{earnings}</FormSection>
        <FormSection title={t("payslip.mandatory")}>{mandatory}</FormSection>
        {payslip.voluntaryLines.length > 0 ? (
          <FormSection title={t("payslip.voluntary")}>{voluntary}</FormSection>
        ) : null}
        <View className="gap-3">
          <View className="overflow-hidden rounded-[28px] bg-surface">{net}</View>
          <Text className="px-1 text-xs leading-4 text-muted">{t("stats.estimateNote")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-[28px] bg-surface">
      {earnings}
      <GroupTitle>{t("payslip.mandatory")}</GroupTitle>
      {mandatory}
      {payslip.voluntaryLines.length > 0 ? <GroupTitle>{t("payslip.voluntary")}</GroupTitle> : null}
      {voluntary}
      {net}
    </View>
  );
}
