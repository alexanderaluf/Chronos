import type { SQLiteDatabase } from "expo-sqlite";

import { ISRAEL_2026_TAX_RULES, normalizeTaxRules } from "@/domain/tax/tax-rules";

import { newId, nowIso, parseJson } from "./sql";

/**
 * Database schema history. HOW TO CHANGE THE SCHEMA:
 *
 * 1. Never edit a migration that has shipped — users already ran it.
 * 2. Append a new entry with the next version number.
 * 3. Only additive, data-preserving changes: add tables/columns/indexes,
 *    copy data into new shapes. Never DROP a column or table holding user data.
 * 4. Update the row mappers in `src/data/repositories` and `docs/database.md`.
 *
 * Each migration runs in its own exclusive transaction together with the
 * `PRAGMA user_version` bump, so a failed migration leaves the database
 * exactly as it was.
 */
// Seed data exactly as schema v1 shipped it. Migrations must never read
// constants that change later, or old migrations would silently change too.
const V1_SEED_TAX_RULES = {
  incomeTaxBrackets: [
    { upTo: 701_000, rateBp: 1_000 },
    { upTo: 1_006_000, rateBp: 1_400 },
    { upTo: 1_615_000, rateBp: 2_000 },
    { upTo: 2_244_000, rateBp: 3_100 },
    { upTo: 4_669_000, rateBp: 3_500 },
    { upTo: 6_013_000, rateBp: 4_700 },
    { upTo: null, rateBp: 5_000 },
  ],
  creditPointsHundredths: 225,
  creditPointValue: 24_200,
  nationalInsurance: { reducedThreshold: 752_200, ceiling: 5_069_500, reducedRateBp: 104, fullRateBp: 700 },
  healthInsurance: { reducedRateBp: 323, fullRateBp: 517 },
  pensionEmployeeRateBp: 600,
  studyFundEmployeeRateBp: 0,
};
const V1_SEED_PAY_RULES = {
  dailyOvertimeThresholdMinutes: 516,
  nightShiftThresholdMinutes: 420,
  nightWindowStartMinute: 1320,
  nightWindowEndMinute: 360,
  nightShiftMinNightMinutes: 120,
  overtimeTier1Minutes: 120,
  overtimeTier1RateBp: 12_500,
  overtimeTier2RateBp: 15_000,
  restDays: [6],
  restDayRateBp: 15_000,
  restDayOvertimeTier1RateBp: 17_500,
  restDayOvertimeTier2RateBp: 20_000,
};

export type Migration = {
  version: number;
  name: string;
  up: (transaction: SQLiteDatabase) => Promise<void>;
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial schema",
    async up(tx) {
      await tx.execAsync(`
        CREATE TABLE settings (
          key         TEXT PRIMARY KEY NOT NULL,
          value_json  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );

        CREATE TABLE jobs (
          id                     TEXT PRIMARY KEY NOT NULL,
          name                   TEXT NOT NULL,
          color                  TEXT NOT NULL,
          pay_type               TEXT NOT NULL CHECK (pay_type IN ('hourly', 'monthly')),
          hourly_rate_minor      INTEGER NOT NULL DEFAULT 0 CHECK (hourly_rate_minor >= 0),
          monthly_salary_minor   INTEGER NOT NULL DEFAULT 0 CHECK (monthly_salary_minor >= 0),
          monthly_hours_divisor  INTEGER NOT NULL DEFAULT 182 CHECK (monthly_hours_divisor > 0),
          currency_code          TEXT NOT NULL,
          travel_per_day_minor   INTEGER NOT NULL DEFAULT 0 CHECK (travel_per_day_minor >= 0),
          pay_rules_json         TEXT NOT NULL,
          created_at             TEXT NOT NULL,
          updated_at             TEXT NOT NULL,
          archived_at            TEXT
        );

        CREATE TABLE shifts (
          id                 TEXT PRIMARY KEY NOT NULL,
          job_id             TEXT NOT NULL REFERENCES jobs (id) ON DELETE RESTRICT,
          start_at           TEXT NOT NULL,
          end_at             TEXT,
          time_zone          TEXT NOT NULL,
          break_minutes      INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
          hourly_rate_minor  INTEGER NOT NULL CHECK (hourly_rate_minor >= 0),
          is_holiday         INTEGER NOT NULL DEFAULT 0 CHECK (is_holiday IN (0, 1)),
          bonus_minor        INTEGER NOT NULL DEFAULT 0 CHECK (bonus_minor >= 0),
          tips_minor         INTEGER NOT NULL DEFAULT 0 CHECK (tips_minor >= 0),
          note               TEXT,
          created_at         TEXT NOT NULL,
          updated_at         TEXT NOT NULL,
          deleted_at         TEXT,
          CHECK (end_at IS NULL OR end_at > start_at)
        );
        CREATE INDEX shifts_by_start ON shifts (start_at) WHERE deleted_at IS NULL;
        CREATE INDEX shifts_by_job ON shifts (job_id, start_at);
        -- At most one running (clocked-in) shift at a time.
        CREATE UNIQUE INDEX shifts_single_open ON shifts ((end_at IS NULL))
          WHERE end_at IS NULL AND deleted_at IS NULL;

        CREATE TABLE pay_adjustments (
          id            TEXT PRIMARY KEY NOT NULL,
          job_id        TEXT REFERENCES jobs (id) ON DELETE RESTRICT,
          period_key    TEXT NOT NULL,
          kind          TEXT NOT NULL CHECK (kind IN ('bonus', 'deduction')),
          label         TEXT NOT NULL,
          amount_minor  INTEGER NOT NULL CHECK (amount_minor >= 0),
          is_taxable    INTEGER NOT NULL DEFAULT 1 CHECK (is_taxable IN (0, 1)),
          created_at    TEXT NOT NULL,
          updated_at    TEXT NOT NULL,
          deleted_at    TEXT
        );
        CREATE INDEX pay_adjustments_by_period ON pay_adjustments (period_key) WHERE deleted_at IS NULL;

        CREATE TABLE tax_profiles (
          id            TEXT PRIMARY KEY NOT NULL,
          name          TEXT NOT NULL,
          country_code  TEXT NOT NULL,
          tax_year      INTEGER NOT NULL,
          rules_json    TEXT NOT NULL,
          is_active     INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
          created_at    TEXT NOT NULL,
          updated_at    TEXT NOT NULL
        );
        -- Exactly one profile drives the salary estimate.
        CREATE UNIQUE INDEX tax_profiles_single_active ON tax_profiles (is_active) WHERE is_active = 1;
      `);

      // Starter data: an editable Israeli tax profile and one job to clock into.
      const now = nowIso();
      await tx.runAsync(
        `INSERT INTO tax_profiles (id, name, country_code, tax_year, rules_json, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        "tax-profile-israel-2025",
        "Israel — employee",
        "IL",
        2025,
        JSON.stringify(V1_SEED_TAX_RULES),
        now,
        now,
      );
      const jobId = newId();
      await tx.runAsync(
        `INSERT INTO jobs (id, name, color, pay_type, hourly_rate_minor, currency_code, pay_rules_json, created_at, updated_at)
         VALUES (?, ?, ?, 'hourly', 0, 'ILS', ?, ?, ?)`,
        jobId,
        "My job",
        "#087e8b",
        JSON.stringify(V1_SEED_PAY_RULES),
        now,
        now,
      );
      await tx.runAsync(
        "INSERT INTO settings (key, value_json, updated_at) VALUES ('defaultJobId', ?, ?)",
        JSON.stringify(jobId),
        now,
      );
    },
  },
  {
    version: 2,
    name: "paid days, fixed shifts, pay components, weekly schedule",
    async up(tx) {
      await tx.execAsync(`
        ALTER TABLE shifts ADD COLUMN color TEXT;
        ALTER TABLE shifts ADD COLUMN label TEXT;

        CREATE TABLE paid_days (
          id                 TEXT PRIMARY KEY NOT NULL,
          job_id             TEXT NOT NULL REFERENCES jobs (id) ON DELETE RESTRICT,
          date               TEXT NOT NULL,
          kind               TEXT NOT NULL CHECK (kind IN ('vacation', 'sick', 'holiday', 'other')),
          minutes            INTEGER NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
          rate_bp            INTEGER NOT NULL DEFAULT 10000 CHECK (rate_bp >= 0),
          hourly_rate_minor  INTEGER NOT NULL CHECK (hourly_rate_minor >= 0),
          note               TEXT,
          created_at         TEXT NOT NULL,
          updated_at         TEXT NOT NULL,
          deleted_at         TEXT
        );
        CREATE INDEX paid_days_by_date ON paid_days (date) WHERE deleted_at IS NULL;

        CREATE TABLE shift_templates (
          id                 TEXT PRIMARY KEY NOT NULL,
          job_id             TEXT NOT NULL REFERENCES jobs (id) ON DELETE RESTRICT,
          name               TEXT NOT NULL,
          color              TEXT NOT NULL,
          start_minute       INTEGER CHECK (start_minute BETWEEN 0 AND 1439),
          end_minute         INTEGER CHECK (end_minute BETWEEN 0 AND 1439),
          break_minutes      INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
          hourly_rate_minor  INTEGER CHECK (hourly_rate_minor >= 0),
          bonus_minor        INTEGER NOT NULL DEFAULT 0 CHECK (bonus_minor >= 0),
          sort_order         INTEGER NOT NULL DEFAULT 0,
          created_at         TEXT NOT NULL,
          updated_at         TEXT NOT NULL,
          deleted_at         TEXT,
          CHECK ((start_minute IS NULL) = (end_minute IS NULL))
        );

        CREATE TABLE pay_components (
          id            TEXT PRIMARY KEY NOT NULL,
          kind          TEXT NOT NULL CHECK (kind IN ('addition', 'deduction')),
          name          TEXT NOT NULL,
          calculation   TEXT NOT NULL CHECK (calculation IN ('monthlyFixed', 'perWorkDay', 'perWorkHour', 'percentOfGross')),
          amount_minor  INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
          rate_bp       INTEGER NOT NULL DEFAULT 0 CHECK (rate_bp >= 0),
          is_taxable    INTEGER NOT NULL DEFAULT 1 CHECK (is_taxable IN (0, 1)),
          is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          sort_order    INTEGER NOT NULL DEFAULT 0,
          created_at    TEXT NOT NULL,
          updated_at    TEXT NOT NULL,
          deleted_at    TEXT
        );

        CREATE TABLE planned_shifts (
          date          TEXT PRIMARY KEY NOT NULL,
          start_minute  INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
          end_minute    INTEGER NOT NULL CHECK (end_minute BETWEEN 0 AND 1439),
          note          TEXT,
          updated_at    TEXT NOT NULL
        );
      `);

      const now = nowIso();
      const insertComponent = (
        kind: "addition" | "deduction",
        name: string,
        calculation: "perWorkDay" | "percentOfGross",
        amount: number,
        rateBp: number,
        sortOrder: number,
      ) =>
        tx.runAsync(
          `INSERT INTO pay_components (id, kind, name, calculation, amount_minor, rate_bp, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newId(),
          kind,
          name,
          calculation,
          amount,
          rateBp,
          sortOrder,
          now,
          now,
        );

      // v1 kept pension / study fund inside the tax profile: move them to deductions.
      const profiles = await tx.getAllAsync<{ id: string; rules_json: string; is_active: number }>(
        "SELECT id, rules_json, is_active FROM tax_profiles",
      );
      const active = profiles.find((profile) => profile.is_active === 1);
      const v1Rules = (active ? parseJson(active.rules_json) : undefined) as
        | { pensionEmployeeRateBp?: number; studyFundEmployeeRateBp?: number }
        | undefined;
      const pension = v1Rules?.pensionEmployeeRateBp ?? 600;
      const studyFund = v1Rules?.studyFundEmployeeRateBp ?? 0;
      if (pension > 0) await insertComponent("deduction", "Pension fund", "percentOfGross", 0, pension, 0);
      if (studyFund > 0) await insertComponent("deduction", "Study fund", "percentOfGross", 0, studyFund, 1);

      // v1 kept travel on the job: move it to a per-work-day addition.
      const jobs = await tx.getAllAsync<{ name: string; travel_per_day_minor: number }>(
        "SELECT name, travel_per_day_minor FROM jobs WHERE travel_per_day_minor > 0",
      );
      for (const [index, job] of jobs.entries()) {
        await insertComponent(
          "addition",
          jobs.length > 1 ? `Travel — ${job.name}` : "Travel",
          "perWorkDay",
          job.travel_per_day_minor,
          0,
          index,
        );
      }

      // Rewrite tax rules in the v2 shape. The untouched seeded profile gets 2026 values.
      for (const profile of profiles) {
        const raw = parseJson(profile.rules_json) as { nationalInsurance?: { reducedThreshold?: number } } | undefined;
        const untouchedSeed =
          profile.id === "tax-profile-israel-2025" && raw?.nationalInsurance?.reducedThreshold === 752_200;
        await tx.runAsync(
          "UPDATE tax_profiles SET rules_json = ?, tax_year = CASE WHEN ? THEN 2026 ELSE tax_year END, updated_at = ? WHERE id = ?",
          JSON.stringify(untouchedSeed ? ISRAEL_2026_TAX_RULES : normalizeTaxRules(raw)),
          untouchedSeed ? 1 : 0,
          now,
          profile.id,
        );
      }
    },
  },
  {
    version: 3,
    name: "global bonus per shift",
    async up(tx) {
      // The job's default bonus for every new shift; each shift keeps its own copy and can override it.
      await tx.execAsync(
        "ALTER TABLE jobs ADD COLUMN default_shift_bonus_minor INTEGER NOT NULL DEFAULT 0 CHECK (default_shift_bonus_minor >= 0);",
      );
    },
  },
  {
    version: 4,
    name: "cached Israeli holiday calendars",
    async up(tx) {
      await tx.execAsync(`CREATE TABLE holiday_year_cache (
        cache_key TEXT PRIMARY KEY NOT NULL,
        year INTEGER NOT NULL,
        calendar_json TEXT NOT NULL,
        fetched_at TEXT NOT NULL
      );`);
    },
  },
  {
    version: 5,
    name: "salary supplement snapshots",
    async up(tx) {
      await tx.execAsync("ALTER TABLE shifts ADD COLUMN salary_agreement_json TEXT NOT NULL DEFAULT '{}';");
    },
  },
];

export const LATEST_DATABASE_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
