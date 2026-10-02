import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import type { PaidDayWithPay, ShiftWithPay } from "@/domain/pay/period-summary";
import { fromIso, fromLocalDateKey } from "@/domain/time/time";
import { formatDayLabel, formatHours, formatMoney, formatTime } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon } from "@/shared/ui/filled-icon";

/** One finished shift: color, day, times, duration, badges and pay. Tap to edit. */
export function ShiftRow({ item }: { item: ShiftWithPay }) {
  const { t } = useTranslation();
  const { shift, job, pay } = item;
  const start = fromIso(shift.startAt);
  const end = shift.endAt ? fromIso(shift.endAt) : null;

  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-3 py-2.5 active:opacity-70"
      onPress={() => router.push(`/shifts/${shift.id}`)}
    >
      <View className="h-9 w-1.5 rounded-full" style={{ backgroundColor: shift.color ?? job.color }} />
      <View className="flex-1">
        <Text className="text-sm">
          {formatDayLabel(start)}
          {shift.label ? ` · ${shift.label}` : ""}
        </Text>
        <Text className="text-xs text-muted">
          {formatTime(start)} – {end ? formatTime(end) : t("shiftRow.now")} · {formatHours(pay.workedMinutes)}
        </Text>
        {pay.holidayMinutes > 0 ? <Text className="text-xs text-accent">{t("holidayPay.saved", { hours: formatHours(pay.holidayMinutes) })}</Text> : null}
      </View>
      {pay.isNightShift ? <FilledIcon name="night" size={16} tone="muted" /> : null}
      {pay.overtimeMinutes > 0 ? <Text className="text-xs text-warning">{t("shiftRow.overtimeBadge")}</Text> : null}
      <Text className="text-sm" style={{ fontVariant: ["tabular-nums"] }}>
        {formatMoney(pay.total, job.currencyCode)}
      </Text>
    </Pressable>
  );
}

/** A vacation / sick / holiday day. Tap to edit. */
export function PaidDayRow({ item }: { item: PaidDayWithPay }) {
  const { t } = useTranslation();
  const { paidDay, job, amount } = item;
  return (
    <Pressable
      accessibilityRole="button"
      className="flex-row items-center gap-3 py-2.5 active:opacity-70"
      onPress={() => router.push(`/paid-days/${paidDay.id}`)}
    >
      <FilledIcon name={paidDay.kind === "sick" ? "sick" : "beach"} size={20} tone="accent" />
      <View className="flex-1">
        <Text className="text-sm">
          {formatDayLabel(fromLocalDateKey(paidDay.date))} · {t(`shiftRow.kinds.${paidDay.kind}`)}
        </Text>
        <Text className="text-xs text-muted">
          {t("shiftRow.paidAt", { hours: formatHours(paidDay.minutes), percent: paidDay.rateBp / 100 })}
        </Text>
      </View>
      <Text className="text-sm" style={{ fontVariant: ["tabular-nums"] }}>
        {formatMoney(amount, job.currencyCode)}
      </Text>
    </Pressable>
  );
}
