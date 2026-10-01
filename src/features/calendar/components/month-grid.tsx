import { Pressable, View } from "react-native";

import type { DaySummary } from "@/domain/pay/period-summary";
import { toLocalDateKey, type LocalDateKey } from "@/domain/time/time";
import { useAppLocalization } from "@/localization/localization-provider";
import { getAppLocale } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";

type MonthGridProps = {
  year: number;
  /** 1–12 */
  month: number;
  weekStartDay: number;
  /** "rtl" lays weeks out right to left (Sunday on the right). */
  direction: "ltr" | "rtl";
  days: Record<LocalDateKey, DaySummary>;
  selected: LocalDateKey | null;
  onSelect: (date: LocalDateKey) => void;
};

function weekdayLabels(weekStartDay: number) {
  // 4 Jan 2026 is a Sunday.
  return Array.from({ length: 7 }, (_, index) =>
    new Date(2026, 0, 4 + ((weekStartDay + index) % 7)).toLocaleDateString(getAppLocale(), { weekday: "narrow" }),
  );
}

/** A month calendar. Days with shifts show a dot; the selected day is highlighted. */
export function MonthGrid({ year, month, weekStartDay, direction, days, selected, onSelect }: MonthGridProps) {
  // The app layout is already RTL in Hebrew; the setting is about the visual order of days.
  const { isRTL } = useAppLocalization();
  const rowDirection = (direction === "rtl") !== isRTL ? "row-reverse" : "row";
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leading = (first.getDay() - weekStartDay + 7) % 7;
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, month - 1, index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const today = toLocalDateKey(new Date());

  return (
    <View className="gap-1">
      <View style={{ flexDirection: rowDirection }}>
        {weekdayLabels(weekStartDay).map((label, index) => (
          <Text key={index} className="flex-1 text-center text-xs text-muted">
            {label}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <View key={week} style={{ flexDirection: rowDirection }}>
          {cells.slice(week * 7, week * 7 + 7).map((date, index) => {
            if (!date) return <View key={index} className="aspect-square flex-1" />;
            const key = toLocalDateKey(date);
            const isSelected = key === selected;
            const hasShifts = Boolean(days[key]?.shiftCount);
            const hasPaidDay = Boolean(days[key]?.paidDayCount);
            return (
              <Pressable
                key={key}
                accessibilityLabel={date.toDateString()}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={`aspect-square flex-1 items-center justify-center rounded-2xl ${isSelected ? "bg-accent" : ""}`}
                onPress={() => onSelect(key)}
              >
                <Text
                  className={`text-sm ${isSelected ? "text-accent-foreground" : key === today ? "text-accent" : ""}`}
                >
                  {date.getDate()}
                </Text>
                <View className="mt-1 flex-row gap-0.5">
                  <View
                    className={`size-1.5 rounded-full ${hasShifts ? (isSelected ? "bg-accent-foreground" : "bg-accent") : ""}`}
                  />
                  {hasPaidDay ? (
                    <View className={`size-1.5 rounded-full ${isSelected ? "bg-accent-foreground" : "bg-success"}`} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
