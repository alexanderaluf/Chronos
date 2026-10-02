import { useTranslation } from "react-i18next";
import { SectionList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePeriodReport } from "@/data/hooks/queries";
import type { ShiftWithPay } from "@/domain/pay/period-summary";
import { fromIso, fromLocalDateKey, parsePeriodKey, toLocalDateKey } from "@/domain/time/time";
import { usePeriodNavigation } from "@/features/shifts/hooks/use-period-key";
import { useAppLocalization } from "@/localization/localization-provider";
import { formatDayLabel, formatMonthLabel } from "@/shared/lib/format";
import { BOTTOM_NAVIGATION_CLEARANCE } from "@/shared/navigation/bottom-navigation";
import { Text, TextAlignmentProvider } from "@/shared/ui/app-text";
import { AppSpinner } from "@/shared/ui/controls/app-spinner";
import { FilledIcon } from "@/shared/ui/filled-icon";
import { PeriodSwitcher } from "@/shared/ui/period-switcher";
import { TopSafeAreaGradient } from "@/shared/ui/safe-area-gradients";

import { HomeShiftRow } from "./components/home-shift-row";

/** Home is a browsable shift ledger, grouped by the day each shift started. */
export function HomeScreen() {
  const { t } = useTranslation();
  const { language, direction } = useAppLocalization();
  const insets = useSafeAreaInsets();
  const navigation = usePeriodNavigation();
  const report = usePeriodReport(navigation.periodKey);
  const selected = parsePeriodKey(navigation.periodKey);
  const summary = report.data?.period.key === navigation.periodKey ? report.data : undefined;
  const groups = new Map<string, ShiftWithPay[]>();

  for (const item of [...(summary?.shifts ?? [])].reverse()) {
    const day = toLocalDateKey(fromIso(item.shift.startAt));
    const shifts = groups.get(day) ?? [];
    shifts.push(item);
    groups.set(day, shifts);
  }
  const sections = [...groups].map(([date, data]) => ({ date, data }));
  const periodLabel = summary && summary.period.start.getDate() !== 1
    ? `${formatDayLabel(summary.period.start, language)} – ${formatDayLabel(new Date(summary.period.end.getTime() - 1), language)}`
    : formatMonthLabel(new Date(selected.year, selected.month - 1, 1), language);

  return (
    <TextAlignmentProvider>
      <View className="flex-1 bg-background" style={{ direction }}>
        <SectionList
          key={navigation.periodKey}
          className="flex-1"
          sections={sections}
          extraData={language}
          keyExtractor={(item) => item.shift.id}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + BOTTOM_NAVIGATION_CLEARANCE }}
          ListHeaderComponent={
            <View className="gap-5 px-5 pb-6">
              <Text accessibilityRole="header" className="font-manrope-bold text-3xl">{t("home.shiftListTitle")}</Text>
              <PeriodSwitcher label={periodLabel} onNext={navigation.next} onPrevious={navigation.previous} onReset={navigation.reset} />
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View className="border-y border-separator/15 bg-surface-secondary/45 px-5 py-3">
              <Text accessibilityRole="header" className="font-manrope-semibold text-sm text-muted">
                {formatDayLabel(fromLocalDateKey(section.date), language)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => <HomeShiftRow item={item} />}
          ItemSeparatorComponent={() => <View className="mx-5 h-px bg-separator/20" />}
          SectionSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={
            <View className="min-h-64 gap-4 px-6 py-10">
              {!summary && !report.error ? (
                <View className="items-center gap-4">
                  <AppSpinner />
                  <Text className="text-center text-sm text-muted">{t("common.loading")}</Text>
                </View>
              ) : (
                <View className="items-center gap-4">
                  <View className="size-16 items-center justify-center rounded-full bg-surface-secondary">
                    <FilledIcon name="work" size={30} tone="muted" />
                  </View>
                  <Text className="text-center font-manrope-semibold text-lg">{t(report.error ? "home.shiftListError" : "home.shiftListEmpty")}</Text>
                  {!report.error ? <Text className="text-center text-sm leading-5 text-muted">{t("home.shiftListHint")}</Text> : null}
                </View>
              )}
            </View>
          }
        />
        <TopSafeAreaGradient headerHidden />
      </View>
    </TextAlignmentProvider>
  );
}
