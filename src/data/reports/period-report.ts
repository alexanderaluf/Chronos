import type { SQLiteDatabase } from "expo-sqlite";

import { summarizePeriod, type PeriodSummary } from "@/domain/pay/period-summary";
import { resolveCreditPoints } from "@/domain/tax/credit-points";
import { getPayPeriod, toLocalDateKey, toPeriodKey, type PeriodKey } from "@/domain/time/time";

import { listAdjustmentsForPeriod } from "../repositories/adjustments-repository";
import { listJobs } from "../repositories/jobs-repository";
import { listPaidDaysBetween } from "../repositories/paid-days-repository";
import { listPayComponents } from "../repositories/pay-components-repository";
import { getSettings } from "../repositories/settings-repository";
import { listShiftsStartingBetween } from "../repositories/shifts-repository";
import { getActiveTaxProfile } from "../repositories/tax-profiles-repository";

/** Loads everything for one pay period and runs the salary calculation. */
export async function loadPeriodReport(database: SQLiteDatabase, periodKey: PeriodKey): Promise<PeriodSummary> {
  const settings = await getSettings(database);
  const period = getPayPeriod(periodKey, settings.payPeriodStartDay);
  const [jobs, shifts, paidDays, adjustments, components, taxProfile] = await Promise.all([
    // Archived jobs are still needed to price their old shifts.
    listJobs(database, { includeArchived: true }),
    listShiftsStartingBetween(database, period.start, period.end),
    listPaidDaysBetween(database, toLocalDateKey(period.start), toLocalDateKey(period.end)),
    listAdjustmentsForPeriod(database, periodKey),
    listPayComponents(database),
    getActiveTaxProfile(database),
  ]);
  const creditPoints = resolveCreditPoints(
    settings.personalInfo,
    settings.taxStatus,
    taxProfile.rules.creditPointRules,
    period.start.getFullYear(),
  );
  return summarizePeriod({
    period,
    jobs,
    shifts,
    paidDays,
    adjustments,
    components,
    taxRules: taxProfile.rules,
    taxStatus: settings.taxStatus,
    creditPoints,
  });
}

export type YearMonth = { periodKey: PeriodKey; gross: number; net: number; workedMinutes: number; shiftCount: number };

/** Gross / net / hours for each month of a year — for the yearly graph. */
export async function loadYearReport(database: SQLiteDatabase, year: number): Promise<YearMonth[]> {
  const months: YearMonth[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const periodKey = toPeriodKey(year, month);
    const summary = await loadPeriodReport(database, periodKey);
    const hasData = summary.shiftCount > 0 || summary.paidDays.length > 0;
    months.push({
      periodKey,
      gross: hasData ? summary.payslip.gross : 0,
      net: hasData ? summary.payslip.net : 0,
      workedMinutes: summary.workedMinutes,
      shiftCount: summary.shiftCount,
    });
  }
  return months;
}
