import { useSQLiteContext } from "expo-sqlite";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

import { usePlannedShifts, useSettings } from "@/data/hooks/queries";
import { clearPlannedShift, savePlannedShift } from "@/data/repositories/planned-shifts-repository";
import type { PlannedShift } from "@/domain/entities";
import { addLocalDays, startOfLocalWeek, toLocalDateKey } from "@/domain/time/time";
import { getAppLocale } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { TimeField } from "@/shared/ui/form/date-time-field";
import { AddRow, FormSection } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { errorMessage } from "@/localization/errors";
import { AppAlert } from "@/shared/ui/overlay/app-alert";

/**
 * Route: /tools/weekly-schedule — plan start and end times for the coming
 * week. Plans are reminders only; they are not paid until recorded as shifts.
 * Each change saves immediately.
 */
export function WeeklyScheduleScreen() {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const settings = useSettings();
  const weekStart = startOfLocalWeek(new Date(), settings.data?.weekStartDay ?? 0);
  const days = Array.from({ length: 7 }, (_, index) => addLocalDays(weekStart, index));
  const from = toLocalDateKey(days[0]);
  const to = toLocalDateKey(addLocalDays(weekStart, 7));
  const planned = usePlannedShifts(from, to);
  const byDate = new Map((planned.data ?? []).map((plan) => [plan.date, plan]));

  async function save(plan: Pick<PlannedShift, "date" | "startMinute" | "endMinute" | "note">) {
    try {
      await savePlannedShift(database, plan);
    } catch (error) {
      AppAlert.alert(t("schedule.saveFailed"), errorMessage(error));
    }
  }

  return (
    <FormScreen
      intro={t("schedule.intro")}
      title={t("schedule.title")}
    >
      {days.map((day) => {
        const date = toLocalDateKey(day);
        const plan = byDate.get(date);
        const title = day.toLocaleDateString(getAppLocale(), { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
        return (
          <FormSection key={date} title={title}>
            {plan ? (
              <>
                <TimeField label={t("schedule.start")} minute={plan.startMinute} onChange={(minute) => save({ ...plan, startMinute: minute })} />
                <TimeField
                  hint={plan.endMinute <= plan.startMinute ? t("schedule.endsNextDay") : undefined}
                  label={t("schedule.end")}
                  minute={plan.endMinute}
                  onChange={(minute) => save({ ...plan, endMinute: minute })}
                />
                <Pressable
                  accessibilityRole="button"
                  className="min-h-14 justify-center px-4 py-3"
                  style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}
                  onPress={() => void clearPlannedShift(database, date)}
                >
                  <Text className="font-manrope-semibold text-base text-danger">{t("schedule.clear")}</Text>
                </Pressable>
              </>
            ) : (
              <AddRow label={t("schedule.plan")} onPress={() => void save({ date, startMinute: 8 * 60, endMinute: 16 * 60, note: null })} />
            )}
          </FormSection>
        );
      })}
    </FormScreen>
  );
}
