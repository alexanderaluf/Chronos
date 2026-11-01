import type { SQLiteDatabase } from "expo-sqlite";

import { APP_LANGUAGES, type AccentColorId, type AppSettings, type EmployerInfo, type ThemeMode } from "@/domain/entities";
import {
  DEFAULT_PERSONAL_INFO,
  DEFAULT_TAX_STATUS,
  normalizePersonalInfo,
  normalizeTaxStatus,
} from "@/domain/tax/tax-status";

import { nowIso, parseJson, writeTransaction } from "../database/sql";
import { DEFAULT_HOLIDAY_PAY_SETTINGS, normalizeHolidayPaySettings } from "@/domain/holidays/holiday-settings";

/** App preferences, stored one key per row so new settings never need a migration. */

export const ACCENT_COLOR_IDS: readonly AccentColorId[] = [
  "cyan",
  "blue",
  "violet",
  "rose",
  "coral",
  "amber",
  "green",
  "lime",
];
const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"];

export const DEFAULT_SETTINGS: AppSettings = {
  holidayPay: DEFAULT_HOLIDAY_PAY_SETTINGS,
  appLanguage: null,
  themeMode: "system",
  accentColor: "cyan",
  payPeriodStartDay: 1,
  weekStartDay: 0,
  defaultJobId: null,
  onboardingCompletedAt: null,
  roundingMinutes: 0,
  showShiftSummaryAfterSave: true,
  calendarDirection: "ltr",
  personalInfo: DEFAULT_PERSONAL_INFO,
  taxStatus: DEFAULT_TAX_STATUS,
  employer: { name: "", email: "", notes: "" },
};

function normalizeEmployer(value: unknown): EmployerInfo {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const text = (input: unknown) => (typeof input === "string" ? input : "");
  return { name: text(raw.name), email: text(raw.email), notes: text(raw.notes) };
}

function pickOne<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function intInRange(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizeSettings(raw: Record<string, unknown>): AppSettings {
  const d = DEFAULT_SETTINGS;
  return {
    holidayPay: normalizeHolidayPaySettings(raw.holidayPay),
    appLanguage: APP_LANGUAGES.includes(raw.appLanguage as never) ? (raw.appLanguage as AppSettings["appLanguage"]) : null,
    themeMode: pickOne(raw.themeMode, THEME_MODES, d.themeMode),
    accentColor: pickOne(raw.accentColor, ACCENT_COLOR_IDS, d.accentColor),
    payPeriodStartDay: intInRange(raw.payPeriodStartDay, 1, 28, d.payPeriodStartDay),
    weekStartDay: intInRange(raw.weekStartDay, 0, 6, d.weekStartDay),
    defaultJobId: stringOrNull(raw.defaultJobId),
    onboardingCompletedAt: stringOrNull(raw.onboardingCompletedAt),
    roundingMinutes: intInRange(raw.roundingMinutes, 0, 60, d.roundingMinutes),
    showShiftSummaryAfterSave:
      typeof raw.showShiftSummaryAfterSave === "boolean" ? raw.showShiftSummaryAfterSave : d.showShiftSummaryAfterSave,
    calendarDirection: raw.calendarDirection === "rtl" ? "rtl" : "ltr",
    personalInfo: normalizePersonalInfo(raw.personalInfo),
    taxStatus: normalizeTaxStatus(raw.taxStatus),
    employer: normalizeEmployer(raw.employer),
  };
}

/**
 * Settings that belong to one job profile. They are stored on the job
 * (`jobs.profile_settings_json`) and shown as part of `AppSettings` while
 * that profile is active; everything else is shared by all profiles.
 */
export const PROFILE_SETTING_KEYS = ["employer", "payPeriodStartDay", "holidayPay", "taxStatus"] as const satisfies readonly (keyof AppSettings)[];
type ProfileSettingKey = (typeof PROFILE_SETTING_KEYS)[number];

function isProfileSettingKey(key: string): key is ProfileSettingKey {
  return (PROFILE_SETTING_KEYS as readonly string[]).includes(key);
}

type ProfileRow = { id: string; profile_settings_json: string };

/** The active profile's job: the saved one, or the oldest job that is not archived. */
async function getActiveProfileRow(database: SQLiteDatabase, savedId: string | null): Promise<ProfileRow | null> {
  const saved = savedId
    ? await database.getFirstAsync<ProfileRow>(
        "SELECT id, profile_settings_json FROM jobs WHERE id = ? AND archived_at IS NULL",
        savedId,
      )
    : null;
  return (
    saved ??
    (await database.getFirstAsync<ProfileRow>(
      "SELECT id, profile_settings_json FROM jobs WHERE archived_at IS NULL ORDER BY created_at LIMIT 1",
    ))
  );
}

/**
 * All settings, with the active profile's own values (employer, pay period,
 * holiday pay, tax status) in place. `defaultJobId` is always the active
 * profile, or null when there is no job. Pass `jobId` to read one job's
 * profile values instead (e.g. for that job's new shift).
 */
export async function getSettings(database: SQLiteDatabase, jobId?: string): Promise<AppSettings> {
  const rows = await database.getAllAsync<{ key: string; value_json: string }>(
    "SELECT key, value_json FROM settings",
  );
  const raw: Record<string, unknown> = {};
  for (const row of rows) raw[row.key] = parseJson(row.value_json);
  const profile = jobId
    ? await database.getFirstAsync<ProfileRow>("SELECT id, profile_settings_json FROM jobs WHERE id = ?", jobId)
    : await getActiveProfileRow(database, stringOrNull(raw.defaultJobId));
  if (profile && jobId) {
    const own = (parseJson(profile.profile_settings_json) ?? {}) as Record<string, unknown>;
    for (const key of PROFILE_SETTING_KEYS) if (own[key] !== undefined) raw[key] = own[key];
    return normalizeSettings(raw);
  }
  if (profile) {
    const own = (parseJson(profile.profile_settings_json) ?? {}) as Record<string, unknown>;
    for (const key of PROFILE_SETTING_KEYS) if (own[key] !== undefined) raw[key] = own[key];
  }
  raw.defaultJobId = profile?.id ?? null;
  return normalizeSettings(raw);
}

/** The job new shifts, clock-ins and reports use: the active profile. */
export async function getActiveJobId(database: SQLiteDatabase): Promise<string | null> {
  return (await getSettings(database)).defaultJobId;
}

export async function updateSettings(
  database: SQLiteDatabase,
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  return writeTransaction(database, (db) => writeSettings(db, patch));
}

/**
 * `updateSettings` for code already inside `writeTransaction` (transactions cannot nest).
 * Profile settings go to the active profile; when the patch also switches
 * profile (`defaultJobId`), they go to the newly active one.
 */
export async function writeSettings(db: SQLiteDatabase, patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings(db);
  const next = normalizeSettings({ ...current, ...patch });
  const updatedAt = nowIso();
  const profile = await getActiveProfileRow(db, next.defaultJobId);
  const profilePatch: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as (keyof AppSettings)[]) {
    if (profile && isProfileSettingKey(key)) {
      profilePatch[key] = next[key];
      continue;
    }
    await db.runAsync(
      `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      key,
      JSON.stringify(next[key]),
      updatedAt,
    );
  }
  if (profile && Object.keys(profilePatch).length > 0) {
    const own = (parseJson(profile.profile_settings_json) ?? {}) as Record<string, unknown>;
    await db.runAsync(
      "UPDATE jobs SET profile_settings_json = ?, updated_at = ? WHERE id = ?",
      JSON.stringify({ ...own, ...profilePatch }),
      updatedAt,
      profile.id,
    );
  }
  return getSettings(db);
}
