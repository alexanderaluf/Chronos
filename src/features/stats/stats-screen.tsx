import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { usePeriodReport, useYearReport } from "@/data/hooks/queries";
import { fromLocalDateKey, parsePeriodKey, toLocalDateKey } from "@/domain/time/time";
import { usePeriodNavigation } from "@/features/shifts/hooks/use-period-key";
import { usePrimaryCurrency } from "@/features/shifts/hooks/use-primary-currency";
import { formatDayLabel, formatHours, formatMonthLabel } from "@/shared/lib/format";
import { Text } from "@/shared/ui/app-text";
import { PayslipView } from "@/shared/ui/payslip-view";
import { PeriodSwitcher } from "@/shared/ui/period-switcher";
import { Panel, QueryState, Section, ValueRow } from "@/shared/ui/section";
import { TabPage } from "@/shared/ui/tab-page";

import { YearChart } from "./components/year-chart";
import { setSelectedStatsPeriod } from "./selected-period";

/** "My salary": hours, the payslip estimate, and the year at a glance. */
export function StatsScreen() {
  const { t } = useTranslation();
  const navigation = usePeriodNavigation();
  const report = usePeriodReport(navigation.periodKey);
  const year = useYearReport(parsePeriodKey(navigation.periodKey).year);
  const currency = usePrimaryCurrency();
  const summary = report.data;

  useEffect(() => setSelectedStatsPeriod(navigation.periodKey), [navigation.periodKey]);

  const periodLabel = summary
    ? summary.period.start.getDate() === 1
      ? formatMonthLabel(summary.period.start)
      : `${formatDayLabel(summary.period.start)} – ${formatDayLabel(
          fromLocalDateKey(toLocalDateKey(new Date(summary.period.end.getTime() - 1))),
        )}`
    : "";

  return (
    <TabPage>
      <PeriodSwitcher label={periodLabel} onNext={navigation.next} onPrevious={navigation.previous} onReset={navigation.reset} />

      {!summary ? (
        <QueryState error={report.error} />
      ) : (
        <>
          <Section title={t("stats.mySalary")}>
            <PayslipView currency={currency} payslip={summary.payslip} />
            <Text className="px-1 text-xs text-muted">
              {t("stats.estimateNote")}
            </Text>
          </Section>

          <Section title={t("stats.hours")}>
            <Panel>
              <ValueRow label={t("stats.shifts")} value={String(summary.shiftCount)} />
              <ValueRow label={t("stats.daysWorked")} value={String(summary.daysWorked)} />
              <ValueRow label={t("stats.regularHours")} value={formatHours(summary.regularMinutes)} />
              <ValueRow label={t("stats.overtimeHours")} value={formatHours(summary.overtimeMinutes)} />
              <ValueRow label={t("stats.nightShifts")} value={String(summary.nightShiftCount)} />
              <ValueRow label={t("stats.restDayShifts")} value={String(summary.restDayShiftCount)} />
              {summary.paidDays.length > 0 ? (
                <ValueRow label={t("stats.paidDays", { count: summary.paidDays.length })} value={formatHours(summary.paidDayMinutes)} />
              ) : null}
              <ValueRow emphasis label={t("stats.totalWorked")} value={formatHours(summary.workedMinutes)} />
            </Panel>
          </Section>

          {year.data ? (
            <Section title={t("stats.year", { year: parsePeriodKey(navigation.periodKey).year })}>
              <YearChart currency={currency} months={year.data} selected={navigation.periodKey} onSelect={navigation.goTo} />
            </Section>
          ) : null}
        </>
      )}
    </TabPage>
  );
}
