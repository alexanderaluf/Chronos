import { normalizeSalaryAgreement } from "@/domain/pay/salary-agreement";
import type { SQLiteDatabase } from "expo-sqlite";

import type { Shift } from "@/domain/entities";
import { fromIso, toIso } from "@/domain/time/time";

import {
  DataValidationError,
  fromSqlBoolean,
  newId,
  nowIso,
  parseJson,
  toSqlBoolean,
  writeTransaction,
} from "../database/sql";
import { getJob } from "./jobs-repository";

/**
 * Shifts are the core record. Rules enforced here:
 * - times are saved as ISO UTC strings (sortable, so range queries use indexes),
 * - a finished shift must end after it starts,
 * - shifts may not overlap each other,
 * - only one shift can be running (clocked in) at a time,
 * - "delete" is a soft delete, so a mistake can be undone.
 */

type ShiftRow = {
  salary_agreement_json: string;
  id: string;
  job_id: string;
  start_at: string;
  end_at: string | null;
  time_zone: string;
  break_minutes: number;
  hourly_rate_minor: number;
  is_holiday: number;
  bonus_minor: number;
  tips_minor: number;
  note: string | null;
  color: string | null;
  label: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toShift(row: ShiftRow): Shift {
  return {
    salaryAgreement: normalizeSalaryAgreement(parseJson(row.salary_agreement_json)),
    id: row.id,
    jobId: row.job_id,
    startAt: row.start_at,
    endAt: row.end_at,
    timeZone: row.time_zone,
    breakMinutes: row.break_minutes,
    hourlyRate: row.hourly_rate_minor,
    isHoliday: fromSqlBoolean(row.is_holiday),
    bonus: row.bonus_minor,
    tips: row.tips_minor,
    note: row.note,
    color: row.color,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export type ShiftInput = {
  jobId: string;
  startAt: Date;
  endAt: Date | null;
  timeZone: string;
  breakMinutes?: number;
  /** Defaults to the job's global hourly rate. */
  hourlyRate?: number;
  isHoliday?: boolean;
  bonus?: number;
  tips?: number;
  note?: string | null;
  color?: string | null;
  label?: string | null;
};

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function getShift(database: SQLiteDatabase, id: string): Promise<Shift | null> {
  const row = await database.getFirstAsync<ShiftRow>("SELECT * FROM shifts WHERE id = ?", id);
  return row ? toShift(row) : null;
}

/** The shift the user is currently clocked into, if any. */
export async function getOpenShift(database: SQLiteDatabase): Promise<Shift | null> {
  const row = await database.getFirstAsync<ShiftRow>(
    "SELECT * FROM shifts WHERE end_at IS NULL AND deleted_at IS NULL LIMIT 1",
  );
  return row ? toShift(row) : null;
}

/** Shifts that START in [from, to), oldest first. Includes a running shift. */
export async function listShiftsStartingBetween(
  database: SQLiteDatabase,
  from: Date,
  to: Date,
): Promise<Shift[]> {
  const rows = await database.getAllAsync<ShiftRow>(
    `SELECT * FROM shifts
     WHERE deleted_at IS NULL AND start_at >= ? AND start_at < ?
     ORDER BY start_at`,
    toIso(from),
    toIso(to),
  );
  return rows.map(toShift);
}

export async function listRecentShifts(database: SQLiteDatabase, limit = 20): Promise<Shift[]> {
  const rows = await database.getAllAsync<ShiftRow>(
    "SELECT * FROM shifts WHERE deleted_at IS NULL ORDER BY start_at DESC LIMIT ?",
    limit,
  );
  return rows.map(toShift);
}

/** Non-deleted shifts overlapping [start, end). A running shift counts as lasting until now. */
export async function findOverlappingShifts(
  database: SQLiteDatabase,
  start: Date,
  end: Date | null,
  excludeId?: string,
): Promise<Shift[]> {
  const endIso = toIso(end ?? new Date(8.64e15));
  const rows = await database.getAllAsync<ShiftRow>(
    `SELECT * FROM shifts
     WHERE deleted_at IS NULL
       AND id != ?
       AND start_at < ?
       AND COALESCE(end_at, ?) > ?`,
    excludeId ?? "",
    endIso,
    nowIso(),
    toIso(start),
  );
  return rows.map(toShift);
}

// ─── Writes ─────────────────────────────────────────────────────────────────

function validateTimes(startAt: Date, endAt: Date | null, breakMinutes: number) {
  if (Number.isNaN(startAt.getTime()) || (endAt && Number.isNaN(endAt.getTime()))) {
    throw new DataValidationError("The shift time is not valid.", "shift/invalid-time");
  }
  if (endAt && endAt <= startAt) {
    throw new DataValidationError("A shift must end after it starts.", "shift/end-before-start");
  }
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) {
    throw new DataValidationError("Break must be zero or more minutes.", "shift/invalid-break");
  }
  if (endAt && breakMinutes >= (endAt.getTime() - startAt.getTime()) / 60_000) {
    throw new DataValidationError("The break is longer than the shift.", "shift/break-too-long");
  }
}

async function assertNoOverlap(db: SQLiteDatabase, start: Date, end: Date | null, excludeId?: string) {
  const overlapping = await findOverlappingShifts(db, start, end, excludeId);
  if (overlapping.length > 0) {
    throw new DataValidationError("This shift overlaps another shift.", "shift/overlap");
  }
}

export async function createShift(database: SQLiteDatabase, input: ShiftInput): Promise<Shift> {
  const id = newId();
  const breakMinutes = input.breakMinutes ?? 0;
  validateTimes(input.startAt, input.endAt, breakMinutes);

  await writeTransaction(database, async (db) => {
    const job = await getJob(db, input.jobId);
    if (!job) throw new DataValidationError("Choose a job for this shift.", "shift/job-required");
    if (input.endAt === null && (await getOpenShift(db))) {
      throw new DataValidationError("You are already clocked in.", "shift/already-open");
    }
    await assertNoOverlap(db, input.startAt, input.endAt);
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO shifts (id, job_id, start_at, end_at, time_zone, break_minutes, hourly_rate_minor,
         is_holiday, bonus_minor, tips_minor, note, color, label, created_at, updated_at, salary_agreement_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.jobId,
      toIso(input.startAt),
      input.endAt ? toIso(input.endAt) : null,
      input.timeZone,
      breakMinutes,
      input.hourlyRate ?? job.hourlyRate,
      toSqlBoolean(input.isHoliday ?? false),
      input.bonus ?? job.defaultShiftBonus,
      input.tips ?? 0,
      input.note?.trim() || null,
      input.color ?? null,
      input.label?.trim() || null,
      now,
      now,
      JSON.stringify(normalizeSalaryAgreement(job.payRules.salaryAgreement)),
    );
  });
  return (await getShift(database, id))!;
}

export type ShiftPatch = Partial<Omit<ShiftInput, "timeZone">>;

export async function updateShift(database: SQLiteDatabase, id: string, patch: ShiftPatch): Promise<Shift> {
  return writeTransaction(database, async (db) => {
    const current = await getShift(db, id);
    if (!current || current.deletedAt) {
      throw new DataValidationError("This shift no longer exists.", "shift/not-found");
    }
    const startAt = patch.startAt ?? fromIso(current.startAt);
    const endAt = patch.endAt !== undefined ? patch.endAt : current.endAt ? fromIso(current.endAt) : null;
    const breakMinutes = patch.breakMinutes ?? current.breakMinutes;
    validateTimes(startAt, endAt, breakMinutes);
    if (patch.jobId && !(await getJob(db, patch.jobId))) {
      throw new DataValidationError("Choose a job for this shift.", "shift/job-required");
    }
    await assertNoOverlap(db, startAt, endAt, id);

    await db.runAsync(
      `UPDATE shifts SET job_id = ?, start_at = ?, end_at = ?, break_minutes = ?, hourly_rate_minor = ?,
         is_holiday = ?, bonus_minor = ?, tips_minor = ?, note = ?, color = ?, label = ?, updated_at = ?
       WHERE id = ?`,
      patch.jobId ?? current.jobId,
      toIso(startAt),
      endAt ? toIso(endAt) : null,
      breakMinutes,
      patch.hourlyRate ?? current.hourlyRate,
      toSqlBoolean(patch.isHoliday ?? current.isHoliday),
      patch.bonus ?? current.bonus,
      patch.tips ?? current.tips,
      patch.note !== undefined ? patch.note?.trim() || null : current.note,
      patch.color !== undefined ? patch.color : current.color,
      patch.label !== undefined ? patch.label?.trim() || null : current.label,
      nowIso(),
      id,
    );
    return (await getShift(db, id))!;
  });
}

/** Starts a running shift for `jobId` now. */
export function clockIn(database: SQLiteDatabase, jobId: string, timeZone: string, at = new Date()) {
  return createShift(database, { jobId, startAt: at, endAt: null, timeZone });
}

/** Ends the running shift. Throws when the user is not clocked in. */
export async function clockOut(database: SQLiteDatabase, at = new Date()): Promise<Shift> {
  const open = await getOpenShift(database);
  if (!open) throw new DataValidationError("You are not clocked in.", "shift/not-open");
  // A clock-out less than a minute after clock-in still needs a valid range.
  const startAt = fromIso(open.startAt);
  const endAt = at > startAt ? at : new Date(startAt.getTime() + 60_000);
  return updateShift(database, open.id, { endAt });
}

export async function deleteShift(database: SQLiteDatabase, id: string) {
  await writeTransaction(database, (db) =>
    db.runAsync("UPDATE shifts SET deleted_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), id),
  );
}

export async function restoreShift(database: SQLiteDatabase, id: string) {
  await writeTransaction(database, async (db) => {
    const shift = await getShift(db, id);
    if (!shift) return;
    await assertNoOverlap(db, fromIso(shift.startAt), shift.endAt ? fromIso(shift.endAt) : null, id);
    await db.runAsync("UPDATE shifts SET deleted_at = NULL, updated_at = ? WHERE id = ?", nowIso(), id);
  });
}
