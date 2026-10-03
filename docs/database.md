# Chronos local database

All shift, salary and settings data is stored in one SQLite file on the device (`chronos.db`, via `expo-sqlite`). Holiday calendar requests send only the year and selected city coordinates to Hebcal; no shift or salary data is uploaded.

## Lifecycle

`<SQLiteProvider onInit={initializeDatabase}>` in `src/app/_layout.tsx` opens the database before any screen renders. `initializeDatabase` (`src/data/database/initialize-database.ts`) then runs these steps in order:

1. Refuses to open a database written by a newer app version (`PRAGMA user_version` above the latest migration).
2. Runs `PRAGMA quick_check`. A damaged file is never "repaired" by resetting it.
3. Enables WAL journaling and foreign keys.
4. If an existing database needs upgrading, saves a full copy first to `Documents/storage-recovery/before-vN-from-vM.sqlite`.
5. Applies each pending migration in its own exclusive transaction, together with the `user_version` bump.

If any step fails, the root `ErrorBoundary` shows the message. No data is deleted.

## Tables (schema v6)

| Table             | Holds                                         | Notes |
| ----------------- | --------------------------------------------- | ----- |
| `holiday_year_cache` | Normalized Hebcal events and candle-lighting/nightfall times | One row per year and selected city, or dates-only in custom mode. Fresh for 30 days, with stale-cache fallback offline. Added in v4. |
| `settings`        | One row per preference (`key`, `value_json`)  | Includes personal info, tax status and employer details. New settings need no migration. Validated by `normalizeSettings`. |
| `jobs`            | The job and how it pays                        | `pay_type` is hourly or monthly. `hourly_rate_minor` and `default_shift_bonus_minor` (v3) are the **global** rate and bonus copied onto new shifts. `pay_rules_json` holds overtime / night / rest-day rules (validated by `normalizePayRules`). Archived, never deleted. `travel_per_day_minor` is deprecated since v2. |
| `shifts`          | Every shift                                    | `start_at` / `end_at` are ISO UTC. `end_at` is NULL while clocked in. Snapshots copied on creation: `hourly_rate_minor`, `bonus_minor`, `salary_agreement_json` (v5), `unpaid_breaks` and `holiday_pay_json` (v6). Has `color` and `label`. Soft delete with `deleted_at`. |
| `paid_days`       | Vacation, sick and paid-holiday days           | `date` is a local `YYYY-MM-DD`. Pay = minutes × `hourly_rate_minor` (snapshot) × `rate_bp`. |
| `shift_templates` | "Fixed shifts" (presets)                       | Fixed hours (`start_minute`/`end_minute`) or variable hours (both NULL), plus optional rate and bonus. |
| `pay_components`  | Recurring additions and deductions             | `calculation`: monthlyFixed, perWorkDay, perWorkHour, percentOfGross. |
| `pay_adjustments` | One-off bonuses and deductions                 | Keyed by `period_key` (`YYYY-MM`). |
| `tax_profiles`    | The tax system values (brackets, insurance…)   | `rules_json`, validated by `normalizeTaxRules`. Exactly one `is_active`. |
| `planned_shifts`  | The weekly schedule                            | One plan per date. Not a work record, so clearing a day deletes it. |

Constraints the database enforces itself:

- `CHECK (end_at IS NULL OR end_at > start_at)`: a shift ends after it starts.
- `shifts_single_open`: at most one running shift.
- `tax_profiles_single_active`: at most one active tax profile.
- A template has both times or neither.
- Non-negative money columns, and foreign keys to `jobs`.

Rules enforced in the repositories: shifts may not overlap, a break must be shorter than the shift, and paid days last between 0 and 24 hours.

Units: every `*_minor` column is an integer in agorot/cents. Every `*_bp` value is basis points (10000 = 100%). `*_minute` columns are local minutes since midnight.

## Starter data

- Migration 1: one hourly job, **"My job"**, set as `defaultJobId`, and an **"Israel — employee"** tax profile.
- Migration 3: adds `jobs.default_shift_bonus_minor` (global bonus per shift, default 0).
- Migration 2: upgrades an untouched tax profile to the 2026 values. It also turns the v1 pension / study-fund rates into **deductions** and the v1 per-job travel allowance into a **"Travel" addition**.

Migrations must never read constants that change later. Migration 1 keeps an inline copy of exactly what it originally inserted.

## Reading and writing

- **Only repositories write SQL** (`src/data/repositories/*`). Each one maps snake_case rows to the `domain/entities.ts` types.
- **Every write goes through `writeTransaction`** (`src/data/database/sql.ts`). It serializes writes on the main connection, which has foreign keys enabled, and wraps each write in a transaction. Do not call `writeTransaction` inside another `writeTransaction`: they queue, so that would deadlock.
- **Screens read through live hooks** (`src/data/hooks/queries.ts`). `useLiveQuery` re-runs when a listed table changes (`enableChangeListener`), so the UI updates after every save without manual refreshes.

### Function reference

| Area            | Functions |
| --------------- | --------- |
| Settings        | `getSettings`, `updateSettings` |
| Jobs            | `listJobs`, `getJob`, `createJob`, `updateJob`, `setJobArchived` |
| Shifts          | `getShift`, `getOpenShift`, `listShiftsStartingBetween`, `listRecentShifts`, `findOverlappingShifts`, `createShift`, `updateShift`, `clockIn`, `clockOut`, `deleteShift`, `restoreShift` |
| Paid days       | `getPaidDay`, `listPaidDaysBetween`, `createPaidDay`, `updatePaidDay`, `deletePaidDay` |
| Fixed shifts    | `listShiftTemplates`, `getShiftTemplate`, `createShiftTemplate`, `updateShiftTemplate`, `deleteShiftTemplate` |
| Pay components  | `listPayComponents`, `getPayComponent`, `createPayComponent`, `updatePayComponent`, `deletePayComponent` |
| Adjustments     | `listAdjustmentsForPeriod`, `getAdjustment`, `createAdjustment`, `updateAdjustment`, `deleteAdjustment` |
| Weekly schedule | `listPlannedShifts`, `getNextPlannedShift`, `savePlannedShift`, `clearPlannedShift` |
| Tax             | `listTaxProfiles`, `getActiveTaxProfile`, `createTaxProfile`, `updateTaxRules`, `activateTaxProfile`, `resetTaxProfileToIsraelDefaults` |
| Reports         | `loadPeriodReport(periodKey)` → `PeriodSummary`, `loadYearReport(year)` |

Validation failures throw `DataValidationError`, which has a human-readable `message` and a stable `code` such as `shift/overlap`.

## Testing

`src/data/data.test.ts` runs migrations, repositories and reports against a real in-memory SQLite database. `src/data/testing/node-sqlite-database.ts` implements the expo-sqlite API on Node's built-in `node:sqlite`. `scripts/test-setup.cjs` replaces native Expo modules for Node. Add a test there for every new repository function.

## Changing the schema

1. **Never edit a shipped migration.** Append `{ version: N + 1, name, up }` to `MIGRATIONS`.
2. Only make additive, data-preserving changes. Add tables, columns or indexes, and copy data into new shapes. Never drop user data.
3. Prefer JSON fields with a normalizer (like `pay_rules_json`) for settings-like data that will grow.
4. Update the row mapper in the repository, `domain/entities.ts`, the tests, and this file.

## Planned next

- Backup / export to a file (JSON + CSV) and restore. The recovery-copy directory already exists.
- Restore from a recovery copy.

## Salary supplement (v5)

Salary rates optionally store `jobs.pay_rules_json.restWindow` with local `startDay`, `startMinute`, `endDay`, and `endMinute`. No schema migration is needed. Missing/null windows preserve the existing selected-weekday behavior. Custom windows repeat weekly and split worked time at exact boundaries, retaining overtime tiers and taking the higher overlapping holiday rate. Unpaid breaks are allocated at the end of a shift. Pay-rule edits refresh existing reports without changing saved hourly-rate or salary-supplement snapshots.

Salary settings store an optional percentage supplement in `jobs.pay_rules_json.salaryAgreement`. Each new shift copies it to `shifts.salary_agreement_json`; legacy shifts default to disabled. Only `saveSalarySettings` with the "currentPeriod" scope rewrites those snapshots (see below). The base hourly rate stays separate. Overtime, weekly rest and holidays independently exclude the supplement, add it without a multiplier, or multiply it by the applicable pay rate. Overlapping exclusions win, then flat addition. Night premium inclusion is separately configurable and still respects these exclusions.

Monthly jobs add the supplement once to the global monthly salary; regular shift hours add only extra premiums, while overtime is paid in full as before. Paid days and the standalone quick calculator retain their existing base-rate calculations. No agreement names, sector rates, or legal entitlement are inferred.

## Settings changes and shift snapshots (v6)

Migration 6 adds `shifts.unpaid_breaks` and `shifts.holiday_pay_json`, filled for existing shifts with the job's unpaid-break rule and the holiday settings in effect at the upgrade, so no existing total changes. New shifts copy both on creation, like the hourly rate, bonus and salary supplement. Reports price each shift with its own copies; holiday intervals are looked up once per distinct saved holiday configuration.

After Save, Salary settings and Holiday pay ask which shifts get the change (only when a copied value changed):

- **All shifts this month** (`"currentPeriod"`): `saveSalarySettings` writes each *changed* value (hourly rate, bonus per shift, salary supplement, unpaid breaks) to every shift of the job that started in the current pay period, including shifts with a custom rate or bonus. `saveHolidayPaySettings` writes the holiday settings to every shift of the current pay period. The settings and the shift updates are one transaction.
- **Only new shifts** (`"newShiftsOnly"`): only the settings are saved. Existing shifts are not touched.

Earlier pay periods never change. Job name, pay type, currency, monthly salary and monthly hours are job-level values with no per-shift copy; they still apply to every month.
