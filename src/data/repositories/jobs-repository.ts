import type { SQLiteDatabase } from "expo-sqlite";

import type { Job } from "@/domain/entities";
import { ISRAEL_DEFAULT_PAY_RULES, normalizePayRules } from "@/domain/pay/pay-rules";

import { DataValidationError, newId, nowIso, parseJson, writeTransaction } from "../database/sql";

/** Jobs are never deleted — old shifts keep pointing at them. Archive instead. */

type JobRow = {
  id: string;
  name: string;
  color: string;
  pay_type: "hourly" | "monthly";
  hourly_rate_minor: number;
  default_shift_bonus_minor: number;
  monthly_salary_minor: number;
  monthly_hours_divisor: number;
  currency_code: string;
  travel_per_day_minor: number;
  pay_rules_json: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    payType: row.pay_type,
    hourlyRate: row.hourly_rate_minor,
    defaultShiftBonus: row.default_shift_bonus_minor,
    monthlySalary: row.monthly_salary_minor,
    monthlyHoursDivisor: row.monthly_hours_divisor,
    currencyCode: row.currency_code,
    travelPerDay: row.travel_per_day_minor,
    payRules: normalizePayRules(parseJson(row.pay_rules_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

export type JobInput = Pick<
  Job,
  | "name"
  | "color"
  | "payType"
  | "hourlyRate"
  | "defaultShiftBonus"
  | "monthlySalary"
  | "monthlyHoursDivisor"
  | "currencyCode"
  | "travelPerDay"
  | "payRules"
>;

function validateJob(input: JobInput) {
  if (!input.name.trim()) throw new DataValidationError("A job needs a name.", "job/name-required");
  for (const [label, value] of [
    ["Hourly rate", input.hourlyRate],
    ["Bonus per shift", input.defaultShiftBonus],
    ["Monthly salary", input.monthlySalary],
    ["Travel allowance", input.travelPerDay],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new DataValidationError(`${label} must be zero or more.`, "job/invalid-amount");
    }
  }
  if (!Number.isInteger(input.monthlyHoursDivisor) || input.monthlyHoursDivisor <= 0) {
    throw new DataValidationError("Monthly hours must be more than zero.", "job/invalid-divisor");
  }
}

export async function listJobs(
  database: SQLiteDatabase,
  { includeArchived = false } = {},
): Promise<Job[]> {
  const rows = await database.getAllAsync<JobRow>(
    `SELECT * FROM jobs ${includeArchived ? "" : "WHERE archived_at IS NULL"} ORDER BY created_at`,
  );
  return rows.map(toJob);
}

export async function getJob(database: SQLiteDatabase, id: string): Promise<Job | null> {
  const row = await database.getFirstAsync<JobRow>("SELECT * FROM jobs WHERE id = ?", id);
  return row ? toJob(row) : null;
}

export const DEFAULT_JOB_INPUT: JobInput = {
  name: "",
  color: "#087e8b",
  payType: "hourly",
  hourlyRate: 0,
  defaultShiftBonus: 0,
  monthlySalary: 0,
  monthlyHoursDivisor: 182,
  currencyCode: "ILS",
  travelPerDay: 0,
  payRules: ISRAEL_DEFAULT_PAY_RULES,
};

export async function createJob(database: SQLiteDatabase, input: JobInput): Promise<Job> {
  validateJob(input);
  const id = newId();
  const now = nowIso();
  await writeTransaction(database, (db) =>
    db.runAsync(
      `INSERT INTO jobs (id, name, color, pay_type, hourly_rate_minor, default_shift_bonus_minor, monthly_salary_minor,
         monthly_hours_divisor, currency_code, travel_per_day_minor, pay_rules_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.name.trim(),
      input.color,
      input.payType,
      input.hourlyRate,
      input.defaultShiftBonus,
      input.monthlySalary,
      input.monthlyHoursDivisor,
      input.currencyCode,
      input.travelPerDay,
      JSON.stringify(normalizePayRules(input.payRules)),
      now,
      now,
    ),
  );
  return (await getJob(database, id))!;
}

/**
 * Updating a job's rate does NOT change past shifts: each shift keeps the
 * hourly rate it was recorded with.
 */
export async function updateJob(
  database: SQLiteDatabase,
  id: string,
  patch: Partial<JobInput>,
): Promise<Job> {
  return writeTransaction(database, (db) => writeJob(db, id, patch));
}

/** `updateJob` for code already inside `writeTransaction` (transactions cannot nest). */
export async function writeJob(db: SQLiteDatabase, id: string, patch: Partial<JobInput>): Promise<Job> {
  const current = await getJob(db, id);
  if (!current) throw new DataValidationError("This job no longer exists.", "job/not-found");
  const next = { ...current, ...patch };
  validateJob(next);
  await db.runAsync(
    `UPDATE jobs SET name = ?, color = ?, pay_type = ?, hourly_rate_minor = ?, default_shift_bonus_minor = ?, monthly_salary_minor = ?,
       monthly_hours_divisor = ?, currency_code = ?, travel_per_day_minor = ?, pay_rules_json = ?, updated_at = ?
     WHERE id = ?`,
    next.name.trim(),
    next.color,
    next.payType,
    next.hourlyRate,
    next.defaultShiftBonus,
    next.monthlySalary,
    next.monthlyHoursDivisor,
    next.currencyCode,
    next.travelPerDay,
    JSON.stringify(normalizePayRules(next.payRules)),
    nowIso(),
    id,
  );
  return (await getJob(db, id))!;
}

export async function setJobArchived(database: SQLiteDatabase, id: string, archived: boolean) {
  await writeTransaction(database, (db) =>
    db.runAsync(
      "UPDATE jobs SET archived_at = ?, updated_at = ? WHERE id = ?",
      archived ? nowIso() : null,
      nowIso(),
      id,
    ),
  );
}
