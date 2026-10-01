import { Directory, File, Paths } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";

import { LATEST_DATABASE_VERSION, MIGRATIONS } from "./migrations";

export const DATABASE_NAME = "chronos.db";

export const STORAGE_RECOVERY_MESSAGE =
  "Your saved shifts could not be opened safely. Nothing has been deleted. Keep the app installed and contact support before reinstalling.";

/** Recovery copies live outside SQLite so a damaged database never takes them with it. */
export function getRecoveryDirectory(): Directory {
  return new Directory(Paths.document, "storage-recovery");
}

async function readUserVersion(database: SQLiteDatabase): Promise<number> {
  const row = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  return row?.user_version ?? 0;
}

/**
 * Saves a full copy of the database before migrating it. `serializeAsync`
 * includes data still in the WAL file, which copying the .db file would miss.
 * An existing copy for the same target version is never overwritten.
 */
async function saveRecoveryCopy(database: SQLiteDatabase, fromVersion: number) {
  const directory = getRecoveryDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const copy = new File(directory, `before-v${LATEST_DATABASE_VERSION}-from-v${fromVersion}.sqlite`);
  if (copy.exists) return;
  const bytes = await database.serializeAsync();
  copy.create();
  copy.write(bytes);
  if (copy.size !== bytes.length) {
    throw new Error("The recovery copy could not be saved, so the upgrade was stopped.");
  }
}

/**
 * Passed to `<SQLiteProvider onInit>`. Runs before any screen can read data:
 *
 * 1. refuses to open a database made by a newer app version (no downgrades),
 * 2. checks the file is not corrupted,
 * 3. saves a recovery copy before upgrading existing data,
 * 4. applies pending migrations, each in its own transaction.
 */
export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  const version = await readUserVersion(database);
  if (version > LATEST_DATABASE_VERSION) throw new Error(STORAGE_RECOVERY_MESSAGE);

  const check = await database.getFirstAsync<{ quick_check: string }>("PRAGMA quick_check");
  if (check?.quick_check !== "ok") throw new Error(STORAGE_RECOVERY_MESSAGE);

  await database.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const pending = MIGRATIONS.filter((migration) => migration.version > version);
  if (pending.length === 0) return;
  if (version > 0) await saveRecoveryCopy(database, version);

  for (const migration of pending) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await migration.up(transaction);
      // Bumped inside the same transaction: the version only moves if the migration succeeded.
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
