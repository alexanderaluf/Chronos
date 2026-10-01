import type { SQLiteDatabase } from "expo-sqlite";

import type { PlannedShift } from "@/domain/entities";
import type { LocalDateKey } from "@/domain/time/time";

import { DataValidationError, nowIso, writeTransaction } from "../database/sql";

/** The weekly work schedule: at most one planned shift per day. Not paid — just a plan. */

type PlannedRow = {
  date: string;
  start_minute: number;
  end_minute: number;
  note: string | null;
  updated_at: string;
};

function toPlanned(row: PlannedRow): PlannedShift {
  return {
    date: row.date,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    note: row.note,
    updatedAt: row.updated_at,
  };
}

/** Planned shifts with `from <= date < to`. */
export async function listPlannedShifts(database: SQLiteDatabase, from: LocalDateKey, to: LocalDateKey) {
  const rows = await database.getAllAsync<PlannedRow>(
    "SELECT * FROM planned_shifts WHERE date >= ? AND date < ? ORDER BY date",
    from,
    to,
  );
  return rows.map(toPlanned);
}

/** The first planned shift on or after `from`. */
export async function getNextPlannedShift(database: SQLiteDatabase, from: LocalDateKey) {
  const row = await database.getFirstAsync<PlannedRow>(
    "SELECT * FROM planned_shifts WHERE date >= ? ORDER BY date LIMIT 1",
    from,
  );
  return row ? toPlanned(row) : null;
}

export async function savePlannedShift(
  database: SQLiteDatabase,
  plan: Pick<PlannedShift, "date" | "startMinute" | "endMinute" | "note">,
) {
  if (plan.startMinute === plan.endMinute) {
    throw new DataValidationError("Start and end time cannot be the same.", "planned/times");
  }
  await writeTransaction(database, (db) =>
    db.runAsync(
      `INSERT INTO planned_shifts (date, start_minute, end_minute, note, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (date) DO UPDATE SET start_minute = excluded.start_minute, end_minute = excluded.end_minute,
         note = excluded.note, updated_at = excluded.updated_at`,
      plan.date,
      plan.startMinute,
      plan.endMinute,
      plan.note?.trim() || null,
      nowIso(),
    ),
  );
}

/** Plans are not records of work, so clearing one deletes it. */
export async function clearPlannedShift(database: SQLiteDatabase, date: LocalDateKey) {
  await writeTransaction(database, (db) => db.runAsync("DELETE FROM planned_shifts WHERE date = ?", date));
}
