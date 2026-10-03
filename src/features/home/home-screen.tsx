import { useTranslation } from "react-i18next";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePeriodReport } from "@/data/hooks/queries";
import { parsePeriodKey } from "@/domain/time/time";
import { useClockInOut } from "@/features/shifts/hooks/use-clock-in-out";
import { usePeriodNavigation } from "@/features/shifts/hooks/use-period-key";
import { useAppLocalization } from "@/localization/localization-provider";
import { formatDate, formatMonthLabel } from "@/shared/lib/format";
import { BOTTOM_NAVIGATION_CLEARANCE } from "@/shared/navigation/bottom-navigation";
import { Text, TextAlignmentProvider } from "@/shared/ui/app-text";
import { AppSpinner } from "@/shared/ui/controls/app-spinner";
import { FilledIcon } from "@/shared/ui/filled-icon";
import { PeriodSwitcher } from "@/shared/ui/period-switcher";
import { TopSafeAreaGradient } from "@/shared/ui/safe-area-gradients";

import { ActiveShiftCard } from "./components/active-shift-card";
import { HomeShiftRow } from "./components/home-shift-row";
import { NextPlannedShiftCard } from "./components/next-planned-shift-card";

/**
 * Home: what Calendar and Stats do not show. The running shift and the next
 * planned shift (current period only), then every shift of the period as one
 * flat list, newest first.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { language, direction } = useAppLocalization();
  const insets = useSafeAreaInsets();
  const navigation = usePeriodNavigation();
  const clock = useClockInOut();
  const report = usePeriodReport(navigation.periodKey);
  const selected = parsePeriodKey(navigation.periodKey);
  const summary = report.data?.period.key === navigation.periodKey ? report.data : undefined;
  // The report sorts oldest first.
  const shifts = [...(summary?.shifts ?? [])].reverse();
  const periodLabel = summary && summary.period.start.getDate() !== 1
    ? `${formatDate(summary.period.start)} – ${formatDate(new Date(summary.period.end.getTime() - 1))}`
    : formatMonthLabel(new Date(selected.year, selected.month - 1, 1), language);

  return (
    <TextAlignmentProvider>
      <View className="flex-1 bg-background" style={{ direction }}>
        <FlatList
          key={navigation.periodKey}
          className="flex-1"
          data={shifts}
          extraData={language}
          keyExtractor={(item) => item.shift.id}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + BOTTOM_NAVIGATION_CLEARANCE }}
          ListHeaderComponent={
            <View className="gap-4 px-5 pb-5">
              <Text accessibilityRole="header" className="font-manrope-bold text-3xl">{t("home.shiftListTitle")}</Text>
              {navigation.isCurrent && clock.openShift ? <ActiveShiftCard openShift={clock.openShift} onToggle={() => void clock.toggle()} /> : null}
              {navigation.isCurrent ? <NextPlannedShiftCard /> : null}
              <PeriodSwitcher label={periodLabel} onNext={navigation.next} onPrevious={navigation.previous} onReset={navigation.reset} />
            </View>
          }
          renderItem={({ item }) => <HomeShiftRow item={item} />}
          ItemSeparatorComponent={() => <View className="h-2.5" />}
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
