import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useActiveTaxProfile, useDefaultJob, usePayComponents, usePeriodReport, useSettings } from "@/data/hooks/queries";
import { quickSalaryEstimate } from "@/domain/pay/quick-calculator";
import { useCurrentPeriodKey } from "@/features/shifts/hooks/use-period-key";
import { FormSection, SwitchField, TextField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import {
  hoursInputToMinutes,
  hundredthsToInput,
  inputToHundredths,
  inputToMinor,
  inputToWholeNumber,
  minorToInput,
} from "@/shared/ui/form/input-format";
import { PayslipView } from "@/shared/ui/payslip-view";

/**
 * Route: /tools/calculator — "what would I earn?" without recording shifts.
 * Starts from the user's own settings; recalculates on every keystroke.
 */
export function SalaryCalculatorScreen() {
  const { t } = useTranslation();
  const job = useDefaultJob();
  const settings = useSettings();
  const taxProfile = useActiveTaxProfile();
  const deductions = usePayComponents("deduction");
  const current = usePeriodReport(useCurrentPeriodKey());

  const [hourlyRate, setHourlyRate] = useState<string | null>(null);
  const [hours, setHours] = useState("186");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [workDays, setWorkDays] = useState("22");
  const [travelPerDay, setTravelPerDay] = useState("0");
  const [creditPoints, setCreditPoints] = useState<string | null>(null);
  const [includeDeductions, setIncludeDeductions] = useState(true);

  // Defaults come from saved data once it has loaded; the user's edits win.
  const rateText = hourlyRate ?? (job.data ? minorToInput(job.data.hourlyRate) : "0");
  const pointsText = creditPoints ?? hundredthsToInput(current.data?.payslip.creditPoints.totalHundredths ?? 225);

  const values = {
    hourlyRate: inputToMinor(rateText),
    regularMinutes: hoursInputToMinutes(hours),
    overtimeMinutes: hoursInputToMinutes(overtimeHours),
    workDays: inputToWholeNumber(workDays),
    travelPerDay: inputToMinor(travelPerDay),
    creditPoints: inputToHundredths(pointsText),
  };
  const valid = Object.values(values).every((value) => value !== null);
  const payslip =
    valid && taxProfile.data && settings.data
      ? quickSalaryEstimate({
          hourlyRate: values.hourlyRate!,
          regularMinutes: values.regularMinutes!,
          overtimeMinutes: values.overtimeMinutes!,
          overtimeRateBp: job.data?.payRules.overtimeTier1RateBp ?? 12_500,
          workDays: values.workDays!,
          travelPerDay: values.travelPerDay!,
          creditPointsHundredths: values.creditPoints!,
          taxRules: taxProfile.data.rules,
          taxStatus: settings.data.taxStatus,
          deductions: includeDeductions ? (deductions.data ?? []) : [],
        })
      : null;

  return (
    <FormScreen
      intro={t("calculator.intro")}
      title={t("calculator.title")}
    >
      <FormSection>
        <TextField keyboardType="decimal-pad" label={t("calculator.hourlyWage")} value={rateText} onChangeText={setHourlyRate} />
        <TextField keyboardType="decimal-pad" label={t("calculator.workHours")} suffix={t("units.hoursSuffix")} value={hours} onChangeText={setHours} />
        <TextField keyboardType="decimal-pad" label={t("calculator.overtimeHours")} suffix={t("units.hoursSuffix")} value={overtimeHours} onChangeText={setOvertimeHours} />
        <TextField keyboardType="number-pad" label={t("calculator.workDays")} value={workDays} onChangeText={setWorkDays} />
        <TextField keyboardType="decimal-pad" label={t("calculator.dailyTravel")} value={travelPerDay} onChangeText={setTravelPerDay} />
        <TextField keyboardType="decimal-pad" label={t("calculator.creditPoints")} value={pointsText} onChangeText={setCreditPoints} />
        <SwitchField
          hint={t("calculator.includeDeductionsHint")}
          label={t("calculator.includeDeductions")}
          value={includeDeductions}
          onValueChange={setIncludeDeductions}
        />
      </FormSection>
      {payslip ? <PayslipView currency={job.data?.currencyCode ?? "ILS"} payslip={payslip} /> : null}
    </FormScreen>
  );
}
