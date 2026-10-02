import type { Job, PayComponentKind } from "@/domain/entities";
import type { LocalDateKey, PeriodKey } from "@/domain/time/time";

import { TABLES } from "../database/sql";
import { loadPeriodReport, loadYearReport } from "../reports/period-report";
import { getAdjustment, listAdjustmentsForPeriod } from "../repositories/adjustments-repository";
import { getJob, listJobs } from "../repositories/jobs-repository";
import { getPaidDay } from "../repositories/paid-days-repository";
import { getPayComponent, listPayComponents } from "../repositories/pay-components-repository";
import { getNextPlannedShift, listPlannedShifts } from "../repositories/planned-shifts-repository";
import { getSettings } from "../repositories/settings-repository";
import { getShiftTemplate, listShiftTemplates } from "../repositories/shift-templates-repository";
import { getOpenShift, getShift, listRecentShifts } from "../repositories/shifts-repository";
import { getActiveTaxProfile } from "../repositories/tax-profiles-repository";
import { useLiveQuery } from "./use-live-query";

/**
 * Ready-made live queries for screens. Each lists the tables it reads, so it
 * reloads whenever one of them changes.
 */

const REPORT_TABLES = [
  TABLES.holidayCache,
  TABLES.shifts,
  TABLES.jobs,
  TABLES.payAdjustments,
  TABLES.taxProfiles,
  TABLES.settings,
  TABLES.paidDays,
  TABLES.payComponents,
] as const;

// ─── Settings & profile ─────────────────────────────────────────────────────

export function useSettings() {
  return useLiveQuery("settings", [TABLES.settings], getSettings);
}

export function useActiveTaxProfile() {
  return useLiveQuery("tax-profile", [TABLES.taxProfiles], getActiveTaxProfile);
}

// ─── Jobs ───────────────────────────────────────────────────────────────────

export function useJobs() {
  return useLiveQuery("jobs", [TABLES.jobs], (db) => listJobs(db));
}

export function useJob(id: string) {
  return useLiveQuery(`job:${id}`, [TABLES.jobs], (db) => getJob(db, id));
}

/** The default job (Settings → Salary settings edits this one). */
export function useDefaultJob() {
  return useLiveQuery("default-job", [TABLES.jobs, TABLES.settings], async (db): Promise<Job | null> => {
    const settings = await getSettings(db);
    const job = settings.defaultJobId ? await getJob(db, settings.defaultJobId) : null;
    return job ?? (await listJobs(db)).at(0) ?? null;
  });
}

// ─── Shifts & days ──────────────────────────────────────────────────────────

export function useOpenShift() {
  return useLiveQuery("open-shift", [TABLES.shifts], getOpenShift);
}

export function useShift(id: string) {
  return useLiveQuery(`shift:${id}`, [TABLES.shifts], (db) => getShift(db, id));
}

export function useRecentShifts(limit = 20) {
  return useLiveQuery(`recent-shifts:${limit}`, [TABLES.shifts], (db) => listRecentShifts(db, limit));
}

export function usePaidDay(id: string) {
  return useLiveQuery(`paid-day:${id}`, [TABLES.paidDays], (db) => getPaidDay(db, id));
}

export function useShiftTemplates() {
  return useLiveQuery("templates", [TABLES.shiftTemplates], listShiftTemplates);
}

export function useShiftTemplate(id: string) {
  return useLiveQuery(`template:${id}`, [TABLES.shiftTemplates], (db) => getShiftTemplate(db, id));
}

export function usePlannedShifts(from: LocalDateKey, to: LocalDateKey) {
  return useLiveQuery(`planned:${from}:${to}`, [TABLES.plannedShifts], (db) => listPlannedShifts(db, from, to));
}

export function useNextPlannedShift(from: LocalDateKey) {
  return useLiveQuery(`next-planned:${from}`, [TABLES.plannedShifts], (db) => getNextPlannedShift(db, from));
}

// ─── Pay items ──────────────────────────────────────────────────────────────

export function usePayComponents(kind: PayComponentKind) {
  return useLiveQuery(`components:${kind}`, [TABLES.payComponents], (db) => listPayComponents(db, kind));
}

export function usePayComponent(id: string) {
  return useLiveQuery(`component:${id}`, [TABLES.payComponents], (db) => getPayComponent(db, id));
}

export function useAdjustments(periodKey: PeriodKey) {
  return useLiveQuery(`adjustments:${periodKey}`, [TABLES.payAdjustments], (db) =>
    listAdjustmentsForPeriod(db, periodKey),
  );
}

export function useAdjustment(id: string) {
  return useLiveQuery(`adjustment:${id}`, [TABLES.payAdjustments], (db) => getAdjustment(db, id));
}

// ─── Reports ────────────────────────────────────────────────────────────────

export function usePeriodReport(periodKey: PeriodKey) {
  return useLiveQuery(`period:${periodKey}`, REPORT_TABLES, (db) => loadPeriodReport(db, periodKey));
}

export function useYearReport(year: number) {
  return useLiveQuery(`year:${year}`, REPORT_TABLES, (db) => loadYearReport(db, year));
}
