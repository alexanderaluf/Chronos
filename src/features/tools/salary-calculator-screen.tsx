import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useActiveTaxProfile, useActiveJob, usePayComponents, usePeriodReport, useSettings } from "@/data/hooks/queries";
import { globalSalaryEstimate, ISRAEL_2026_PAYROLL_RULES } from "@/domain/pay/global-salary";
import { quickSalaryEstimate } from "@/domain/pay/quick-calculator";
import { useCurrentPeriodKey } from "@/features/shifts/hooks/use-period-key";
import { formatStatementMoney } from "@/shared/lib/format";
import { FormSection, SwitchField, TextField } from "@/shared/ui/form/fields";
import { FormScreen } from "@/shared/ui/form/form-screen";
import {
  hoursInputToMinutes,
  hundredthsToInput,
  inputToBasisPoints,
  inputToHundredths,
  inputToMinor,
  inputToWholeNumber,
  minorToInput,
} from "@/shared/ui/form/input-format";
import { GlassSegmentedControl } from "@/shared/ui/glass-segmented-control";
import { PayslipView } from "@/shared/ui/payslip-view";
import { ValueRow } from "@/shared/ui/section";

type CalculatorMode = "hourly" | "global";

/** Credit points of the current payslip, or the resident's 2.25. */
function useDefaultCreditPoints() {
  const current = usePeriodReport(useCurrentPeriodKey());
  return hundredthsToInput(current.data?.payslip.creditPoints.totalHundredths ?? 225);
}

/** Shifts-style estimate: hours, overtime and travel days at an hourly wage. */
function HourlyCalculator({ currency }: { currency: string }) {
  const { t } = useTranslation();
  const job = useActiveJob();
  const settings = useSettings();
  const taxProfile = useActiveTaxProfile();
  const deductions = usePayComponents("deduction");
  const defaultPoints = useDefaultCreditPoints();

  const [hourlyRate, setHourlyRate] = useState<string | null>(null);
  const [hours, setHours] = useState("186");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [workDays, setWorkDays] = useState("22");
  const [travelPerDay, setTravelPerDay] = useState("0");
  const [creditPoints, setCreditPoints] = useState<string | null>(null);
  const [includeDeductions, setIncludeDeductions] = useState(true);

  // Defaults come from saved data once it has loaded; the user's edits win.
  const rateText = hourlyRate ?? (job.data ? minorToInput(job.data.hourlyRate) : "0");
  const pointsText = creditPoints ?? defaultPoints;

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
    <>
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
      {payslip ? <PayslipView currency={currency} payslip={payslip} /> : null}
    </>
  );
}

function ResultRow({ label, amount, currency, emphasis }: { label: string; amount: number; currency: string; emphasis?: boolean }) {
  return (
    <ValueRow
      className={`min-h-14 border-b-2 border-background px-5 py-4 ${emphasis ? "bg-surface-secondary/60" : ""}`}
      emphasis={emphasis}
      label={label}
      value={formatStatementMoney(amount, currency)}
      valueDirection="ltr"
    />
  );
}

/**
 * Global (monthly) salary for an Israeli employee: gross pay and its
 * additions, income tax with the pension credit, national and health
 * insurance, pension and study fund, then the employer's cost.
 */
function GlobalSalaryCalculator({ currency }: { currency: string }) {
  const { t } = useTranslation();
  const job = useActiveJob();
  const settings = useSettings();
  const taxProfile = useActiveTaxProfile();
  const defaultPoints = useDefaultCreditPoints();
  const rules = ISRAEL_2026_PAYROLL_RULES;

  const [salary, setSalary] = useState<string | null>(null);
  const [globalOvertime, setGlobalOvertime] = useState("0");
  const [travel, setTravel] = useState("0");
  const [convalescence, setConvalescence] = useState("0");
  const [otherAdditions, setOtherAdditions] = useState("0");
  const [benefit, setBenefit] = useState<string | null>(null);
  const [pensionEmployee, setPensionEmployee] = useState("6");
  const [pensionEmployer, setPensionEmployer] = useState("6.5");
  const [severance, setSeverance] = useState("6");
  const [hasStudyFund, setHasStudyFund] = useState(false);
  const [studyFundEmployee, setStudyFundEmployee] = useState("2.5");
  const [studyFundEmployer, setStudyFundEmployer] = useState("7.5");
  const [creditPoints, setCreditPoints] = useState<string | null>(null);

  // Defaults come from the active job and tax settings once loaded; the user's edits win.
  const salaryText = salary ?? (job.data && job.data.monthlySalary > 0 ? minorToInput(job.data.monthlySalary) : "0");
  const benefitText = benefit ?? minorToInput(settings.data?.taxStatus.taxableBenefitMonthly ?? 0);
  const pointsText = creditPoints ?? defaultPoints;

  const values = {
    baseSalary: inputToMinor(salaryText),
    globalOvertime: inputToMinor(globalOvertime),
    travel: inputToMinor(travel),
    convalescence: inputToMinor(convalescence),
    otherAdditions: inputToMinor(otherAdditions),
    taxableBenefit: inputToMinor(benefitText),
    pensionEmployeeBp: inputToBasisPoints(pensionEmployee),
    pensionEmployerBp: inputToBasisPoints(pensionEmployer),
    severanceBp: inputToBasisPoints(severance),
    studyFundEmployeeBp: hasStudyFund ? inputToBasisPoints(studyFundEmployee) : 0,
    studyFundEmployerBp: hasStudyFund ? inputToBasisPoints(studyFundEmployer) : 0,
    creditPointsHundredths: inputToHundredths(pointsText),
  };
  const complete = (Object.values(values) as (number | null)[]).every((value) => value !== null);
  const estimate =
    complete && taxProfile.data && settings.data
      ? globalSalaryEstimate({
          ...(values as { [K in keyof typeof values]: number }),
          taxRules: taxProfile.data.rules,
          taxStatus: settings.data.taxStatus,
          payrollRules: rules,
        })
      : null;
  const money = (amount: number) => formatStatementMoney(amount, currency);

  return (
    <>
      <FormSection title={t("calculator.salarySection")}>
        <TextField currencyCode={currency} keyboardType="decimal-pad" label={t("calculator.globalSalary")} value={salaryText} onChangeText={setSalary} />
        <TextField
          currencyCode={currency}
          hint={t("calculator.globalOvertimeHint")}
          keyboardType="decimal-pad"
          label={t("calculator.globalOvertime")}
          value={globalOvertime}
          onChangeText={setGlobalOvertime}
        />
        <TextField currencyCode={currency} keyboardType="decimal-pad" label={t("calculator.monthlyTravel")} value={travel} onChangeText={setTravel} />
        <TextField
          currencyCode={currency}
          hint={t("calculator.convalescenceHint", { amount: money(rules.convalescenceDayRate) })}
          keyboardType="decimal-pad"
          label={t("calculator.convalescence")}
          value={convalescence}
          onChangeText={setConvalescence}
        />
        <TextField
          currencyCode={currency}
          hint={t("calculator.otherAdditionsHint")}
          keyboardType="decimal-pad"
          label={t("calculator.otherAdditions")}
          value={otherAdditions}
          onChangeText={setOtherAdditions}
        />
        <TextField
          currencyCode={currency}
          hint={t("calculator.taxableBenefitHint")}
          keyboardType="decimal-pad"
          label={t("calculator.taxableBenefit")}
          value={benefitText}
          onChangeText={setBenefit}
        />
      </FormSection>

      <FormSection footnote={t("calculator.pensionFootnote")} title={t("calculator.pensionSection")}>
        <TextField keyboardType="decimal-pad" label={t("calculator.employeeDeposit")} suffix="%" value={pensionEmployee} onChangeText={setPensionEmployee} />
        <TextField keyboardType="decimal-pad" label={t("calculator.employerDeposit")} suffix="%" value={pensionEmployer} onChangeText={setPensionEmployer} />
        <TextField hint={t("calculator.severanceHint")} keyboardType="decimal-pad" label={t("calculator.severance")} suffix="%" value={severance} onChangeText={setSeverance} />
      </FormSection>

      <FormSection
        footnote={hasStudyFund ? t("calculator.studyFundFootnote", { amount: money(rules.studyFundSalaryCeiling) }) : undefined}
        title={t("calculator.studyFundSection")}
      >
        <SwitchField label={t("calculator.hasStudyFund")} value={hasStudyFund} onValueChange={setHasStudyFund} />
        {hasStudyFund ? (
          <>
            <TextField keyboardType="decimal-pad" label={t("calculator.employeeDeposit")} suffix="%" value={studyFundEmployee} onChangeText={setStudyFundEmployee} />
            <TextField keyboardType="decimal-pad" label={t("calculator.employerDeposit")} suffix="%" value={studyFundEmployer} onChangeText={setStudyFundEmployer} />
          </>
        ) : null}
      </FormSection>

      <FormSection title={t("calculator.taxSection")}>
        <TextField
          hint={t("calculator.creditPointsHint")}
          keyboardType="decimal-pad"
          label={t("calculator.creditPoints")}
          value={pointsText}
          onChangeText={setCreditPoints}
        />
      </FormSection>

      {estimate ? (
        <>
          <PayslipView currency={currency} payslip={estimate.payslip} />
          <FormSection footnote={t("calculator.globalNote")} title={t("calculator.employerSection")}>
            <ResultRow amount={estimate.employer.pension} currency={currency} label={t("calculator.employerPension")} />
            <ResultRow amount={estimate.employer.severance} currency={currency} label={t("calculator.severance")} />
            {estimate.employer.studyFund > 0 ? (
              <ResultRow amount={estimate.employer.studyFund} currency={currency} label={t("calculator.employerStudyFund")} />
            ) : null}
            <ResultRow amount={estimate.employer.nationalInsurance} currency={currency} label={t("calculator.employerNationalInsurance")} />
            <ResultRow amount={estimate.employer.totalCost} currency={currency} emphasis label={t("calculator.employerCost")} />
            <ResultRow amount={estimate.savings.pension} currency={currency} label={t("calculator.savedPension")} />
            {estimate.savings.studyFund > 0 ? (
              <ResultRow amount={estimate.savings.studyFund} currency={currency} label={t("calculator.savedStudyFund")} />
            ) : null}
          </FormSection>
        </>
      ) : null}
    </>
  );
}

/**
 * Route: /tools/calculator — "what would I earn?" without recording shifts:
 * by the hour, or a global (monthly) salary with every Israeli payslip item.
 * Starts from the user's own settings; recalculates on every keystroke.
 */
export function SalaryCalculatorScreen() {
  const { t } = useTranslation();
  const job = useActiveJob();
  const [chosenMode, setMode] = useState<CalculatorMode | null>(null);
  // A monthly job opens on the global salary.
  const mode = chosenMode ?? (job.data?.payType === "monthly" ? "global" : "hourly");
  const currency = job.data?.currencyCode ?? "ILS";

  return (
    <FormScreen
      intro={t(mode === "global" ? "calculator.introGlobal" : "calculator.intro")}
      title={t("calculator.title")}
      topControl={
        <GlassSegmentedControl
          accessibilityLabel={t("calculator.mode")}
          options={[
            { value: "hourly", label: t("calculator.modeHourly") },
            { value: "global", label: t("calculator.modeGlobal") },
          ]}
          value={mode}
          onChange={setMode}
        />
      }
    >
      {mode === "global" ? <GlobalSalaryCalculator currency={currency} /> : <HourlyCalculator currency={currency} />}
    </FormScreen>
  );
}
