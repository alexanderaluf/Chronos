import { View } from "react-native";
import { useTranslation } from "react-i18next";

import type { Payslip, PayslipLine } from "@/domain/pay/payslip";
import { payslipLineLabel } from "@/localization/labels";
import { formatMoney } from "@/shared/lib/format";

import { Text } from "./app-text";

type Tone = "earning" | "deduction" | "total";

function Line({ label, amount, tone, currency, note }: { label: string; amount: number; tone: Tone; currency: string; note?: string }) {
  const color = tone === "earning" ? "text-success" : tone === "deduction" ? "text-danger" : "text-foreground";
  return (
    <View className={`flex-row items-center justify-between px-4 py-3 ${tone === "total" ? "bg-surface-secondary" : "border-b border-separator/40"}`}>
      <View className="flex-1">
        <Text className={tone === "total" ? "text-lg" : "text-base"}>{label}</Text>
        {note ? <Text className="text-xs text-muted">{note}</Text> : null}
      </View>
      <Text className={`${tone === "total" ? "text-lg" : "text-base"} ${color}`} style={{ fontVariant: ["tabular-nums"] }}>
        {tone === "deduction" && amount > 0 ? "−" : ""}
        {formatMoney(amount, currency)}
      </Text>
    </View>
  );
}

function GroupTitle({ children }: { children: string }) {
  return <Text className="px-4 pb-1 pt-3 text-center text-xs text-muted">{children}</Text>;
}

/**
 * A payslip: earnings → gross → mandatory deductions → voluntary deductions → net.
 * Used by "My salary" (Stats) and the quick calculator.
 */
export function PayslipView({ payslip, currency }: { payslip: Payslip; currency: string }) {
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

  return (
    <View className="overflow-hidden rounded-2xl bg-surface">
      {base ? earningLine(base) : null}
      {additions.length > 0 ? <GroupTitle>{t("payslip.additions")}</GroupTitle> : null}
      {additions.map(earningLine)}
      <Line amount={payslip.gross} currency={currency} label={t("payslip.grossSalary")} tone="total" />
      {payslip.taxableBenefit > 0 ? (
        <Line amount={payslip.taxableBenefit} currency={currency} label={t("payslip.taxableBenefit")} note={t("payslip.taxableBenefitNote")} tone="total" />
      ) : null}

      <GroupTitle>{t("payslip.mandatory")}</GroupTitle>
      {payslip.mandatoryLines.map((line) => (
        <Line
          key={line.key}
          amount={line.amount}
          currency={currency}
          label={payslipLineLabel(line)}
          note={
            line.key === "incomeTax"
              ? t("payslip.creditPoints", { points: (payslip.creditPoints.totalHundredths / 100).toFixed(2) })
              : undefined
          }
          tone="deduction"
        />
      ))}

      {payslip.voluntaryLines.length > 0 ? <GroupTitle>{t("payslip.voluntary")}</GroupTitle> : null}
      {payslip.voluntaryLines.map((line) => (
        <Line key={line.key} amount={line.amount} currency={currency} label={payslipLineLabel(line)} tone="deduction" />
      ))}

      <Line amount={payslip.net} currency={currency} label={t("payslip.netSalary")} tone="total" />
    </View>
  );
}
