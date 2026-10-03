import { router } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import type { ShiftWithPay } from "@/domain/pay/period-summary";
import { fromIso, startOfLocalDay, toLocalDateKey } from "@/domain/time/time";
import { useAppLocalization } from "@/localization/localization-provider";
import { formatDayLabel, formatHours, formatStatementMoney, formatTime } from "@/shared/lib/format";
import { colorWithAlpha } from "@/shared/theme/app-theme";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon, type FilledIconName } from "@/shared/ui/filled-icon";

type ChipTone = "muted" | "accent" | "warning";
type Chip = { icon: FilledIconName; label: string; tone: ChipTone };

const CHIP_TEXT: Record<ChipTone, string> = { muted: "text-muted", accent: "text-accent", warning: "text-warning" };

function ShiftChip({ chip, colors }: { chip: Chip; colors: Record<ChipTone, string> }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-background px-2.5 py-1">
      <FilledIcon color={colors[chip.tone]} name={chip.icon} size={13} />
      <Text className={`text-xs ${CHIP_TEXT[chip.tone]}`} style={{ fontVariant: ["tabular-nums"] }}>{chip.label}</Text>
    </View>
  );
}

/** Weekday + day number, tinted with the shift color. Today uses the accent. */
function DateTile({ date, color }: { date: Date; color: string }) {
  const { t } = useTranslation();
  const isToday = toLocalDateKey(date) === toLocalDateKey(new Date());
  const weekday = t("dates.shortWeekdays", { returnObjects: true })[date.getDay()];

  return (
    <View
      className={`h-16 w-14 items-center justify-center gap-0.5 rounded-[18px] ${isToday ? "bg-accent" : ""}`}
      style={isToday ? undefined : { backgroundColor: colorWithAlpha(color, 0.18) }}
    >
      <Text className={`text-center text-xs ${isToday ? "text-accent-foreground" : "text-muted"}`}>{weekday}</Text>
      <Text className={`text-center font-manrope-bold text-xl ${isToday ? "text-accent-foreground" : ""}`} style={{ fontVariant: ["tabular-nums"] }}>
        {date.getDate()}
      </Text>
    </View>
  );
}

/**
 * One shift as a compact card: date tile, name, times, pay and hours, then
 * chips for what changed the pay (night, overtime, rest day, holiday, break,
 * bonus, tips) and the shift note. The whole card opens the editor.
 */
export function HomeShiftRow({ item }: { item: ShiftWithPay }) {
  const { t } = useTranslation();
  const { direction, language, isRTL } = useAppLocalization();
  const [muted, accent, warning] = useThemeColor(["muted", "accent", "warning"]);
  const { shift, job, pay } = item;
  const start = fromIso(shift.startAt);
  const end = shift.endAt ? fromIso(shift.endAt) : null;
  // Calendar days between start and end (rounded, so DST days still count as one).
  const extraDays = end ? Math.round((startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) / 86_400_000) : 0;
  const times = `${formatTime(start)} – ${end ? formatTime(end) : t("shiftRow.now")}`;
  const amount = formatStatementMoney(pay.total, job.currencyCode);
  const title = shift.label || job.name;
  const note = shift.note?.trim();

  const chips: Chip[] = [];
  if (pay.isNightShift) chips.push({ icon: "night", label: t("home.row.night"), tone: "muted" });
  if (pay.overtimeMinutes > 0) chips.push({ icon: "more-time", label: t("home.row.overtime", { hours: formatHours(pay.overtimeMinutes) }), tone: "warning" });
  if (pay.isRestDay) chips.push({ icon: "weekend", label: t("home.row.restDay"), tone: "accent" });
  if (pay.holidayMinutes > 0) chips.push({ icon: "celebration", label: t("home.row.holiday", { hours: formatHours(pay.holidayMinutes) }), tone: "accent" });
  if (shift.breakMinutes > 0) chips.push({ icon: "coffee", label: t("home.row.break", { minutes: shift.breakMinutes }), tone: "muted" });
  if (pay.bonus > 0) chips.push({ icon: "gift", label: t("home.row.bonus", { amount: formatStatementMoney(pay.bonus, job.currencyCode) }), tone: "muted" });
  if (pay.tips > 0) chips.push({ icon: "tips", label: t("home.row.tips", { amount: formatStatementMoney(pay.tips, job.currencyCode) }), tone: "muted" });

  const accessibilityLabel = [
    formatDayLabel(start, language),
    title,
    shift.label ? job.name : null,
    times,
    formatHours(pay.workedMinutes),
    amount,
    ...chips.map((chip) => chip.label),
    note ? t("home.row.note", { note }) : null,
  ].filter(Boolean).join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="mx-5 flex-row gap-4 rounded-[24px] bg-surface p-4 active:opacity-80"
      style={{ direction }}
      onPress={() => router.push(`/shifts/${shift.id}`)}
    >
      <DateTile color={shift.color ?? job.color} date={start} />
      <View className="min-w-0 flex-1 gap-2.5">
        <View className="min-h-16 flex-row items-center gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-manrope-semibold text-base" numberOfLines={1}>{title}</Text>
            <Text className="text-sm text-muted" style={{ fontVariant: ["tabular-nums"] }}>
              {times}
              {extraDays > 0 ? <Text className="text-xs text-muted">{` +${extraDays}`}</Text> : null}
            </Text>
            {shift.label ? <Text className="text-xs text-muted" numberOfLines={1}>{job.name}</Text> : null}
          </View>
          <View className="max-w-[45%] shrink items-end gap-1">
            <Text className="font-manrope-semibold text-base" style={{ direction: "ltr", writingDirection: "ltr", textAlign: isRTL ? "left" : "right", fontVariant: ["tabular-nums"] }}>{amount}</Text>
            <Text className="text-xs text-muted" style={{ direction: "ltr", textAlign: isRTL ? "left" : "right", fontVariant: ["tabular-nums"] }}>{formatHours(pay.workedMinutes)}</Text>
          </View>
        </View>
        {chips.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {chips.map((chip) => <ShiftChip key={chip.icon} chip={chip} colors={{ muted, accent, warning }} />)}
          </View>
        ) : null}
        {note ? (
          <View className="flex-row items-center gap-1.5">
            <FilledIcon name="notes" size={14} tone="muted" />
            <Text className="min-w-0 flex-1 text-xs text-muted" numberOfLines={1}>{note}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
