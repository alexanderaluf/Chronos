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
import { ensureHolidayDataForRange, type HolidayLookup } from "../holidays/holiday-service";
import type { HolidayPaySettings } from "@/domain/holidays/holiday-settings";

/** The notice to show for a period: any problem first, then "ready", then "disabled". */
function combinedHolidayStatus(lookups: HolidayLookup[]): HolidayLookup["status"] {
  const statuses = lookups.map((lookup) => lookup.status);
  return statuses.find((status) => status !== "ready" && status !== "disabled")
    ?? (statuses.includes("ready") ? "ready" : "disabled");
}

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
  const lastShiftEnd = Math.max(period.end.getTime(), ...shifts.map((shift) => shift.endAt ? Date.parse(shift.endAt) : 0));
  // Each shift keeps the holiday settings it was saved with; look up each distinct one once.
  const holidayKey = (holidayPay: HolidayPaySettings) => JSON.stringify(holidayPay);
  const holidaySettings = new Map<string, HolidayPaySettings>();
  for (const shift of shifts) {
    const holidayPay = shift.holidayPay ?? settings.holidayPay;
    holidaySettings.set(holidayKey(holidayPay), holidayPay);
  }
  if (holidaySettings.size === 0) holidaySettings.set(holidayKey(settings.holidayPay), settings.holidayPay);
  const lookups = new Map<string, HolidayLookup>();
  await Promise.all([...holidaySettings].map(async ([key, holidayPay]) => {
    lookups.set(key, await ensureHolidayDataForRange(database, period.start, new Date(lastShiftEnd), holidayPay));
  }));
  return { ...summarizePeriod({
    holidayIntervalsFor: (shift) => lookups.get(holidayKey(shift.holidayPay ?? settings.holidayPay))?.intervals ?? [],
    period,
    jobs,
    shifts,
    paidDays,
    adjustments,
    components,
    taxRules: taxProfile.rules,
    taxStatus: settings.taxStatus,
    creditPoints,
  }), holidayStatus: combinedHolidayStatus([...lookups.values()]) };
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
