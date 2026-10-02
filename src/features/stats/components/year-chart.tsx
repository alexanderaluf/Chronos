import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";

import type { YearMonth } from "@/data/reports/period-report";
import { parsePeriodKey, type PeriodKey } from "@/domain/time/time";
import { useAppLocalization } from "@/localization/localization-provider";
import { formatStatementMoney as formatMoney, formatMonthLabel, formatShortMonthLabel } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { ValueRow } from "@/shared/ui/section";

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
  const { direction, language } = useAppLocalization();
  const max = Math.max(1, ...months.map((month) => month.net));
  const total = months.reduce((sum, month) => sum + month.net, 0);
  const selectedMonth = months.find((month) => month.periodKey === selected);
  const selectedDate = parsePeriodKey(selected);

  return (
    <View className="gap-5 p-5" style={{ direction }}>
      <View className="gap-1">
        <Text className="text-sm text-muted">{t("stats.netPerMonth")}</Text>
        <Text className="font-manrope-semibold text-xl" style={{ fontVariant: ["tabular-nums"] }}>
          {t("stats.yearTotal", { amount: formatMoney(total, currency) })}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 flex-row items-end gap-1" style={{ height: CHART_HEIGHT + 36, minWidth: months.length * 36 }}>
          {months.map((month) => {
            const { month: monthNumber, year } = parsePeriodKey(month.periodKey);
            const isSelected = month.periodKey === selected;
            return (
              <Pressable
                key={month.periodKey}
                accessibilityLabel={`${formatMonthLabel(new Date(year, monthNumber - 1, 1), language)}: ${formatMoney(month.net, currency)}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className="min-h-11 flex-1 items-center justify-end gap-2"
                style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                onPress={() => onSelect(month.periodKey)}
              >
                <View
                  className={`w-full rounded-full ${isSelected ? "bg-accent" : "bg-accent/20"}`}
                  style={{ height: Math.max(2, Math.round((month.net / max) * CHART_HEIGHT)) }}
                />
                <Text numberOfLines={1} className={`text-center text-[10px] ${isSelected ? "text-accent" : "text-muted"}`}>
                  {formatShortMonthLabel(new Date(year, monthNumber - 1, 1), language)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {selectedMonth ? (
        <View className="border-t-2 border-background pt-3">
          <ValueRow valueDirection="ltr" emphasis label={formatMonthLabel(new Date(selectedDate.year, selectedDate.month - 1, 1), language)} value={formatMoney(selectedMonth.net, currency)} valueClassName="text-accent" />
        </View>
      ) : null}
    </View>
  );
}
