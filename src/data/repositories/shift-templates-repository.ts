import type { SQLiteDatabase } from "expo-sqlite";

import type { ShiftTemplate } from "@/domain/entities";

import { DataValidationError, newId, nowIso, writeTransaction } from "../database/sql";

/** "Fixed shifts": presets (name, color, hours, pay) for creating shifts quickly. */

type TemplateRow = {
  id: string;
  job_id: string;
  name: string;
  color: string;
  start_minute: number | null;
  end_minute: number | null;
  break_minutes: number;
  hourly_rate_minor: number | null;
  bonus_minor: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toTemplate(row: TemplateRow): ShiftTemplate {
  return {
    id: row.id,
    jobId: row.job_id,
    name: row.name,
    color: row.color,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    breakMinutes: row.break_minutes,
    hourlyRate: row.hourly_rate_minor,
    bonus: row.bonus_minor,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export type ShiftTemplateInput = Pick<
  ShiftTemplate,
  "jobId" | "name" | "color" | "startMinute" | "endMinute" | "breakMinutes" | "hourlyRate" | "bonus"
>;

function validate(input: ShiftTemplateInput) {
  if (!input.name.trim()) throw new DataValidationError("Give the fixed shift a name.", "template/name");
  if ((input.startMinute === null) !== (input.endMinute === null)) {
    throw new DataValidationError("Set both a start and an end time, or neither.", "template/times");
  }
  if (input.startMinute !== null && input.startMinute === input.endMinute) {
    throw new DataValidationError("Start and end time cannot be the same.", "template/times");
  }
}

export async function listShiftTemplates(database: SQLiteDatabase): Promise<ShiftTemplate[]> {
  const rows = await database.getAllAsync<TemplateRow>(
    "SELECT * FROM shift_templates WHERE deleted_at IS NULL ORDER BY sort_order, created_at",
  );
  return rows.map(toTemplate);
}

export async function getShiftTemplate(database: SQLiteDatabase, id: string): Promise<ShiftTemplate | null> {
  const row = await database.getFirstAsync<TemplateRow>("SELECT * FROM shift_templates WHERE id = ?", id);
  return row ? toTemplate(row) : null;
}

export async function createShiftTemplate(database: SQLiteDatabase, input: ShiftTemplateInput): Promise<string> {
  validate(input);
  const id = newId();
  await writeTransaction(database, async (db) => {
    const now = nowIso();
    const order = await db.getFirstAsync<{ next: number }>(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM shift_templates",
    );
    await db.runAsync(
      `INSERT INTO shift_templates (id, job_id, name, color, start_minute, end_minute, break_minutes,
         hourly_rate_minor, bonus_minor, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.jobId,
      input.name.trim(),
      input.color,
      input.startMinute,
      input.endMinute,
      input.breakMinutes,
      input.hourlyRate,
      input.bonus,
      order?.next ?? 0,
      now,
      now,
    );
  });
  return id;
}

export async function updateShiftTemplate(database: SQLiteDatabase, id: string, input: ShiftTemplateInput) {
  validate(input);
  await writeTransaction(database, (db) =>
    db.runAsync(
      `UPDATE shift_templates SET job_id = ?, name = ?, color = ?, start_minute = ?, end_minute = ?,
         break_minutes = ?, hourly_rate_minor = ?, bonus_minor = ?, updated_at = ? WHERE id = ?`,
      input.jobId,
      input.name.trim(),
      input.color,
      input.startMinute,
      input.endMinute,
      input.breakMinutes,
      input.hourlyRate,
      input.bonus,
      nowIso(),
      id,
    ),
  );
}

/** Shifts already created from a template keep their own copy of its values. */
export async function deleteShiftTemplate(database: SQLiteDatabase, id: string) {
  await writeTransaction(database, (db) =>
    db.runAsync("UPDATE shift_templates SET deleted_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), id),
  );
}
