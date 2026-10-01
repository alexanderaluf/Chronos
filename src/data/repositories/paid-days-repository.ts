import type { SQLiteDatabase } from "expo-sqlite";

import type { PaidDay, PaidDayKind } from "@/domain/entities";
import type { LocalDateKey } from "@/domain/time/time";

import { DataValidationError, newId, nowIso, writeTransaction } from "../database/sql";
import { getJob } from "./jobs-repository";

/** Vacation, sick and paid-holiday days. Soft-deleted like shifts. */

type PaidDayRow = {
  id: string;
  job_id: string;
  date: string;
  kind: PaidDayKind;
  minutes: number;
  rate_bp: number;
  hourly_rate_minor: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toPaidDay(row: PaidDayRow): PaidDay {
  return {
    id: row.id,
    jobId: row.job_id,
    date: row.date,
    kind: row.kind,
    minutes: row.minutes,
    rateBp: row.rate_bp,
    hourlyRate: row.hourly_rate_minor,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export type PaidDayInput = {
  jobId: string;
  date: LocalDateKey;
  kind: PaidDayKind;
  minutes: number;
  rateBp: number;
  note?: string | null;
  /** Defaults to the job's current hourly rate. */
  hourlyRate?: number;
};

function validate(input: PaidDayInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new DataValidationError("Choose a date.", "paid-day/date");
  if (!Number.isInteger(input.minutes) || input.minutes <= 0 || input.minutes > 1440) {
    throw new DataValidationError("Paid hours must be between 0 and 24.", "paid-day/minutes");
  }
  if (!Number.isInteger(input.rateBp) || input.rateBp < 0) {
    throw new DataValidationError("The pay percentage must be zero or more.", "paid-day/rate");
  }
}

export async function getPaidDay(database: SQLiteDatabase, id: string): Promise<PaidDay | null> {
  const row = await database.getFirstAsync<PaidDayRow>("SELECT * FROM paid_days WHERE id = ?", id);
  return row ? toPaidDay(row) : null;
}

/** Paid days with `from <= date < to` (local date keys). */
export async function listPaidDaysBetween(database: SQLiteDatabase, from: LocalDateKey, to: LocalDateKey) {
  const rows = await database.getAllAsync<PaidDayRow>(
    "SELECT * FROM paid_days WHERE deleted_at IS NULL AND date >= ? AND date < ? ORDER BY date",
    from,
    to,
  );
  return rows.map(toPaidDay);
}

export async function createPaidDay(database: SQLiteDatabase, input: PaidDayInput): Promise<PaidDay> {
  validate(input);
  const id = newId();
  await writeTransaction(database, async (db) => {
    const job = await getJob(db, input.jobId);
    if (!job) throw new DataValidationError("Choose a job.", "paid-day/job");
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO paid_days (id, job_id, date, kind, minutes, rate_bp, hourly_rate_minor, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.jobId,
      input.date,
      input.kind,
      input.minutes,
      input.rateBp,
      input.hourlyRate ?? job.hourlyRate,
      input.note?.trim() || null,
      now,
      now,
    );
  });
  return (await getPaidDay(database, id))!;
}

export async function updatePaidDay(database: SQLiteDatabase, id: string, input: PaidDayInput) {
  validate(input);
  await writeTransaction(database, async (db) => {
    const current = await getPaidDay(db, id);
    if (!current) throw new DataValidationError("This day no longer exists.", "paid-day/not-found");
    await db.runAsync(
      `UPDATE paid_days SET job_id = ?, date = ?, kind = ?, minutes = ?, rate_bp = ?, hourly_rate_minor = ?,
         note = ?, updated_at = ? WHERE id = ?`,
      input.jobId,
      input.date,
      input.kind,
      input.minutes,
      input.rateBp,
      input.hourlyRate ?? current.hourlyRate,
      input.note?.trim() || null,
      nowIso(),
      id,
    );
  });
}

export async function deletePaidDay(database: SQLiteDatabase, id: string) {
  await writeTransaction(database, (db) =>
    db.runAsync("UPDATE paid_days SET deleted_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), id),
  );
}
