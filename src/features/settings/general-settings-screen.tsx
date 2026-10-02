import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useSettings } from "@/data/hooks/queries";
import { updateSettings } from "@/data/repositories/settings-repository";
import type { AppLanguage, AppSettings, CalendarDirection, ThemeMode } from "@/domain/entities";
import { i18n } from "@/localization/i18n";
import { LANGUAGE_OPTIONS } from "@/localization/languages";
import { getDeviceLanguage, useAppLocalization } from "@/localization/localization-provider";
import { formatNumber } from "@/shared/lib/format";
import { ACCENT_OPTIONS } from "@/shared/theme/app-theme";
import { Text } from "@/shared/ui/app-text";
import { FilledIcon } from "@/shared/ui/filled-icon";
import { FieldRow, FormSection, SegmentedField, SwitchField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { QueryGate } from "@/shared/ui/query-gate";

/** − value + control, like the reference app's steppers. */
function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (value: number) => void }) {
  const { t } = useTranslation();
  const { language } = useAppLocalization();
  return (
    <View className="flex-row items-center gap-1 rounded-xl bg-surface-secondary" style={{ direction: "ltr" }}>
      <Pressable accessibilityLabel={t("general.decrease")} accessibilityRole="button" className="px-3 py-1.5" disabled={value <= min} onPress={() => onChange(value - 1)}>
        <Text className={`text-xl ${value <= min ? "text-muted" : ""}`}>−</Text>
      </Pressable>
      <Text className="min-w-6 text-center text-base" style={{ writingDirection: "ltr", fontVariant: ["tabular-nums"] }}>{formatNumber(value, undefined, language)}</Text>
      <Pressable accessibilityLabel={t("general.increase")} accessibilityRole="button" className="px-3 py-1.5" disabled={value >= max} onPress={() => onChange(value + 1)}>
        <Text className={`text-xl ${value >= max ? "text-muted" : ""}`}>+</Text>
      </Pressable>
    </View>
  );
}

/** One language row (Plutus language page style): native name, translated name, check. */
function LanguageRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { direction } = useAppLocalization();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className="min-h-16 flex-row items-center border-b-2 border-background px-4 py-3"
      style={({ pressed }) => ({ direction, opacity: pressed ? 0.72 : 1 })}
      onPress={onPress}
    >
      <View className="flex-1">
        <Text className="font-manrope-semibold text-base text-foreground">{title}</Text>
        {subtitle ? <Text className="mt-0.5 font-sans text-xs text-muted">{subtitle}</Text> : null}
      </View>
      {selected ? (
        <View className="size-8 items-center justify-center rounded-full bg-accent/15">
          <FilledIcon name="check" size={20} tone="accent" />
        </View>
      ) : (
        <View className="size-8" />
      )}
    </Pressable>
  );
}

/**
 * Preferences save immediately (no Save button) — like a system settings app.
 * Changing the language re-renders the whole app in that language; Hebrew
 * switches the layout to right-to-left.
 */
function GeneralSettingsForm({ settings }: { settings: AppSettings }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const [current, setCurrent] = useState(settings);
  const save = (patch: Partial<AppSettings>) => {
    setCurrent((value) => ({ ...value, ...patch }));
    void updateSettings(database, patch);
  };

  const themes: { value: ThemeMode; label: string }[] = [
    { value: "system", label: t("general.themes.system") },
    { value: "light", label: t("general.themes.light") },
    { value: "dark", label: t("general.themes.dark") },
  ];
  const directions: { value: CalendarDirection; label: string }[] = [
    { value: "ltr", label: t("general.ltr") },
    { value: "rtl", label: t("general.rtl") },
  ];
  const weekStarts: { value: "0" | "1" | "6"; label: string }[] = [
    { value: "0", label: t("general.sunday") },
    { value: "1", label: t("general.monday") },
    { value: "6", label: t("general.saturday") },
  ];
  const deviceLanguage = LANGUAGE_OPTIONS.find((option) => option.code === getDeviceLanguage());
  const selectLanguage = (language: AppLanguage | null) => save({ appLanguage: language });

  return (
    <FormScreen title={t("general.title")}>
      <FormSection description={t("general.languageDescription")} title={t("general.language")}>
        <LanguageRow
          selected={current.appLanguage === null}
          subtitle={`${t("general.systemLanguageHint")}${deviceLanguage ? ` · ${deviceLanguage.nativeName}` : ""}`}
          title={t("general.systemLanguage")}
          onPress={() => selectLanguage(null)}
        />
        {LANGUAGE_OPTIONS.map((option) => (
          <LanguageRow
            key={option.code}
            selected={current.appLanguage === option.code}
            subtitle={option.direction === "rtl" ? t("general.rtl") : t("general.ltr")}
            title={option.nativeName}
            onPress={() => selectLanguage(option.code)}
          />
        ))}
      </FormSection>

      <FormSection
        footnote={
          current.payPeriodStartDay === 1
            ? t("general.payPeriodNoteMonth", { start: 1 })
            : t("general.payPeriodNoteCustom", { start: current.payPeriodStartDay, end: current.payPeriodStartDay - 1 })
        }
        title={t("general.payPeriod")}
      >
        <FieldRow label={t("general.payPeriodStart")}>
          <Stepper max={28} min={1} value={current.payPeriodStartDay} onChange={(value) => save({ payPeriodStartDay: value })} />
        </FieldRow>
      </FormSection>

      <FormSection title={t("general.shifts")}>
        <SwitchField
          hint={t("general.roundingHint")}
          label={t("general.rounding")}
          value={current.roundingMinutes === 5}
          onValueChange={(value) => save({ roundingMinutes: value ? 5 : 0 })}
        />
        <SwitchField
          label={t("general.showSummary")}
          value={current.showShiftSummaryAfterSave}
          onValueChange={(value) => save({ showShiftSummaryAfterSave: value })}
        />
      </FormSection>

      <FormSection title={t("general.calendar")}>
        <SegmentedField
          label={t("general.direction")}
          options={directions}
          value={current.calendarDirection}
          onChange={(value) => save({ calendarDirection: value })}
        />
        <SegmentedField
          label={t("general.weekStart")}
          options={weekStarts}
          value={String(current.weekStartDay) as "0" | "1" | "6"}
          onChange={(value) => save({ weekStartDay: Number(value) })}
        />
      </FormSection>

      <FormSection title={t("general.appearance")}>
        <SegmentedField options={themes} value={current.themeMode} onChange={(value) => save({ themeMode: value })} />
        <View className="flex-row flex-wrap justify-between gap-y-3 px-4 py-3">
          {ACCENT_OPTIONS.map((option) => {
            const selected = current.accentColor === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityLabel={t("general.accent", { color: option.label })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className="size-11 items-center justify-center rounded-full"
                style={{ backgroundColor: option.swatch }}
                onPress={() => save({ accentColor: option.id })}
              >
                {selected ? <FilledIcon color="#ffffff" name="check" size={22} /> : null}
              </Pressable>
            );
          })}
        </View>
      </FormSection>
    </FormScreen>
  );
}

/** Route: /settings/general */
export function GeneralSettingsScreen() {
  const settings = useSettings();
  return (
    <QueryGate query={settings} title={i18n.t("general.title")}>
      {(data) => <GeneralSettingsForm settings={data} />}
    </QueryGate>
  );
}
