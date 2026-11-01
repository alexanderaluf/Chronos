import type { SQLiteDatabase } from "expo-sqlite";

import type { PayComponent, PayComponentCalculation, PayComponentKind } from "@/domain/entities";
import { PAY_COMPONENT_CALCULATIONS } from "@/domain/pay/pay-components";

import { DataValidationError, fromSqlBoolean, newId, nowIso, toSqlBoolean, writeTransaction } from "../database/sql";
import { getActiveJobId } from "./settings-repository";

/** Recurring monthly additions (travel, allowances) and deductions (pension, study fund). */

type ComponentRow = {
  id: string;
  kind: PayComponentKind;
  name: string;
  calculation: PayComponentCalculation;
  amount_minor: number;
  rate_bp: number;
  is_taxable: number;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toComponent(row: ComponentRow): PayComponent {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    calculation: row.calculation,
    amount: row.amount_minor,
    rateBp: row.rate_bp,
    isTaxable: fromSqlBoolean(row.is_taxable),
    isActive: fromSqlBoolean(row.is_active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export type PayComponentInput = Pick<
  PayComponent,
  "kind" | "name" | "calculation" | "amount" | "rateBp" | "isTaxable" | "isActive"
> & {
  /** The profile it belongs to; left out, the active profile. */
  jobId?: string;
};

function validate(input: PayComponentInput) {
  if (!input.name.trim()) throw new DataValidationError("Give this item a name.", "component/name");
  if (!PAY_COMPONENT_CALCULATIONS.includes(input.calculation)) {
    throw new DataValidationError("Choose how it is calculated.", "component/calculation");
  }
  if (!Number.isSafeInteger(input.amount) || input.amount < 0 || !Number.isInteger(input.rateBp) || input.rateBp < 0) {
    throw new DataValidationError("The amount must be zero or more.", "component/amount");
  }
}

/**
 * Non-deleted components; pass `kind` to get only additions or deductions,
 * and `jobId` for one profile only.
 */
export async function listPayComponents(database: SQLiteDatabase, kind?: PayComponentKind, jobId?: string | null): Promise<PayComponent[]> {
  const rows = await database.getAllAsync<ComponentRow>(
    `SELECT * FROM pay_components WHERE deleted_at IS NULL ${kind ? "AND kind = ?" : ""} ${jobId ? "AND job_id = ?" : ""}
     ORDER BY kind, sort_order, created_at`,
    ...(kind ? [kind] : []),
    ...(jobId ? [jobId] : []),
  );
  return rows.map(toComponent);
}

export async function getPayComponent(database: SQLiteDatabase, id: string): Promise<PayComponent | null> {
  const row = await database.getFirstAsync<ComponentRow>("SELECT * FROM pay_components WHERE id = ?", id);
  return row ? toComponent(row) : null;
}

export async function createPayComponent(database: SQLiteDatabase, input: PayComponentInput): Promise<string> {
  return writeTransaction(database, (db) => writePayComponent(db, input));
}

/** `createPayComponent` for code already inside `writeTransaction` (transactions cannot nest). */
export async function writePayComponent(db: SQLiteDatabase, input: PayComponentInput): Promise<string> {
  validate(input);
  const id = newId();
  const now = nowIso();
  const jobId = input.jobId ?? (await getActiveJobId(db));
  const order = await db.getFirstAsync<{ next: number }>(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM pay_components WHERE kind = ?",
    input.kind,
  );
  await db.runAsync(
    `INSERT INTO pay_components (id, job_id, kind, name, calculation, amount_minor, rate_bp, is_taxable, is_active,
       sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    jobId,
    input.kind,
    input.name.trim(),
    input.calculation,
    input.amount,
    input.rateBp,
    toSqlBoolean(input.isTaxable),
    toSqlBoolean(input.isActive),
    order?.next ?? 0,
    now,
    now,
  );
  return id;
}

export async function updatePayComponent(database: SQLiteDatabase, id: string, input: PayComponentInput) {
  validate(input);
  await writeTransaction(database, (db) =>
    db.runAsync(
      `UPDATE pay_components SET kind = ?, name = ?, calculation = ?, amount_minor = ?, rate_bp = ?,
         is_taxable = ?, is_active = ?, updated_at = ? WHERE id = ?`,
      input.kind,
      input.name.trim(),
      input.calculation,
      input.amount,
      input.rateBp,
      toSqlBoolean(input.isTaxable),
      toSqlBoolean(input.isActive),
      nowIso(),
      id,
    ),
  );
}

export async function deletePayComponent(database: SQLiteDatabase, id: string) {
  await writeTransaction(database, (db) =>
    db.runAsync("UPDATE pay_components SET deleted_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), id),
  );
}
