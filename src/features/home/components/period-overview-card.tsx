import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import type { PeriodSummary } from "@/domain/pay/period-summary";
import { formatHours, formatMoney } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { Panel } from "@/shared/ui/section";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-1">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-lg" style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}

/** This period at a glance. Tapping opens the full payslip on the Stats tab. */
export function PeriodOverviewCard({ summary, currency }: { summary: PeriodSummary; currency: string }) {
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.replace("/stats")}>
      <Panel className="gap-5">
        <View className="gap-1">
          <Text className="text-sm text-muted">{t("home.netEstimate")}</Text>
          <Text className="text-4xl" style={{ fontVariant: ["tabular-nums"] }}>
            {formatMoney(summary.payslip.net, currency)}
          </Text>
        </View>
        <View className="flex-row gap-4">
          <Metric label={t("home.gross")} value={formatMoney(summary.payslip.gross, currency)} />
          <Metric label={t("home.hours")} value={formatHours(summary.workedMinutes)} />
          <Metric label={t("home.shifts")} value={String(summary.shiftCount)} />
        </View>
      </Panel>
    </Pressable>
  );
}
