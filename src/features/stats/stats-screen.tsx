import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { usePeriodReport, useYearReport } from "@/data/hooks/queries";
import { useAppLocalization } from "@/localization/localization-provider";
import { parsePeriodKey } from "@/domain/time/time";
import { usePeriodNavigation } from "@/features/shifts/hooks/use-period-key";
import { usePrimaryCurrency } from "@/features/shifts/hooks/use-primary-currency";
import { formatDate, formatHours, formatStatementMoney as formatMoney, formatMonthLabel, formatNumber } from "@/shared/lib/format";
import { Text, TextAlignmentProvider } from "@/shared/ui/app-text";
import { FilledIcon } from "@/shared/ui/filled-icon";
import { FormSection } from "@/shared/ui/form/fields";
import { HolidayPayNotice } from "@/shared/ui/holiday-pay-notice";
import { PayslipView } from "@/shared/ui/payslip-view";
import { PeriodSwitcher } from "@/shared/ui/period-switcher";
import { QueryState, ValueRow } from "@/shared/ui/section";
import { TabPage } from "@/shared/ui/tab-page";

import { YearChart } from "./components/year-chart";
import { setSelectedStatsPeriod } from "./selected-period";

/** "My salary": hours, the payslip estimate, and the year at a glance. */
export function StatsScreen() {
  const { t } = useTranslation();
  const { language, direction } = useAppLocalization();
  const navigation = usePeriodNavigation();
  const report = usePeriodReport(navigation.periodKey);
  const year = useYearReport(parsePeriodKey(navigation.periodKey).year);
  const currency = usePrimaryCurrency();
  const summary = report.data;

  useEffect(() => setSelectedStatsPeriod(navigation.periodKey), [navigation.periodKey]);

  const periodLabel = summary
    ? summary.period.start.getDate() === 1
      ? formatMonthLabel(summary.period.start, language)
      : `${formatDate(summary.period.start)} – ${formatDate(new Date(summary.period.end.getTime() - 1))}`
    : "";

  return (
    <TextAlignmentProvider>
      <TabPage>
        <Text accessibilityRole="header" className="pt-3 font-manrope-bold text-2xl">
          {t("stats.mySalary")}
        </Text>
        <PeriodSwitcher label={periodLabel} onNext={navigation.next} onPrevious={navigation.previous} onReset={navigation.reset} />

        {!summary ? (
          <QueryState error={report.error} errorText={t("stats.loadError")} />
        ) : (
          <View className="gap-6">
            <HolidayPayNotice status={summary.holidayStatus} />
            <View className="gap-5 rounded-[28px] bg-surface p-5">
              <View className="flex-row items-center gap-3" style={{ direction }}>
                <View className="size-12 items-center justify-center rounded-[14px] bg-accent/15">
                  <FilledIcon name="wallet" size={26} tone="accent" />
                </View>
                <Text className="min-w-0 flex-1 font-manrope-semibold text-base text-muted">{t("home.netEstimate")}</Text>
              </View>
              <Text className="font-manrope-bold text-4xl text-accent" adjustsFontSizeToFit numberOfLines={1} style={{ fontVariant: ["tabular-nums"], writingDirection: "ltr" }}>
                {formatMoney(summary.payslip.net, currency)}
              </Text>
              <View className="gap-2 border-t-2 border-background pt-4">
                <ValueRow valueDirection="ltr" label={t("payslip.grossSalary")} value={formatMoney(summary.payslip.gross, currency)} />
                <ValueRow valueDirection="ltr" label={t("stats.deductions")} value={formatMoney(-summary.payslip.totalDeductions, currency)} valueClassName="text-danger" />
              </View>
            </View>

            <PayslipView grouped currency={currency} payslip={summary.payslip} />

            <FormSection title={t("stats.hours")}>
              {[
                { label: t("stats.shifts"), value: formatNumber(summary.shiftCount) },
                { label: t("stats.daysWorked"), value: formatNumber(summary.daysWorked) },
                { label: t("stats.regularHours"), value: formatHours(summary.regularMinutes) },
                { label: t("stats.overtimeHours"), value: formatHours(summary.overtimeMinutes) },
                { label: t("holidayPay.holiday"), value: formatHours(summary.shifts.reduce((sum, item) => sum + item.pay.holidayMinutes, 0)) },
                { label: t("stats.nightShifts"), value: formatNumber(summary.nightShiftCount) },
                { label: t("stats.restDayShifts"), value: formatNumber(summary.restDayShiftCount) },
                ...(summary.paidDays.length > 0 ? [{ label: t("stats.paidDays", { count: summary.paidDays.length }), value: formatHours(summary.paidDayMinutes) }] : []),
              ].map((row) => (
                <ValueRow key={row.label} className="min-h-14 border-b-2 border-background px-5 py-4" {...row} />
              ))}
              <ValueRow className="min-h-16 bg-accent/10 px-5 py-4" emphasis label={t("stats.totalWorked")} value={formatHours(summary.workedMinutes)} valueClassName="text-accent" />
            </FormSection>

            {year.data ? (
              <FormSection title={t("stats.year", { year: parsePeriodKey(navigation.periodKey).year })}>
                <YearChart currency={currency} months={year.data} selected={navigation.periodKey} onSelect={navigation.goTo} />
              </FormSection>
            ) : year.error ? <QueryState error={year.error} errorText={t("stats.loadError")} /> : null}
          </View>
        )}
      </TabPage>
    </TextAlignmentProvider>
  );
}
