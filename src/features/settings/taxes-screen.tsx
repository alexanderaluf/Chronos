import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useActiveTaxProfile, useSettings } from "@/data/hooks/queries";
import { updateSettings } from "@/data/repositories/settings-repository";
import type { AppSettings } from "@/domain/entities";
import { calculateAutoCreditPoints } from "@/domain/tax/credit-points";
import type { EmploymentType, TaxStatus } from "@/domain/tax/tax-status";
import { Text } from "@/shared/ui/app-text";
import { FieldRow, FormSection, LinkRow, SegmentedField, SwitchField, TextField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import {
  basisPointsToInput,
  hundredthsToInput,
  inputToBasisPoints,
  inputToHundredths,
  inputToMinor,
  minorToInput,
  required,
} from "@/shared/ui/form/input-format";
import { QueryGate } from "@/shared/ui/query-gate";
import { i18n } from "@/localization/i18n";


function TaxesForm({ settings }: { settings: AppSettings }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const employment: { value: EmploymentType; label: string }[] = [
    { value: "employee", label: t("taxes.employee") },
    { value: "selfEmployed", label: t("taxes.selfEmployed") },
  ];
  const creditModes: { value: TaxStatus["creditPointsMode"]; label: string }[] = [
    { value: "auto", label: t("taxes.automatic") },
    { value: "manual", label: t("taxes.manual") },
  ];
  const taxProfile = useActiveTaxProfile();
  const status = settings.taxStatus;
  const [employmentType, setEmploymentType] = useState(status.employmentType);
  const [creditPointsMode, setCreditPointsMode] = useState(status.creditPointsMode);
  const [manualPoints, setManualPoints] = useState(hundredthsToInput(status.manualCreditPointsHundredths));
  const [niExempt, setNiExempt] = useState(status.nationalInsuranceExempt);
  const [benefit, setBenefit] = useState(minorToInput(status.taxableBenefitMonthly));
  const [settlementRate, setSettlementRate] = useState(basisPointsToInput(status.settlementCreditRateBp));
  const [settlementCeiling, setSettlementCeiling] = useState(minorToInput(status.settlementCreditMonthlyCeiling));

  const autoPoints = taxProfile.data
    ? calculateAutoCreditPoints(settings.personalInfo, taxProfile.data.rules.creditPointRules, new Date().getFullYear())
    : null;

  async function save() {
    await updateSettings(database, {
      taxStatus: {
        employmentType,
        creditPointsMode,
        manualCreditPointsHundredths: required(inputToHundredths(manualPoints), t("taxes.fields.points")),
        nationalInsuranceExempt: niExempt,
        taxableBenefitMonthly: required(inputToMinor(benefit), t("taxes.fields.benefit")),
        settlementCreditRateBp: required(inputToBasisPoints(settlementRate), t("taxes.fields.localityRate")),
        settlementCreditMonthlyCeiling: required(inputToMinor(settlementCeiling), t("taxes.fields.localityCeiling")),
      },
    });
  }

  return (
    <FormScreen
      intro={t("taxes.intro")}
      title={t("taxes.title")}
      onSave={save}
    >
      <FormSection>
        <SegmentedField label={t("taxes.employmentType")} options={employment} value={employmentType} onChange={setEmploymentType} />
      </FormSection>

      <FormSection
        footnote={creditPointsMode === "auto" ? t("taxes.autoNote") : t("taxes.manualNote")}
        title={t("taxes.creditPoints")}
      >
        <SegmentedField options={creditModes} value={creditPointsMode} onChange={setCreditPointsMode} />
        {creditPointsMode === "manual" ? (
          <TextField keyboardType="decimal-pad" label={t("taxes.points")} value={manualPoints} onChangeText={setManualPoints} />
        ) : (
          <FieldRow label={t("taxes.points")}>
            <Text className="text-accent">{autoPoints ? (autoPoints.totalHundredths / 100).toFixed(2) : "…"}</Text>
          </FieldRow>
        )}
        <LinkRow label={t("settingsMenu.personal")} onPress={() => router.push("/settings/personal")} />
      </FormSection>

      <FormSection title={t("taxes.nationalInsurance")}>
        <SwitchField
          hint={t("taxes.niExemptHint")}
          label={t("taxes.niExempt")}
          value={niExempt}
          onValueChange={setNiExempt}
        />
      </FormSection>

      <FormSection footnote={t("taxes.benefitNote")} title={t("taxes.benefit")}>
        <TextField
          hint={t("taxes.benefitHint")}
          keyboardType="decimal-pad"
          label={t("taxes.benefitValue")}
          value={benefit}
          onChangeText={setBenefit}
        />
      </FormSection>

      <FormSection footnote={t("taxes.localityNote")} title={t("taxes.locality")}>
        <TextField keyboardType="decimal-pad" label={t("taxes.localityRate")} suffix="%" value={settlementRate} onChangeText={setSettlementRate} />
        <TextField keyboardType="decimal-pad" label={t("taxes.localityCeiling")} value={settlementCeiling} onChangeText={setSettlementCeiling} />
      </FormSection>

      <FormSection title={t("taxes.advanced")}>
        <LinkRow
          hint={taxProfile.data ? `${taxProfile.data.name} · ${taxProfile.data.taxYear}` : undefined}
          label={t("taxes.systemValues")}
          onPress={() => router.push("/settings/tax-system")}
        />
      </FormSection>
    </FormScreen>
  );
}

/** Route: /settings/taxes */
export function TaxesScreen() {
  const settings = useSettings();
  return <QueryGate query={settings} title={i18n.t("taxes.title")}>{(data) => <TaxesForm settings={data} />}</QueryGate>;
}
