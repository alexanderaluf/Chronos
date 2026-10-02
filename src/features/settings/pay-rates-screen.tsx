import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useDefaultJob } from "@/data/hooks/queries";
import { updateJob } from "@/data/repositories/jobs-repository";
import type { Job } from "@/domain/entities";
import { ISRAEL_DEFAULT_PAY_RULES, type PayRules } from "@/domain/pay/pay-rules";
import { Text } from "@/shared/ui/app-text";
import { TimeField } from "@/shared/ui/form/date-time-field";
import { FormButton, FormSection, SwitchField, TextField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import {
  basisPointsToInput,
  hoursInputToMinutes,
  inputToBasisPoints,
  minutesToHoursInput,
  required,
} from "@/shared/ui/form/input-format";
import { QueryGate } from "@/shared/ui/query-gate";
import { i18n } from "@/localization/i18n";

type RateFields = {
  dailyHours: string;
  nightHours: string;
  nightMinHours: string;
  tier1Hours: string;
  tier1Rate: string;
  tier2Rate: string;
  nightPremium: string;
  restRate: string;
  restTier1Rate: string;
  restTier2Rate: string;
};

function toFields(rules: PayRules): RateFields {
  return {
    dailyHours: minutesToHoursInput(rules.dailyOvertimeThresholdMinutes),
    nightHours: minutesToHoursInput(rules.nightShiftThresholdMinutes),
    nightMinHours: minutesToHoursInput(rules.nightShiftMinNightMinutes),
    tier1Hours: minutesToHoursInput(rules.overtimeTier1Minutes),
    tier1Rate: basisPointsToInput(rules.overtimeTier1RateBp),
    tier2Rate: basisPointsToInput(rules.overtimeTier2RateBp),
    nightPremium: basisPointsToInput(rules.nightPremiumRateBp - 10_000),
    restRate: basisPointsToInput(rules.restDayRateBp),
    restTier1Rate: basisPointsToInput(rules.restDayOvertimeTier1RateBp),
    restTier2Rate: basisPointsToInput(rules.restDayOvertimeTier2RateBp),
  };
}

function PayRatesForm({ job }: { job: Job }) {
  const { t } = useTranslation();
  const weekdays = t("dates.shortWeekdays", { returnObjects: true });
  const database = useSQLiteContext();
  const [rules, setRules] = useState(job.payRules);
  const [fields, setFields] = useState(() => toFields(job.payRules));
  const setField = (key: keyof RateFields) => (text: string) => setFields((current) => ({ ...current, [key]: text }));
  const setRule = <K extends keyof PayRules>(key: K, value: PayRules[K]) =>
    setRules((current) => ({ ...current, [key]: value }));

  async function save() {
    const hours = (text: string, label: string) => required(hoursInputToMinutes(text), label);
    const rate = (text: string, label: string) => required(inputToBasisPoints(text), label);
    await updateJob(database, job.id, {
      payRules: {
        ...rules,
        dailyOvertimeThresholdMinutes: hours(fields.dailyHours, t("rates.regularHours")),
        nightShiftThresholdMinutes: hours(fields.nightHours, t("rates.nightRegularHours")),
        nightShiftMinNightMinutes: hours(fields.nightMinHours, t("rates.nightMinHours")),
        overtimeTier1Minutes: hours(fields.tier1Hours, t("rates.tier1Hours")),
        overtimeTier1RateBp: rate(fields.tier1Rate, t("rates.tier1Rate")),
        overtimeTier2RateBp: rate(fields.tier2Rate, t("rates.tier2Rate")),
        nightPremiumRateBp: 10_000 + rate(fields.nightPremium, t("rates.nightPremium")),
        restDayRateBp: rate(fields.restRate, t("rates.restRate")),
        restDayOvertimeTier1RateBp: rate(fields.restTier1Rate, t("rates.restTier1")),
        restDayOvertimeTier2RateBp: rate(fields.restTier2Rate, t("rates.restTier2")),
      },
    });
  }

  function resetToDefaults() {
    const defaults = { ...ISRAEL_DEFAULT_PAY_RULES, unpaidBreaks: rules.unpaidBreaks };
    setRules(defaults);
    setFields(toFields(defaults));
  }

  return (
    <FormScreen
      footer={<FormButton label={t("rates.reset")} tone="neutral" onPress={resetToDefaults} />}
      intro={t("rates.intro")}
      title={t("rates.title")}
      onSave={save}
    >
      <FormSection title={t("rates.overtime")}>
        <SwitchField label={t("rates.calculateOvertime")} value={rules.overtimeEnabled} onValueChange={(value) => setRule("overtimeEnabled", value)} />
        {rules.overtimeEnabled ? (
          <>
            <TextField keyboardType="decimal-pad" label={t("rates.regularHours")} suffix={t("units.hoursSuffix")} value={fields.dailyHours} onChangeText={setField("dailyHours")} />
            <TextField keyboardType="decimal-pad" label={t("rates.tier1Hours")} suffix={t("units.hoursSuffix")} value={fields.tier1Hours} onChangeText={setField("tier1Hours")} />
            <TextField keyboardType="decimal-pad" label={t("rates.tier1Rate")} suffix="%" value={fields.tier1Rate} onChangeText={setField("tier1Rate")} />
            <TextField keyboardType="decimal-pad" label={t("rates.tier2Rate")} suffix="%" value={fields.tier2Rate} onChangeText={setField("tier2Rate")} />
          </>
        ) : null}
      </FormSection>

      <FormSection title={t("rates.night")}>
        <TimeField label={t("rates.nightStarts")} minute={rules.nightWindowStartMinute} onChange={(minute) => setRule("nightWindowStartMinute", minute)} />
        <TimeField label={t("rates.nightEnds")} minute={rules.nightWindowEndMinute} onChange={(minute) => setRule("nightWindowEndMinute", minute)} />
        <TextField
          hint={t("rates.nightMinHoursHint")}
          keyboardType="decimal-pad"
          label={t("rates.nightMinHours")}
          suffix={t("units.hoursSuffix")}
          value={fields.nightMinHours}
          onChangeText={setField("nightMinHours")}
        />
        <TextField keyboardType="decimal-pad" label={t("rates.nightRegularHours")} suffix={t("units.hoursSuffix")} value={fields.nightHours} onChangeText={setField("nightHours")} />
        <TextField
          hint={t("rates.nightPremiumHint")}
          keyboardType="decimal-pad"
          label={t("rates.nightPremium")}
          suffix="%"
          value={fields.nightPremium}
          onChangeText={setField("nightPremium")}
        />
      </FormSection>

      <FormSection footnote={t("rates.restDayNote")} title={t("rates.restDay")}>
        <View className="flex-row justify-between px-4 py-3">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const selected = rules.restDays.includes(day);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`size-10 items-center justify-center rounded-full ${selected ? "bg-accent" : "bg-surface-secondary"}`}
                onPress={() =>
                  setRule("restDays", selected ? rules.restDays.filter((value) => value !== day) : [...rules.restDays, day].sort())
                }
              >
                <Text className={`text-xs ${selected ? "text-accent-foreground" : ""}`}>{weekdays[day]}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextField keyboardType="decimal-pad" label={t("rates.restRate")} suffix="%" value={fields.restRate} onChangeText={setField("restRate")} />
        <TextField keyboardType="decimal-pad" label={t("rates.restTier1")} suffix="%" value={fields.restTier1Rate} onChangeText={setField("restTier1Rate")} />
        <TextField keyboardType="decimal-pad" label={t("rates.restTier2")} suffix="%" value={fields.restTier2Rate} onChangeText={setField("restTier2Rate")} />
      </FormSection>
    </FormScreen>
  );
}

/** Route: /settings/rates */
export function PayRatesScreen() {
  const job = useDefaultJob();
  return <QueryGate query={job} title={i18n.t("rates.title")}>{(data) => <PayRatesForm job={data} />}</QueryGate>;
}
