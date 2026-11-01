import type { SQLiteDatabase } from "expo-sqlite";

import type { Job } from "@/domain/entities";
import { DEFAULT_HOLIDAY_PAY_SETTINGS, type WorkCity } from "@/domain/holidays/holiday-settings";
import type { MinorUnits } from "@/domain/money/money";
import { ISRAEL_DEFAULT_PAY_RULES } from "@/domain/pay/pay-rules";
import type { PayType } from "@/domain/pay/shift-pay";
import { DEFAULT_TAX_STATUS, type EmploymentType } from "@/domain/tax/tax-status";

import { DataValidationError, nowIso, writeTransaction } from "../database/sql";
import { getJob, listJobs, writeJob, writeNewJob } from "./jobs-repository";
import { writePayComponent } from "./pay-components-repository";
import { getSettings, writeSettings } from "./settings-repository";

/**
 * Profiles: each job the user works at is one profile, with its own shifts,
 * pay, additions, deductions, employer, pay period, holiday and tax settings.
 * The active profile is `settings.defaultJobId`. A deleted profile is an
 * archived job, so its records stay on the device but are never shown.
 */

/** Default pension deduction for a new job (the same as a fresh install). */
const DEFAULT_PENSION_RATE_BP = 600;

export type ProfileSummary = {
  job: Job;
  /** Recorded shifts of this profile (not deleted). */
  shiftCount: number;
};

/** Every profile that is not deleted, oldest first, with its shift count. */
export async function listProfiles(database: SQLiteDatabase): Promise<ProfileSummary[]> {
  const [jobs, counts] = await Promise.all([
    listJobs(database),
    database.getAllAsync<{ job_id: string; count: number }>(
      "SELECT job_id, COUNT(*) AS count FROM shifts WHERE deleted_at IS NULL GROUP BY job_id",
    ),
  ]);
  const byJob = new Map(counts.map((row) => [row.job_id, row.count]));
  return jobs.map((job) => ({ job, shiftCount: byJob.get(job.id) ?? 0 }));
}

export type NewProfileInput = {
  name: string;
  color: string;
  payType: PayType;
  hourlyRate: MinorUnits;
  monthlySalary: MinorUnits;
  monthlyHoursDivisor: number;
  currencyCode: string;
  /** 0 = no travel allowance. Otherwise saved as a "per work day" addition. */
  travelPerDay: MinorUnits;
  /** Names of the starter items, in the user's language. */
  travelName: string;
  pensionName: string;
  employmentType: EmploymentType;
  workCity: WorkCity;
  /**
   * Income-tax credit points are claimed at one employer. For any other job
   * they are set to 0 (manual), as an employer applies them only for a main job.
   */
  isMainJob: boolean;
};

/** Creates a job profile with its starter items and makes it the active profile. */
export async function createProfile(database: SQLiteDatabase, input: NewProfileInput): Promise<Job> {
  const pay = input.payType === "hourly" ? input.hourlyRate : input.monthlySalary;
  if (!Number.isSafeInteger(pay) || pay <= 0) {
    throw new DataValidationError("Enter your pay to continue.", "onboarding/pay-required");
  }
  return writeTransaction(database, async (db) => {
    const current = await getSettings(db);
    const job = await writeNewJob(db, {
      name: input.name,
      color: input.color,
      payType: input.payType,
      hourlyRate: input.payType === "hourly" ? input.hourlyRate : 0,
      defaultShiftBonus: 0,
      monthlySalary: input.payType === "monthly" ? input.monthlySalary : 0,
      monthlyHoursDivisor: input.monthlyHoursDivisor,
      currencyCode: input.currencyCode,
      travelPerDay: 0,
      payRules: ISRAEL_DEFAULT_PAY_RULES,
    });
    await writePayComponent(db, {
      jobId: job.id,
      kind: "deduction",
      name: input.pensionName,
      calculation: "percentOfGross",
      amount: 0,
      rateBp: DEFAULT_PENSION_RATE_BP,
      isTaxable: true,
      isActive: true,
    });
    if (input.travelPerDay > 0) {
      await writePayComponent(db, {
        jobId: job.id,
        kind: "addition",
        name: input.travelName,
        calculation: "perWorkDay",
        amount: input.travelPerDay,
        rateBp: 0,
        isTaxable: true,
        isActive: true,
      });
    }
    // Switch first, so the profile settings below are written to the new job.
    await writeSettings(db, {
      defaultJobId: job.id,
      employer: { name: "", email: "", notes: "" },
      payPeriodStartDay: current.payPeriodStartDay,
      holidayPay: { ...DEFAULT_HOLIDAY_PAY_SETTINGS, workCity: input.workCity },
      taxStatus: {
        ...DEFAULT_TAX_STATUS,
        employmentType: input.employmentType,
        ...(input.isMainJob ? {} : { creditPointsMode: "manual" as const, manualCreditPointsHundredths: 0 }),
      },
    });
    return job;
  });
}

/** Makes a profile the active one: the app then shows its shifts, pay and settings. */
export async function selectProfile(database: SQLiteDatabase, jobId: string) {
  return writeTransaction(database, async (db) => {
    const job = await getJob(db, jobId);
    if (!job || job.archivedAt) throw new DataValidationError("This job no longer exists.", "job/not-found");
    await writeSettings(db, { defaultJobId: jobId });
  });
}

/** Renames or recolors a profile. Pay is edited in Salary settings. */
export async function updateProfile(database: SQLiteDatabase, jobId: string, patch: { name: string; color: string }) {
  return writeTransaction(database, (db) => writeJob(db, jobId, patch));
}

/**
 * Deletes a profile: its job is archived, so its shifts stay saved but are
 * no longer shown. The last profile and a profile with a running shift cannot
 * be deleted. When the active profile is deleted, the oldest other one becomes active.
 */
export async function deleteProfile(database: SQLiteDatabase, jobId: string) {
  return writeTransaction(database, async (db) => {
    const jobs = await listJobs(db);
    if (!jobs.some((job) => job.id === jobId)) throw new DataValidationError("This job no longer exists.", "job/not-found");
    if (jobs.length <= 1) throw new DataValidationError("Keep at least one profile.", "profile/last");
    const running = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM shifts WHERE job_id = ? AND end_at IS NULL AND deleted_at IS NULL",
      jobId,
    );
    if (running) throw new DataValidationError("Clock out of this job's shift first.", "profile/clocked-in");
    const wasActive = (await getSettings(db)).defaultJobId === jobId;
    const now = nowIso();
    await db.runAsync("UPDATE jobs SET archived_at = ?, updated_at = ? WHERE id = ?", now, now, jobId);
    if (wasActive) await writeSettings(db, { defaultJobId: jobs.find((job) => job.id !== jobId)!.id });
  });
}
