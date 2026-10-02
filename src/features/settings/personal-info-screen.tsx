import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useActiveTaxProfile, useSettings } from "@/data/hooks/queries";
import { updateSettings } from "@/data/repositories/settings-repository";
import type { AppSettings } from "@/domain/entities";
import { calculateAutoCreditPoints } from "@/domain/tax/credit-points";
import { i18n } from "@/localization/i18n";
import { creditPointLineLabel } from "@/localization/labels";
import type { Gender, MaritalStatus, PersonalInfo } from "@/domain/tax/tax-status";
import { ageOn, fromLocalDateKey, toLocalDateKey } from "@/domain/time/time";
import { formatNumber } from "@/shared/lib/format";
import { useAppLocalization } from "@/localization/localization-provider";
import { ValueRow } from "@/shared/ui/section";
import { Text } from "@/shared/ui/app-text";
import { DateField } from "@/shared/ui/form/date-time-field";
import { AddRow, FormSection, SegmentedField, SwitchField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { QueryGate } from "@/shared/ui/query-gate";


function PersonalInfoForm({ settings }: { settings: AppSettings }) {
  const { t } = useTranslation();
  const { language } = useAppLocalization();
  const database = useSQLiteContext();
  const genders: { value: Gender; label: string }[] = [
    { value: "male", label: t("personal.male") },
    { value: "female", label: t("personal.female") },
  ];
  const marital: { value: MaritalStatus; label: string }[] = [
    { value: "single", label: t("personal.single") },
    { value: "married", label: t("personal.married") },
  ];
  const taxProfile = useActiveTaxProfile();
  const [info, setInfo] = useState<PersonalInfo>(settings.personalInfo);
  const set = <K extends keyof PersonalInfo>(key: K, value: PersonalInfo[K]) =>
    setInfo((current) => ({ ...current, [key]: value }));

  const thisYear = new Date().getFullYear();
  const preview = taxProfile.data
    ? calculateAutoCreditPoints(info, taxProfile.data.rules.creditPointRules, thisYear)
    : null;

  function updateChild(index: number, date: Date) {
    set(
      "childrenBirthDates",
      info.childrenBirthDates.map((value, i) => (i === index ? toLocalDateKey(date) : value)),
    );
  }

  return (
    <FormScreen
      intro={t("personal.intro")}
      title={t("personal.title")}
      onSave={() => updateSettings(database, { personalInfo: info })}
    >
      <FormSection>
        <DateField
          hint={info.birthDate ? t("personal.age", { age: ageOn(fromLocalDateKey(info.birthDate), new Date()) }) : t("personal.notSet")}
          label={t("personal.birthDate")}
          maximumDate={new Date()}
          value={info.birthDate ? fromLocalDateKey(info.birthDate) : new Date(2000, 0, 1)}
          onChange={(date) => set("birthDate", toLocalDateKey(date))}
        />
        <SegmentedField label={t("personal.gender")} options={genders} value={info.gender} onChange={(value) => set("gender", value)} />
        <SegmentedField
          label={t("personal.maritalStatus")}
          options={marital}
          value={info.maritalStatus}
          onChange={(value) => set("maritalStatus", value)}
        />
        <SwitchField label={t("personal.singleParent")} value={info.isSingleParent} onValueChange={(value) => set("isSingleParent", value)} />
        <SwitchField
          hint={t("personal.firstDegreeHint")}
          label={t("personal.firstDegree")}
          value={info.hasFirstDegree}
          onValueChange={(value) => set("hasFirstDegree", value)}
        />
      </FormSection>

      <FormSection title={t("personal.children", { count: info.childrenBirthDates.length })}>
        {info.childrenBirthDates.map((date, index) => (
          <View key={index} className="flex-row items-center">
            <View className="flex-1">
              <DateField
                label={t("personal.child", { number: index + 1 })}
                maximumDate={new Date()}
                value={fromLocalDateKey(date)}
                onChange={(value) => updateChild(index, value)}
              />
            </View>
            <Pressable
              accessibilityLabel={t("personal.removeChild", { number: index + 1 })}
              accessibilityRole="button"
              className="px-4 py-3"
              onPress={() => set("childrenBirthDates", info.childrenBirthDates.filter((_, i) => i !== index))}
            >
              <Text className="text-danger">{t("personal.remove")}</Text>
            </Pressable>
          </View>
        ))}
        <AddRow label={t("personal.addChild")} onPress={() => set("childrenBirthDates", [...info.childrenBirthDates, toLocalDateKey(new Date())])} />
      </FormSection>

      {preview ? (
        <FormSection
          footnote={
            settings.taxStatus.creditPointsMode === "manual"
              ? t("personal.manualNote")
              : t("personal.rulesNote")
          }
          title={t("personal.preview", { year: thisYear })}
        >
          {preview.lines.map((line, index) => (
            <ValueRow key={`${line.code}-${index}`} className="border-b-2 border-background px-4 py-3" label={creditPointLineLabel(line)}
              value={formatNumber(line.hundredths / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, language)} valueDirection="ltr" />
          ))}
          <ValueRow className="px-4 py-3" emphasis label={t("personal.total")} valueClassName="text-accent"
            value={formatNumber(preview.totalHundredths / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, language)} valueDirection="ltr" />
        </FormSection>
      ) : null}
    </FormScreen>
  );
}

/** Route: /settings/personal */
export function PersonalInfoScreen() {
  const settings = useSettings();
  return <QueryGate query={settings} title={i18n.t("personal.title")}>{(data) => <PersonalInfoForm settings={data} />}</QueryGate>;
}
