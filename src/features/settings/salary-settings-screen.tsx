import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDefaultJob } from "@/data/hooks/queries";
import { updateJob } from "@/data/repositories/jobs-repository";
import type { Job } from "@/domain/entities";
import type { PayType } from "@/domain/pay/shift-pay";
import { FormSection, SegmentedField, SwitchField, TextField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import { inputToMinor, inputToWholeNumber, minorToInput, required } from "@/shared/ui/form/input-format";
import { QueryGate } from "@/shared/ui/query-gate";
import { i18n } from "@/localization/i18n";

function SalarySettingsForm({ job }: { job: Job }) {
  const { t } = useTranslation();
  const database = useSQLiteContext();
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

  async function save() {
    const currency = currencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error(t("salary.currencyError"));
    await updateJob(database, job.id, {
      name,
      payType,
      hourlyRate: required(inputToMinor(hourlyRate), t("salary.hourlyWage")),
      defaultShiftBonus: required(inputToMinor(shiftBonus), t("salary.bonusTitle")),
      monthlySalary: required(inputToMinor(monthlySalary), t("salary.monthlySalary")),
      monthlyHoursDivisor: required(inputToWholeNumber(divisor), t("salary.monthlyHours")),
      currencyCode: currency,
      payRules: { ...job.payRules, unpaidBreaks },
    });
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
          <TextField keyboardType="decimal-pad" label={t("salary.hourlyWage")} value={hourlyRate} onChangeText={setHourlyRate} />
        ) : (
          <>
            <TextField keyboardType="decimal-pad" label={t("salary.monthlySalary")} value={monthlySalary} onChangeText={setMonthlySalary} />
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
      <FormSection
        description={t("salary.bonusDescription")}
        title={t("salary.bonusTitle")}
      >
        <TextField keyboardType="decimal-pad" label={t("salary.bonusTitle")} value={shiftBonus} onChangeText={setShiftBonus} />
      </FormSection>
      <FormSection title={t("salary.breaks")}>
        <SwitchField
          hint={t("salary.unpaidBreaksHint")}
          label={t("salary.unpaidBreaks")}
          value={unpaidBreaks}
          onValueChange={setUnpaidBreaks}
        />
      </FormSection>
    </FormScreen>
  );
}

/** Route: /settings/salary */
export function SalarySettingsScreen() {
  const job = useDefaultJob();
  return <QueryGate query={job} title={i18n.t("salary.title")}>{(data) => <SalarySettingsForm job={data} />}</QueryGate>;
}
