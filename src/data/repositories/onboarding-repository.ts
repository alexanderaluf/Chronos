import type { SQLiteDatabase } from "expo-sqlite";

import type { AppLanguage } from "@/domain/entities";
import type { WorkCity } from "@/domain/holidays/holiday-settings";
import type { MinorUnits } from "@/domain/money/money";
import type { PayType } from "@/domain/pay/shift-pay";
import type { EmploymentType, Gender } from "@/domain/tax/tax-status";

import { DataValidationError, writeTransaction } from "../database/sql";
import { getJob, listJobs, writeJob } from "./jobs-repository";
import { writePayComponent } from "./pay-components-repository";
import { getSettings, writeSettings } from "./settings-repository";

/** What the first-run onboarding asks: the minimum for correct shift pay and a fair net estimate. */
export type OnboardingInput = {
  language: AppLanguage;
  /** The first profile's name: where the user works. */
  jobName: string;
  payType: PayType;
  hourlyRate: MinorUnits;
  monthlySalary: MinorUnits;
  monthlyHoursDivisor: number;
  /** 0 = no travel allowance. Otherwise saved as a "per work day" addition. */
  travelPerDay: MinorUnits;
  /** Name of the travel addition, in the user's language. */
  travelName: string;
  gender: Gender;
  employmentType: EmploymentType;
  workCity: WorkCity;
};

/**
 * Saves the onboarding answers in one transaction: the first profile's name and pay,
 * the personal and tax basics, the holiday work city, an optional travel
 * addition, and the completion time. Everything stays editable in Settings.
 */
export async function completeOnboarding(database: SQLiteDatabase, input: OnboardingInput, now = new Date()) {
  const pay = input.payType === "hourly" ? input.hourlyRate : input.monthlySalary;
  if (!Number.isSafeInteger(pay) || pay <= 0) {
    throw new DataValidationError("Enter your pay to continue.", "onboarding/pay-required");
  }
  return writeTransaction(database, async (db) => {
    const settings = await getSettings(db);
    const job = (settings.defaultJobId ? await getJob(db, settings.defaultJobId) : null) ?? (await listJobs(db)).at(0);
    if (!job) throw new DataValidationError("This job no longer exists.", "job/not-found");
    await writeJob(db, job.id, {
      name: input.jobName,
      payType: input.payType,
      hourlyRate: input.payType === "hourly" ? input.hourlyRate : job.hourlyRate,
      monthlySalary: input.payType === "monthly" ? input.monthlySalary : job.monthlySalary,
      monthlyHoursDivisor: input.monthlyHoursDivisor,
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
    return writeSettings(db, {
      appLanguage: input.language,
      defaultJobId: job.id,
      personalInfo: { ...settings.personalInfo, gender: input.gender },
      taxStatus: { ...settings.taxStatus, employmentType: input.employmentType },
      holidayPay: { ...settings.holidayPay, workCity: input.workCity },
      onboardingCompletedAt: now.toISOString(),
    });
  });
}
