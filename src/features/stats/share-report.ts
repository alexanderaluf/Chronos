import { Share } from "react-native";

import type { EmployerInfo } from "@/domain/entities";
import type { PeriodSummary } from "@/domain/pay/period-summary";
import { fromIso, fromLocalDateKey, parsePeriodKey } from "@/domain/time/time";
import { i18n } from "@/localization/i18n";
import { payslipLineLabel } from "@/localization/labels";
import { formatDayLabel, formatHours, formatMoney, formatMonthLabel, formatTime } from "@/shared/lib/format";

/** Plain-text monthly report (in the app language): hours per shift and the payslip estimate. */
export function buildMonthlyReport(summary: PeriodSummary, currency: string, employer: EmployerInfo): string {
  const t = i18n.t;
  const money = (amount: number) => formatMoney(amount, currency);
  const { year, month } = parsePeriodKey(summary.period.key);
  const payslip = summary.payslip;
  const lines: string[] = [t("report.title", { month: formatMonthLabel(new Date(year, month - 1, 1)) })];
  if (employer.name) lines.push(t("report.employer", { name: employer.name }));
  if (employer.notes) lines.push(employer.notes);
  if (summary.holidayStatus && summary.holidayStatus !== "ready" && summary.holidayStatus !== "disabled") {
    lines.push(t(`holidayPay.status.${summary.holidayStatus}`));
  }
  lines.push("", t("report.shiftsHeading"));
  for (const { shift, pay } of summary.shifts) {
    const start = fromIso(shift.startAt);
    const end = shift.endAt ? fromIso(shift.endAt) : start;
    const overtime = pay.overtimeMinutes > 0 ? ` (${t("report.overtime", { hours: formatHours(pay.overtimeMinutes) })})` : "";
    lines.push(
      `${formatDayLabel(start)}  ${formatTime(start)}–${formatTime(end)}  ${formatHours(pay.workedMinutes)}${overtime}${
        shift.label ? `  ${shift.label}` : ""
      }`,
    );
    if (pay.holidayMinutes > 0) lines.push(`  ${t("holidayPay.saved", { hours: formatHours(pay.holidayMinutes) })}`);
  }
  for (const { paidDay } of summary.paidDays) {
    lines.push(
      t("report.paidDayLine", {
        date: formatDayLabel(fromLocalDateKey(paidDay.date)),
        kind: t(`shiftRow.kinds.${paidDay.kind}`),
        hours: formatHours(paidDay.minutes),
      }),
    );
  }
  lines.push(
    "",
    t("report.totals", { shifts: summary.shiftCount, days: summary.daysWorked }),
    t("report.hoursTotals", { hours: formatHours(summary.workedMinutes), overtime: formatHours(summary.overtimeMinutes) }),
    "",
    t("report.salaryHeading"),
    ...payslip.earnings.map((line) => `${payslipLineLabel(line)}: ${money(line.amount)}`),
    t("report.gross", { amount: money(payslip.gross) }),
    ...[...payslip.mandatoryLines, ...payslip.voluntaryLines].map((line) => `${payslipLineLabel(line)}: −${money(line.amount)}`),
    t("report.net", { amount: money(payslip.net) }),
  );
  return lines.join("\n");
}

/** Opens the system share sheet (mail, WhatsApp, files…). Nothing is uploaded by Chronos. */
export async function shareMonthlyReport(summary: PeriodSummary, currency: string, employer: EmployerInfo) {
  const { year, month } = parsePeriodKey(summary.period.key);
  await Share.share({
    title: i18n.t("report.shareTitle", { month: formatMonthLabel(new Date(year, month - 1, 1)) }),
    message: buildMonthlyReport(summary, currency, employer),
  });
}
