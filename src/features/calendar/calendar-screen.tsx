import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { usePeriodReport, useSettings } from "@/data/hooks/queries";
import { fromIso, fromLocalDateKey, parsePeriodKey, toLocalDateKey, type LocalDateKey } from "@/domain/time/time";
import { PaidDayRow, ShiftRow } from "@/features/shifts/components/shift-row";
import { usePeriodNavigation } from "@/features/shifts/hooks/use-period-key";
import { usePrimaryCurrency } from "@/features/shifts/hooks/use-primary-currency";
import { formatDayLabel, formatHours, formatMoney, formatMonthLabel } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { PeriodSwitcher } from "@/shared/ui/period-switcher";
import { Panel, QueryState, Section } from "@/shared/ui/section";
import { TabPage } from "@/shared/ui/tab-page";

import { MonthGrid } from "./components/month-grid";

function DayAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" className="flex-1 items-center rounded-xl bg-surface-secondary py-2.5 active:opacity-70" onPress={onPress}>
      <Text className="text-sm text-accent">{label}</Text>
    </Pressable>
  );
}

export function CalendarScreen() {
  const { t } = useTranslation();
  const navigation = usePeriodNavigation();
  const { year, month } = parsePeriodKey(navigation.periodKey);
  const report = usePeriodReport(navigation.periodKey);
  const settings = useSettings();
  const currency = usePrimaryCurrency();
  const [selected, setSelected] = useState<LocalDateKey>(() => toLocalDateKey(new Date()));

  const day = report.data?.days[selected];
  const dayShifts = report.data?.shifts.filter((item) => toLocalDateKey(fromIso(item.shift.startAt)) === selected) ?? [];
  const dayPaid = report.data?.paidDays.filter((item) => item.paidDay.date === selected) ?? [];

  return (
    <TabPage>
      <PeriodSwitcher
        label={formatMonthLabel(new Date(year, month - 1, 1))}
        onNext={navigation.next}
        onPrevious={navigation.previous}
        onReset={navigation.reset}
      />
      <Panel>
        {report.data ? (
          <MonthGrid
            days={report.data.days}
            direction={settings.data?.calendarDirection ?? "ltr"}
            month={month}
            selected={selected}
            weekStartDay={settings.data?.weekStartDay ?? 0}
            year={year}
            onSelect={setSelected}
          />
        ) : (
          <QueryState error={report.error} />
        )}
      </Panel>
      <Section
        action={
          day ? (
            <Text className="text-sm text-muted">
              {formatHours(day.workedMinutes)} · {formatMoney(day.earned, currency)}
            </Text>
          ) : null
        }
        title={formatDayLabel(fromLocalDateKey(selected))}
      >
        <Panel className="gap-2 py-3">
          {dayShifts.map((item) => (
            <ShiftRow key={item.shift.id} item={item} />
          ))}
          {dayPaid.map((item) => (
            <PaidDayRow key={item.paidDay.id} item={item} />
          ))}
          {dayShifts.length === 0 && dayPaid.length === 0 ? (
            <Text className="py-1 text-sm text-muted">{t("calendar.nothingOnDay")}</Text>
          ) : null}
          <View className="flex-row gap-2 pt-1">
            <DayAction label={t("calendar.addShift")} onPress={() => router.push({ pathname: "/shifts/new", params: { date: selected } })} />
            <DayAction label={t("calendar.addPaidDay")} onPress={() => router.push({ pathname: "/paid-days/new", params: { date: selected } })} />
          </View>
        </Panel>
      </Section>
    </TabPage>
  );
}
