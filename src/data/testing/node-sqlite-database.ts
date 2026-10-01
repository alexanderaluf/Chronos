/// <reference types="node" />
import { DatabaseSync } from "node:sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

import { MIGRATIONS } from "../database/migrations";

/**
 * TEST ONLY. The subset of expo-sqlite's async API that Chronos uses,
 * implemented on Node's built-in SQLite, so repositories and migrations can
 * be tested against a real database without a phone.
 */
class NodeSqliteDatabase {
  constructor(readonly raw: DatabaseSync) {}

  async execAsync(sql: string) {
    this.raw.exec(sql);
  }

  async runAsync(sql: string, ...params: unknown[]) {
    if (params.some((param) => param === undefined)) throw new Error(`undefined parameter in: ${sql}`);
    const result = this.raw.prepare(sql).run(...(params as never[]));
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    return ((this.raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null);
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return this.raw.prepare(sql).all(...(params as never[])) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>) {
    this.raw.exec("BEGIN");
    try {
      await task();
      this.raw.exec("COMMIT");
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }

  async withExclusiveTransactionAsync(task: (transaction: SQLiteDatabase) => Promise<void>) {
    this.raw.exec("BEGIN EXCLUSIVE");
    try {
      await task(this as unknown as SQLiteDatabase);
      this.raw.exec("COMMIT");
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

/** An in-memory database migrated to `toVersion` (default: latest). */
export async function createTestDatabase(toVersion = Number.MAX_SAFE_INTEGER): Promise<SQLiteDatabase> {
  const database = new NodeSqliteDatabase(new DatabaseSync(":memory:"));
  database.raw.exec("PRAGMA foreign_keys = ON");
  await migrateTestDatabase(database as unknown as SQLiteDatabase, 0, toVersion);
  return database as unknown as SQLiteDatabase;
}

/** Runs migrations (from, to] the same way `initializeDatabase` does. */
export async function migrateTestDatabase(database: SQLiteDatabase, fromVersion: number, toVersion: number) {
  for (const migration of MIGRATIONS.filter((item) => item.version > fromVersion && item.version <= toVersion)) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await migration.up(transaction);
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
