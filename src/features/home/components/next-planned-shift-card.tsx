import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useNextPlannedShift } from "@/data/hooks/queries";
import { formatMinuteOfDay, fromLocalDateKey, toLocalDateKey } from "@/domain/time/time";
import { formatDayLabel } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon } from "@/shared/ui/filled-icon";
import { Panel } from "@/shared/ui/section";

/** The next shift from the weekly schedule, if one is planned. */
export function NextPlannedShiftCard() {
  const { t } = useTranslation();
  const next = useNextPlannedShift(toLocalDateKey(new Date()));
  if (!next.data) return null;
  const plan = next.data;
  const isToday = plan.date === toLocalDateKey(new Date());

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push("/tools/weekly-schedule")}>
      <Panel className="flex-row items-center gap-4 py-4">
        <FilledIcon name="week" size={24} tone="accent" />
        <View className="flex-1">
          <Text className="text-xs text-muted">{t("home.nextPlanned")}</Text>
          <Text className="text-base">
            {isToday ? t("home.today") : formatDayLabel(fromLocalDateKey(plan.date))} · {formatMinuteOfDay(plan.startMinute)}–
            {formatMinuteOfDay(plan.endMinute)}
          </Text>
        </View>
      </Panel>
    </Pressable>
  );
}
