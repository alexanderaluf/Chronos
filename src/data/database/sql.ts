import { randomUUID } from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";

/** Table names, so change listeners and queries agree on spelling. */
export const TABLES = {
  settings: "settings",
  holidayCache: "holiday_year_cache",
  jobs: "jobs",
  shifts: "shifts",
  payAdjustments: "pay_adjustments",
  taxProfiles: "tax_profiles",
  paidDays: "paid_days",
  shiftTemplates: "shift_templates",
  payComponents: "pay_components",
  plannedShifts: "planned_shifts",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toSqlBoolean(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

export function fromSqlBoolean(value: number | null | undefined): boolean {
  return value === 1;
}

export function parseJson(json: string | null | undefined): unknown {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/** Thrown when a write would break a data rule (overlapping shifts, invalid times…). */
export class DataValidationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "DataValidationError";
  }
}

const writeQueues = new WeakMap<SQLiteDatabase, Promise<unknown>>();

/**
 * Every write in the app goes through here.
 *
 * Writes run one at a time on the main connection (which has foreign keys
 * enabled) inside a transaction: either everything in `task` is saved, or
 * nothing is. Never call `runAsync` for a write outside this function.
 */
export function writeTransaction<T>(
  database: SQLiteDatabase,
  task: (database: SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const previous = writeQueues.get(database) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      let result!: T;
      await database.withTransactionAsync(async () => {
        result = await task(database);
      });
      return result;
    });
  writeQueues.set(database, next);
  return next;
}
