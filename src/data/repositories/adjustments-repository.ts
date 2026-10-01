import type { SQLiteDatabase } from "expo-sqlite";

import type { AdjustmentKind, PayAdjustment } from "@/domain/entities";
import { parsePeriodKey, type PeriodKey } from "@/domain/time/time";

import {
  DataValidationError,
  fromSqlBoolean,
  newId,
  nowIso,
  toSqlBoolean,
  writeTransaction,
} from "../database/sql";

/** Monthly one-off items: bonuses (added to gross) and deductions (taken from net). */

type AdjustmentRow = {
  id: string;
  job_id: string | null;
  period_key: string;
  kind: AdjustmentKind;
  label: string;
  amount_minor: number;
  is_taxable: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toAdjustment(row: AdjustmentRow): PayAdjustment {
  return {
    id: row.id,
    jobId: row.job_id,
    periodKey: row.period_key,
    kind: row.kind,
    label: row.label,
    amount: row.amount_minor,
    isTaxable: fromSqlBoolean(row.is_taxable),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export type AdjustmentInput = Pick<PayAdjustment, "jobId" | "periodKey" | "kind" | "label" | "amount" | "isTaxable">;

function validate(input: AdjustmentInput) {
  parsePeriodKey(input.periodKey);
  if (!input.label.trim()) throw new DataValidationError("Add a short description.", "adjustment/label-required");
  if (!Number.isSafeInteger(input.amount) || input.amount < 0) {
    throw new DataValidationError("The amount must be zero or more.", "adjustment/invalid-amount");
  }
}

export async function listAdjustmentsForPeriod(database: SQLiteDatabase, periodKey: PeriodKey) {
  const rows = await database.getAllAsync<AdjustmentRow>(
    "SELECT * FROM pay_adjustments WHERE period_key = ? AND deleted_at IS NULL ORDER BY created_at",
    periodKey,
  );
  return rows.map(toAdjustment);
}

export async function getAdjustment(database: SQLiteDatabase, id: string): Promise<PayAdjustment | null> {
  const row = await database.getFirstAsync<AdjustmentRow>("SELECT * FROM pay_adjustments WHERE id = ?", id);
  return row ? toAdjustment(row) : null;
}

export async function createAdjustment(database: SQLiteDatabase, input: AdjustmentInput): Promise<PayAdjustment> {
  validate(input);
  const id = newId();
  const now = nowIso();
  await writeTransaction(database, (db) =>
    db.runAsync(
      `INSERT INTO pay_adjustments (id, job_id, period_key, kind, label, amount_minor, is_taxable, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.jobId,
      input.periodKey,
      input.kind,
      input.label.trim(),
      input.amount,
      toSqlBoolean(input.isTaxable),
      now,
      now,
    ),
  );
  const row = await database.getFirstAsync<AdjustmentRow>("SELECT * FROM pay_adjustments WHERE id = ?", id);
  return toAdjustment(row!);
}

export async function updateAdjustment(database: SQLiteDatabase, id: string, input: AdjustmentInput) {
  validate(input);
  await writeTransaction(database, (db) =>
    db.runAsync(
      `UPDATE pay_adjustments SET job_id = ?, period_key = ?, kind = ?, label = ?, amount_minor = ?,
         is_taxable = ?, updated_at = ? WHERE id = ?`,
      input.jobId,
      input.periodKey,
      input.kind,
      input.label.trim(),
      input.amount,
      toSqlBoolean(input.isTaxable),
      nowIso(),
      id,
    ),
  );
}

export async function deleteAdjustment(database: SQLiteDatabase, id: string) {
  await writeTransaction(database, (db) =>
    db.runAsync("UPDATE pay_adjustments SET deleted_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), id),
  );
}
