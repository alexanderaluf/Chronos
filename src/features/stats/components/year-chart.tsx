import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import type { YearMonth } from "@/data/reports/period-report";
import { parsePeriodKey, type PeriodKey } from "@/domain/time/time";
import { formatMoney, getAppLocale } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";

const CHART_HEIGHT = 120;

/** Net salary per month as bars. Tap a month to open it. */
export function YearChart({
  months,
  selected,
  currency,
  onSelect,
}: {
  months: YearMonth[];
  selected: PeriodKey;
  currency: string;
  onSelect: (periodKey: PeriodKey) => void;
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...months.map((month) => month.net));
  const total = months.reduce((sum, month) => sum + month.net, 0);

  return (
    <View className="gap-3 rounded-2xl bg-surface p-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm text-muted">{t("stats.netPerMonth")}</Text>
        <Text className="text-sm">{t("stats.yearTotal", { amount: formatMoney(total, currency) })}</Text>
      </View>
      <View className="flex-row items-end gap-1" style={{ height: CHART_HEIGHT + 18 }}>
        {months.map((month) => {
          const { month: monthNumber, year } = parsePeriodKey(month.periodKey);
          const isSelected = month.periodKey === selected;
          return (
            <Pressable
              key={month.periodKey}
              accessibilityLabel={`${month.periodKey}: ${formatMoney(month.net, currency)}`}
              accessibilityRole="button"
              className="flex-1 items-center justify-end gap-1"
              onPress={() => onSelect(month.periodKey)}
            >
              <View
                className={`w-full rounded-md ${isSelected ? "bg-accent" : "bg-accent/35"}`}
                style={{ height: Math.max(2, Math.round((month.net / max) * CHART_HEIGHT)) }}
              />
              <Text className={`text-[10px] ${isSelected ? "text-accent" : "text-muted"}`}>
                {new Date(year, monthNumber - 1, 1).toLocaleDateString(getAppLocale(), { month: "narrow" })}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
