import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettings } from "@/data/hooks/queries";
import { saveHolidayPaySettings } from "@/data/repositories/shifts-repository";
import { WORK_CITIES, normalizeHolidayPaySettings, type HolidayPaySettings, type WorkCity } from "@/domain/holidays/holiday-settings";
import { formatMinuteOfDay, minuteOfDay } from "@/domain/time/time";
import { Text } from "@/shared/ui/app-text";
import { PickerCard, ToggleCard } from "@/shared/ui/form/cards";
import { minuteToReferenceDate } from "@/shared/ui/form/date-time-field";
import { FormSection, SegmentedField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { SelectionSection } from "@/shared/ui/form/selection-section";
import { QueryGate } from "@/shared/ui/query-gate";

import { askShiftUpdateScope } from "./ask-shift-update-scope";

function HolidayPayForm({ initial }: { initial: HolidayPaySettings }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const [value, setValue] = useState(initial);
  const [citiesOpen, setCitiesOpen] = useState(!initial.workCity);
  const set = (change: Partial<HolidayPaySettings>) => setValue((current) => ({ ...current, ...change }));

  async function save() {
    if (value.enabled && value.windowMode === "automatic" && !value.workCity) {
      throw new Error(t("holidayPay.status.needsLocation"));
    }
    const next = normalizeHolidayPaySettings(value);
    // Shifts keep their own copy of these settings, so ask which shifts get the change.
    const scope = JSON.stringify(next) !== JSON.stringify(normalizeHolidayPaySettings(initial)) ? await askShiftUpdateScope() : "newShiftsOnly";
    if (!scope) return false;
    await saveHolidayPaySettings(database, next, scope);
  }

  return (
    <FormScreen title={t("holidayPay.title")} intro={t("holidayPay.intro")} onSave={save}>
      <ToggleCard label={t("holidayPay.enabled")} value={value.enabled} onValueChange={(enabled) => set({ enabled })} />
      {value.enabled ? <>
        <FormSection title={t("holidayPay.hours")} description={t(value.windowMode === "automatic" ? "holidayPay.automaticHint" : "holidayPay.customHint")}>
          <SegmentedField options={[
            { value: "automatic", label: t("holidayPay.automatic") },
            { value: "custom", label: t("holidayPay.custom") },
          ]} value={value.windowMode} onChange={(windowMode) => set({ windowMode })} />
        </FormSection>
        {value.windowMode === "automatic" ? (
          <SelectionSection title={t("holidayPay.city")} placeholder={t("holidayPay.chooseCity")} icon="work" expanded={citiesOpen}
            options={(Object.keys(WORK_CITIES) as WorkCity[]).map((id) => ({ id, name: t(`holidayPay.cities.${id}`) }))}
            selectedId={value.workCity ?? ""} onToggle={() => setCitiesOpen(!citiesOpen)}
            onSelect={(id) => { set({ workCity: id as WorkCity }); setCitiesOpen(false); }} />
        ) : <>
          <PickerCard label={t("holidayPay.start")} display={formatMinuteOfDay(value.customStartMinute)} mode="time"
            value={minuteToReferenceDate(value.customStartMinute)} onChange={(date) => set({ customStartMinute: minuteOfDay(date) })} />
          <PickerCard label={t("holidayPay.end")} display={formatMinuteOfDay(value.customEndMinute)} mode="time"
            value={minuteToReferenceDate(value.customEndMinute)} onChange={(date) => set({ customEndMinute: minuteOfDay(date) })} />
        </>}
      </> : null}
      <Text className="px-1 text-sm leading-5 text-muted">{t("holidayPay.policy")}</Text>
      <Text className="px-1 text-xs leading-5 text-muted">{t("holidayPay.breakPolicy")}</Text>
    </FormScreen>
  );
}

export function HolidayPaySettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettings();
  return <QueryGate query={settings} title={t("holidayPay.title")}>{(data) => <HolidayPayForm initial={data.holidayPay} />}</QueryGate>;
}
