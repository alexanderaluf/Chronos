import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import type { ShiftWithPay } from "@/domain/pay/period-summary";
import { fromIso } from "@/domain/time/time";
import { useAppLocalization } from "@/localization/localization-provider";
import { formatDayLabel, formatHours, formatStatementMoney, formatTime } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";

/** A flat ledger row with a job-color marker; the entire row opens the editor. */
export function HomeShiftRow({ item }: { item: ShiftWithPay }) {
  const { t } = useTranslation();
  const { direction, language, isRTL } = useAppLocalization();
  const { shift, job, pay } = item;
  const start = fromIso(shift.startAt);
  const end = shift.endAt ? fromIso(shift.endAt) : null;
  const times = `${formatTime(start)} – ${end ? formatTime(end) : t("shiftRow.now")}`;
  const amount = formatStatementMoney(pay.total, job.currencyCode);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDayLabel(start, language)}, ${shift.label || job.name}, ${times}, ${formatHours(pay.workedMinutes)}, ${amount}`}
      className="min-h-24 flex-row items-center gap-4 px-5 py-5 active:bg-surface"
      style={{ direction }}
      onPress={() => router.push(`/shifts/${shift.id}`)}
    >
      <View className="h-11 w-1 rounded-full" style={{ backgroundColor: shift.color ?? job.color }} />
      <View className="min-w-0 flex-1 gap-1.5">
        <Text className="font-manrope-semibold text-base">{shift.label || job.name}</Text>
        <Text className="text-sm text-muted">{times}</Text>
        {pay.holidayMinutes > 0 ? <Text className="text-xs text-accent">{t("holidayPay.saved", { hours: formatHours(pay.holidayMinutes) })}</Text> : null}
        {shift.label || pay.isNightShift || pay.overtimeMinutes > 0 ? (
          <View className="flex-row flex-wrap items-center gap-2">
            {shift.label ? <Text className="text-xs text-muted">{job.name}</Text> : null}
            {pay.isNightShift ? <Text className="text-xs text-muted">{t("home.nightShift")}</Text> : null}
            {pay.overtimeMinutes > 0 ? <Text className="text-xs text-warning">{t("home.overtime", { hours: formatHours(pay.overtimeMinutes) })}</Text> : null}
          </View>
        ) : null}
      </View>
      <View className="max-w-[38%] shrink items-end gap-1.5">
        <Text className="font-manrope-semibold text-base" style={{ direction: "ltr", writingDirection: "ltr", textAlign: isRTL ? "left" : "right", fontVariant: ["tabular-nums"] }}>{amount}</Text>
        <Text className="text-xs text-muted" style={{ direction: "ltr", textAlign: isRTL ? "left" : "right", fontVariant: ["tabular-nums"] }}>{formatHours(pay.workedMinutes)}</Text>
      </View>
    </Pressable>
  );
}
