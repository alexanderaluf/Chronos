import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { useActiveTaxProfile } from "@/data/hooks/queries";
import { resetTaxProfileToIsraelDefaults, updateTaxRules } from "@/data/repositories/tax-profiles-repository";
import type { TaxProfile } from "@/domain/entities";
import type { TaxRules } from "@/domain/tax/tax-rules";
import { Text } from "@/shared/ui/app-text";
import { AddRow, FormButton, FormSection, TextField } from "@/shared/ui/form/fields";
import { NumericInput } from "@/shared/ui/form/numeric-input";
import { FormScreen } from "@/shared/ui/form/form-screen";
import {
  basisPointsToInput,
  hundredthsToInput,
  inputToBasisPoints,
  inputToHundredths,
  inputToMinor,
  inputToWholeNumber,
  minorToInput,
  required,
} from "@/shared/ui/form/input-format";
import { QueryGate } from "@/shared/ui/query-gate";
import { i18n } from "@/localization/i18n";
import { AppAlert } from "@/shared/ui/overlay/app-alert";

type BracketRow = { upTo: string; rate: string };
type ChildRow = { fromAge: string; toAge: string; mother: string; father: string };

/** Small inline numeric input used in table-like rows. */
function Cell({ value, onChangeText, label, currencyCode, suffix, editable = true }: {
  value: string;
  onChangeText: (text: string) => void;
  label: string;
  currencyCode?: string;
  suffix?: string;
  editable?: boolean;
}) {
  return (
    <View className="min-w-0 flex-1 gap-1">
      <Text className="text-xs text-muted">{label}</Text>
      <View className="rounded-lg bg-surface-secondary px-2 py-1.5">
        <NumericInput compact currencyCode={currencyCode} suffix={suffix} editable={editable} label={label} value={value} onChangeText={onChangeText} />
      </View>
    </View>
  );
}

function TaxSystemForm({ profile }: { profile: TaxProfile }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const rules = profile.rules;
  const [brackets, setBrackets] = useState<BracketRow[]>(
    rules.incomeTaxBrackets.map((bracket) => ({
      upTo: bracket.upTo === null ? "" : minorToInput(bracket.upTo),
      rate: basisPointsToInput(bracket.rateBp),
    })),
  );
  const [children, setChildren] = useState<ChildRow[]>(
    rules.creditPointRules.children.map((rule) => ({
      fromAge: String(rule.fromAge),
      toAge: String(rule.toAge),
      mother: hundredthsToInput(rule.motherHundredths),
      father: hundredthsToInput(rule.fatherHundredths),
    })),
  );
  const [scalars, setScalars] = useState({
    creditPointValue: minorToInput(rules.creditPointValue),
    resident: hundredthsToInput(rules.creditPointRules.residentHundredths),
    woman: hundredthsToInput(rules.creditPointRules.womanHundredths),
    singleParent: hundredthsToInput(rules.creditPointRules.singleParentHundredths),
    firstDegree: hundredthsToInput(rules.creditPointRules.firstDegreeHundredths),
    threshold: minorToInput(rules.insuranceReducedThreshold),
    ceiling: minorToInput(rules.insuranceCeiling),
    niEmployeeReduced: basisPointsToInput(rules.nationalInsuranceEmployee.reducedRateBp),
    niEmployeeFull: basisPointsToInput(rules.nationalInsuranceEmployee.fullRateBp),
    niSelfReduced: basisPointsToInput(rules.nationalInsuranceSelfEmployed.reducedRateBp),
    niSelfFull: basisPointsToInput(rules.nationalInsuranceSelfEmployed.fullRateBp),
    healthReduced: basisPointsToInput(rules.healthInsurance.reducedRateBp),
    healthFull: basisPointsToInput(rules.healthInsurance.fullRateBp),
  });
  const scalar = (key: keyof typeof scalars) => (text: string) => setScalars((current) => ({ ...current, [key]: text }));

  async function save() {
    const money = (text: string, label: string) => required(inputToMinor(text), label);
    const bp = (text: string, label: string) => required(inputToBasisPoints(text), label);
    const points = (text: string, label: string) => required(inputToHundredths(text), label);
    const next: TaxRules = {
      incomeTaxBrackets: brackets.map((row, index) => ({
        upTo: index === brackets.length - 1 || row.upTo.trim() === "" ? null : money(row.upTo, `${t("taxSystem.upTo")} #${index + 1}`),
        rateBp: bp(row.rate, `${t("taxSystem.ratePercent")} #${index + 1}`),
      })),
      creditPointValue: money(scalars.creditPointValue, t("taxSystem.pointValue")),
      creditPointRules: {
        residentHundredths: points(scalars.resident, t("taxSystem.resident")),
        womanHundredths: points(scalars.woman, t("taxSystem.woman")),
        singleParentHundredths: points(scalars.singleParent, t("taxSystem.singleParent")),
        firstDegreeHundredths: points(scalars.firstDegree, t("taxSystem.firstDegree")),
        children: children.map((row, index) => ({
          fromAge: required(inputToWholeNumber(row.fromAge), `${t("taxSystem.fromAge")} #${index + 1}`),
          toAge: required(inputToWholeNumber(row.toAge), `${t("taxSystem.toAge")} #${index + 1}`),
          motherHundredths: points(row.mother, `${t("taxSystem.mother")} #${index + 1}`),
          fatherHundredths: points(row.father, `${t("taxSystem.father")} #${index + 1}`),
        })),
      },
      insuranceReducedThreshold: money(scalars.threshold, t("taxSystem.reducedUpTo")),
      insuranceCeiling: money(scalars.ceiling, t("taxSystem.ceiling")),
      nationalInsuranceEmployee: {
        reducedRateBp: bp(scalars.niEmployeeReduced, `${t("taxSystem.niEmployee")} · ${t("taxSystem.reducedRate")}`),
        fullRateBp: bp(scalars.niEmployeeFull, `${t("taxSystem.niEmployee")} · ${t("taxSystem.fullRate")}`),
      },
      nationalInsuranceSelfEmployed: {
        reducedRateBp: bp(scalars.niSelfReduced, `${t("taxSystem.niSelfEmployed")} · ${t("taxSystem.reducedRate")}`),
        fullRateBp: bp(scalars.niSelfFull, `${t("taxSystem.niSelfEmployed")} · ${t("taxSystem.fullRate")}`),
      },
      healthInsurance: {
        reducedRateBp: bp(scalars.healthReduced, `${t("taxSystem.health")} · ${t("taxSystem.reducedRate")}`),
        fullRateBp: bp(scalars.healthFull, `${t("taxSystem.health")} · ${t("taxSystem.fullRate")}`),
      },
    };
    await updateTaxRules(database, profile.id, next);
  }

  function confirmReset() {
    AppAlert.alert(t("taxSystem.resetTitle"), t("taxSystem.resetMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("taxSystem.resetConfirm"),
        style: "destructive",
        onPress: async () => {
          await resetTaxProfileToIsraelDefaults(database, profile.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <FormScreen
      footer={profile.id ? <FormButton label={t("taxSystem.reset")} tone="neutral" onPress={confirmReset} /> : null}
      intro={t("taxSystem.intro")}
      title={t("taxSystem.title")}
      onSave={profile.id ? save : undefined}
    >
      <FormSection footnote={t("taxSystem.bracketsNote")} title={t("taxSystem.brackets")}>
        {brackets.map((row, index) => (
          <View key={index} className="flex-row items-end gap-3 border-b-2 border-background px-4 py-2">
            <Cell
              currencyCode="ILS"
              editable={index !== brackets.length - 1}
              label={index === brackets.length - 1 ? t("taxSystem.above") : t("taxSystem.upTo")}
              value={index === brackets.length - 1 ? "∞" : row.upTo}
              onChangeText={(text) => setBrackets((current) => current.map((item, i) => (i === index ? { ...item, upTo: text } : item)))}
            />
            <Cell
              suffix="%"
              label={t("taxSystem.ratePercent")}
              value={row.rate}
              onChangeText={(text) => setBrackets((current) => current.map((item, i) => (i === index ? { ...item, rate: text } : item)))}
            />
            {brackets.length > 1 ? (
              <Pressable
                accessibilityLabel={t("taxSystem.removeBracket")}
                accessibilityRole="button"
                className="pb-2"
                onPress={() => setBrackets((current) => current.filter((_, i) => i !== index))}
              >
                <Text className="text-danger">✕</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        <AddRow
          label={t("taxSystem.addBracket")}
          onPress={() => setBrackets((current) => [...current.slice(0, -1), { upTo: "", rate: "" }, ...current.slice(-1)])}
        />
      </FormSection>

      <FormSection title={t("taxSystem.creditPoints")}>
        <TextField keyboardType="decimal-pad" currencyCode="ILS" label={t("taxSystem.pointValue")} value={scalars.creditPointValue} onChangeText={scalar("creditPointValue")} />
        <TextField keyboardType="decimal-pad" label={t("taxSystem.resident")} value={scalars.resident} onChangeText={scalar("resident")} />
        <TextField keyboardType="decimal-pad" label={t("taxSystem.woman")} value={scalars.woman} onChangeText={scalar("woman")} />
        <TextField keyboardType="decimal-pad" label={t("taxSystem.singleParent")} value={scalars.singleParent} onChangeText={scalar("singleParent")} />
        <TextField keyboardType="decimal-pad" label={t("taxSystem.firstDegree")} value={scalars.firstDegree} onChangeText={scalar("firstDegree")} />
      </FormSection>

      <FormSection footnote={t("taxSystem.childrenNote")} title={t("taxSystem.children")}>
        {children.map((row, index) => {
          const update = (key: keyof ChildRow) => (text: string) =>
            setChildren((current) => current.map((item, i) => (i === index ? { ...item, [key]: text } : item)));
          return (
            <View key={index} className="flex-row items-end gap-2 border-b-2 border-background px-4 py-2">
              <Cell label={t("taxSystem.fromAge")} value={row.fromAge} onChangeText={update("fromAge")} />
              <Cell label={t("taxSystem.toAge")} value={row.toAge} onChangeText={update("toAge")} />
              <Cell label={t("taxSystem.mother")} value={row.mother} onChangeText={update("mother")} />
              <Cell label={t("taxSystem.father")} value={row.father} onChangeText={update("father")} />
              <Pressable
                accessibilityLabel={t("taxSystem.removeAgeRange")}
                accessibilityRole="button"
                className="pb-2"
                onPress={() => setChildren((current) => current.filter((_, i) => i !== index))}
              >
                <Text className="text-danger">✕</Text>
              </Pressable>
            </View>
          );
        })}
        <AddRow
          label={t("taxSystem.addAgeRange")}
          onPress={() => setChildren((current) => [...current, { fromAge: "0", toAge: "0", mother: "0", father: "0" }])}
        />
      </FormSection>

      <FormSection title={t("taxSystem.thresholds")}>
        <TextField keyboardType="decimal-pad" currencyCode="ILS" label={t("taxSystem.reducedUpTo")} value={scalars.threshold} onChangeText={scalar("threshold")} />
        <TextField hint={t("taxSystem.ceilingHint")} keyboardType="decimal-pad" currencyCode="ILS" label={t("taxSystem.ceiling")} value={scalars.ceiling} onChangeText={scalar("ceiling")} />
      </FormSection>

      <FormSection title={t("taxSystem.niEmployee")}>
        <TextField keyboardType="decimal-pad" label={t("taxSystem.reducedRate")} suffix="%" value={scalars.niEmployeeReduced} onChangeText={scalar("niEmployeeReduced")} />
        <TextField keyboardType="decimal-pad" label={t("taxSystem.fullRate")} suffix="%" value={scalars.niEmployeeFull} onChangeText={scalar("niEmployeeFull")} />
      </FormSection>

      <FormSection title={t("taxSystem.niSelfEmployed")}>
        <TextField keyboardType="decimal-pad" label={t("taxSystem.reducedRate")} suffix="%" value={scalars.niSelfReduced} onChangeText={scalar("niSelfReduced")} />
        <TextField keyboardType="decimal-pad" label={t("taxSystem.fullRate")} suffix="%" value={scalars.niSelfFull} onChangeText={scalar("niSelfFull")} />
      </FormSection>

      <FormSection title={t("taxSystem.health")}>
        <TextField keyboardType="decimal-pad" label={t("taxSystem.reducedRate")} suffix="%" value={scalars.healthReduced} onChangeText={scalar("healthReduced")} />
        <TextField keyboardType="decimal-pad" label={t("taxSystem.fullRate")} suffix="%" value={scalars.healthFull} onChangeText={scalar("healthFull")} />
      </FormSection>
    </FormScreen>
  );
}

/** Route: /settings/tax-system */
export function TaxSystemScreen() {
  const profile = useActiveTaxProfile();
  return <QueryGate query={profile} title={i18n.t("taxSystem.title")}>{(data) => <TaxSystemForm profile={data} />}</QueryGate>;
}
