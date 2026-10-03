import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDefaultJob } from "@/data/hooks/queries";
import { saveSalarySettings } from "@/data/repositories/shifts-repository";
import type { Job } from "@/domain/entities";
import { agreementSupplement, hourlyPayWithAgreement, normalizeSalaryAgreement, type AgreementTreatment } from "@/domain/pay/salary-agreement";
import { divideRounded } from "@/domain/money/money";
import { useAppLocalization } from "@/localization/localization-provider";
import { formatStatementMoney } from "@/shared/lib/format";
import { ValueRow } from "@/shared/ui/section";
import type { PayType } from "@/domain/pay/shift-pay";
import { FormSection, LinkRow, SegmentedField, SwitchField, TextField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { basisPointsToInput, inputToBasisPoints, inputToMinor, inputToWholeNumber, minorToInput, required } from "@/shared/ui/form/input-format";
import { QueryGate } from "@/shared/ui/query-gate";
import { i18n } from "@/localization/i18n";

import { askShiftUpdateScope } from "./ask-shift-update-scope";

function SalarySettingsForm({ job }: { job: Job }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
  const { language } = useAppLocalization();
  const [agreement, setAgreement] = useState(() => normalizeSalaryAgreement(job.payRules.salaryAgreement));
  const [agreementRate, setAgreementRate] = useState(basisPointsToInput(agreement.rateBp));
  const previewAgreement = { ...agreement, rateBp: inputToBasisPoints(agreementRate) ?? 0 };
  const treatments: { value: AgreementTreatment; label: string }[] = [
    { value: "excluded", label: t("salaryAgreement.excluded") },
    { value: "flat", label: t("salaryAgreement.flat") },
    { value: "multiplied", label: t("salaryAgreement.multiplied") },
  ];
  const payTypes: { value: PayType; label: string }[] = [
    { value: "hourly", label: t("salary.hourly") },
    { value: "monthly", label: t("salary.monthly") },
  ];
  const [name, setName] = useState(job.name);
  const [payType, setPayType] = useState<PayType>(job.payType);
  const [hourlyRate, setHourlyRate] = useState(minorToInput(job.hourlyRate));
  const [shiftBonus, setShiftBonus] = useState(minorToInput(job.defaultShiftBonus));
  const [monthlySalary, setMonthlySalary] = useState(minorToInput(job.monthlySalary));
  const [divisor, setDivisor] = useState(String(job.monthlyHoursDivisor));
  const [currencyCode, setCurrencyCode] = useState(job.currencyCode);
  const [unpaidBreaks, setUnpaidBreaks] = useState(job.payRules.unpaidBreaks);
  const baseMonthly = inputToMinor(monthlySalary) ?? 0;
  const hours = inputToWholeNumber(divisor) ?? 0;
  const baseHourly = payType === "hourly" ? inputToMinor(hourlyRate) ?? 0 : hours > 0 ? divideRounded(baseMonthly, hours) : 0;
  const money = (amount: number) => formatStatementMoney(amount, currencyCode.trim().toUpperCase() || job.currencyCode, language);

  async function save() {
    const currency = currencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error(t("salary.currencyError"));
    const rateBp = inputToBasisPoints(agreementRate);
    if (agreement.enabled && (rateBp === null || rateBp > 100_000)) throw new Error(t("salaryAgreement.rateError"));
    const patch = {
      name,
      payType,
      hourlyRate: required(inputToMinor(hourlyRate), t("salary.hourlyWage")),
      defaultShiftBonus: required(inputToMinor(shiftBonus), t("salary.bonusTitle")),
      monthlySalary: required(inputToMinor(monthlySalary), t("salary.monthlySalary")),
      monthlyHoursDivisor: required(inputToWholeNumber(divisor), t("salary.monthlyHours")),
      currencyCode: currency,
      payRules: { ...job.payRules, unpaidBreaks, salaryAgreement: { ...agreement, rateBp: rateBp ?? agreement.rateBp } },
    };
    // Shifts keep their own copy of these values, so ask which shifts get the change.
    const changesShifts =
      patch.hourlyRate !== job.hourlyRate ||
      patch.defaultShiftBonus !== job.defaultShiftBonus ||
      unpaidBreaks !== job.payRules.unpaidBreaks ||
      JSON.stringify(normalizeSalaryAgreement(patch.payRules.salaryAgreement)) !== JSON.stringify(normalizeSalaryAgreement(job.payRules.salaryAgreement));
    const scope = changesShifts ? await askShiftUpdateScope() : "newShiftsOnly";
    if (!scope) return false;
    await saveSalarySettings(database, job.id, patch, scope);
  }

  return (
    <FormScreen
      intro={t("salary.intro")}
      title={t("salary.title")}
      onSave={save}
    >
      <FormSection>
        <TextField label={t("salary.jobName")} value={name} onChangeText={setName} />
        <SegmentedField label={t("salary.salaryType")} options={payTypes} value={payType} onChange={setPayType} />
        {payType === "hourly" ? (
          <TextField currencyCode={currencyCode.trim().toUpperCase() || job.currencyCode} keyboardType="decimal-pad" label={t("salaryAgreement.baseHourly")} value={hourlyRate} onChangeText={setHourlyRate} />
        ) : (
          <>
            <TextField currencyCode={currencyCode.trim().toUpperCase() || job.currencyCode} keyboardType="decimal-pad" label={t("salaryAgreement.baseMonthly")} value={monthlySalary} onChangeText={setMonthlySalary} />
            <TextField
              hint={t("salary.monthlyHoursHint")}
              keyboardType="number-pad"
              label={t("salary.monthlyHours")}
              value={divisor}
              onChangeText={setDivisor}
            />
          </>
        )}
        <TextField label={t("salary.currency")} placeholder="ILS" value={currencyCode} onChangeText={setCurrencyCode} />
      </FormSection>
      <FormSection title={t("salaryAgreement.title")} description={t("salaryAgreement.description")} footnote={agreement.enabled ? t("salaryAgreement.treatmentHint") : undefined}>
        <SwitchField label={t("salaryAgreement.enabled")} value={agreement.enabled} onValueChange={(enabled) => setAgreement({ ...agreement, enabled })} />
        {agreement.enabled ? <>
          <TextField keyboardType="decimal-pad" label={t("salaryAgreement.rate")} value={agreementRate} onChangeText={setAgreementRate} />
          <SegmentedField label={t("salaryAgreement.overtime")} options={treatments} value={agreement.overtime} onChange={(overtime) => setAgreement({ ...agreement, overtime })} />
          <SegmentedField label={t("salaryAgreement.restDay")} options={treatments} value={agreement.restDay} onChange={(restDay) => setAgreement({ ...agreement, restDay })} />
          <SegmentedField label={t("salaryAgreement.holiday")} options={treatments} value={agreement.holiday} onChange={(holiday) => setAgreement({ ...agreement, holiday })} />
          <SwitchField label={t("salaryAgreement.night")} hint={t("salaryAgreement.nightHint")} value={agreement.nightPremium} onValueChange={(nightPremium) => setAgreement({ ...agreement, nightPremium })} />
          <ValueRow className="px-4 py-3" label={t("salaryAgreement.regularPreview")} value={money(hourlyPayWithAgreement(baseHourly, previewAgreement))} valueDirection="ltr" />
          <ValueRow className="px-4 py-3" label={t("salaryAgreement.restPreview")} value={money(hourlyPayWithAgreement(baseHourly, previewAgreement, job.payRules.restDayRateBp, true))} valueDirection="ltr" />
          {payType === "monthly" ? <ValueRow className="px-4 py-3" label={t("salaryAgreement.monthlyPreview")} note={t("salaryAgreement.monthlyHint")} value={money(baseMonthly + agreementSupplement(baseMonthly, previewAgreement))} valueDirection="ltr" /> : null}
        </> : null}
      </FormSection>
      <FormSection
        description={t("salary.bonusDescription")}
        title={t("salary.bonusTitle")}
      >
        <TextField currencyCode={currencyCode.trim().toUpperCase() || job.currencyCode} keyboardType="decimal-pad" label={t("salary.bonusTitle")} value={shiftBonus} onChangeText={setShiftBonus} />
      </FormSection>
      <FormSection title={t("salary.breaks")}>
        <SwitchField
          hint={t("salary.unpaidBreaksHint")}
          label={t("salary.unpaidBreaks")}
          value={unpaidBreaks}
          onValueChange={setUnpaidBreaks}
        />
      </FormSection>
      <FormSection>
        <LinkRow icon="calendar" iconBackground="#ffc975" label={t("holidayPay.title")} onPress={() => router.push("/settings/holiday-pay")} />
      </FormSection>
    </FormScreen>
  );
}

/** Route: /settings/salary */
export function SalarySettingsScreen() {
  const job = useDefaultJob();
  return <QueryGate query={job} title={i18n.t("salary.title")}>{(data) => <SalarySettingsForm job={data} />}</QueryGate>;
}
