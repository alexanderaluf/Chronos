import type { SQLiteDatabase } from "expo-sqlite";

import type { TaxProfile } from "@/domain/entities";
import { EMPTY_TAX_RULES, ISRAEL_2026_TAX_RULES, normalizeTaxRules, type TaxRules } from "@/domain/tax/tax-rules";

import { DataValidationError, fromSqlBoolean, newId, nowIso, parseJson, writeTransaction } from "../database/sql";

/**
 * The user's status for tax / national insurance / pension. Every number is
 * editable, so the Israeli defaults can be adjusted or replaced entirely for
 * another country. Exactly one profile is active at a time.
 */

type TaxProfileRow = {
  id: string;
  name: string;
  country_code: string;
  tax_year: number;
  rules_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function toTaxProfile(row: TaxProfileRow): TaxProfile {
  const fallback = row.country_code === "IL" ? ISRAEL_2026_TAX_RULES : EMPTY_TAX_RULES;
  return {
    id: row.id,
    name: row.name,
    countryCode: row.country_code,
    taxYear: row.tax_year,
    rules: normalizeTaxRules(parseJson(row.rules_json), fallback),
    isActive: fromSqlBoolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTaxProfiles(database: SQLiteDatabase): Promise<TaxProfile[]> {
  const rows = await database.getAllAsync<TaxProfileRow>("SELECT * FROM tax_profiles ORDER BY created_at");
  return rows.map(toTaxProfile);
}

/** The profile used for salary estimates. Falls back to the Israeli defaults if none is active. */
export async function getActiveTaxProfile(database: SQLiteDatabase): Promise<TaxProfile> {
  const row = await database.getFirstAsync<TaxProfileRow>("SELECT * FROM tax_profiles WHERE is_active = 1");
  if (row) return toTaxProfile(row);
  const now = nowIso();
  return {
    id: "",
    name: "Israel — employee",
    countryCode: "IL",
    taxYear: 2026,
    rules: ISRAEL_2026_TAX_RULES,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export type TaxProfileInput = Pick<TaxProfile, "name" | "countryCode" | "taxYear" | "rules">;

export async function createTaxProfile(
  database: SQLiteDatabase,
  input: TaxProfileInput,
  { activate = true } = {},
): Promise<string> {
  if (!input.name.trim()) throw new DataValidationError("Give this profile a name.", "tax/name-required");
  const id = newId();
  const now = nowIso();
  await writeTransaction(database, async (db) => {
    if (activate) await db.runAsync("UPDATE tax_profiles SET is_active = 0 WHERE is_active = 1");
    await db.runAsync(
      `INSERT INTO tax_profiles (id, name, country_code, tax_year, rules_json, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.name.trim(),
      input.countryCode.toUpperCase(),
      input.taxYear,
      JSON.stringify(normalizeTaxRules(input.rules)),
      activate ? 1 : 0,
      now,
      now,
    );
  });
  return id;
}

export async function updateTaxRules(database: SQLiteDatabase, id: string, rules: TaxRules) {
  await writeTransaction(database, (db) =>
    db.runAsync(
      "UPDATE tax_profiles SET rules_json = ?, updated_at = ? WHERE id = ?",
      JSON.stringify(normalizeTaxRules(rules)),
      nowIso(),
      id,
    ),
  );
}

export async function activateTaxProfile(database: SQLiteDatabase, id: string) {
  await writeTransaction(database, async (db) => {
    await db.runAsync("UPDATE tax_profiles SET is_active = 0 WHERE is_active = 1");
    await db.runAsync("UPDATE tax_profiles SET is_active = 1, updated_at = ? WHERE id = ?", nowIso(), id);
  });
}

/** Puts the Israeli default values back into a profile. */
export async function resetTaxProfileToIsraelDefaults(database: SQLiteDatabase, id: string) {
  await writeTransaction(database, (db) =>
    db.runAsync(
      "UPDATE tax_profiles SET rules_json = ?, tax_year = 2026, updated_at = ? WHERE id = ?",
      JSON.stringify(ISRAEL_2026_TAX_RULES),
      nowIso(),
      id,
    ),
  );
}
