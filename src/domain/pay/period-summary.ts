import { agreementSupplement, normalizeSalaryAgreement } from "./salary-agreement";
import type { Job, PaidDay, PayAdjustment, PayComponent, Shift } from "../entities";
import { divideRounded, payForMinutes, type MinorUnits } from "../money/money";
import type { CreditPointResult } from "../tax/credit-points";
import type { TaxRules } from "../tax/tax-rules";
import type { TaxStatus } from "../tax/tax-status";
import { fromIso, toLocalDateKey, type LocalDateKey, type PayPeriod } from "../time/time";
import { computePayslip, type Payslip, type PayslipLine } from "./payslip";
import type { HolidayPremiumInterval } from "../holidays/premium-intervals";
import { calculateShiftPay, type ShiftPay } from "./shift-pay";

export type ShiftWithPay = { shift: Shift; job: Job; pay: ShiftPay };
export type PaidDayWithPay = { paidDay: PaidDay; job: Job; amount: MinorUnits };

export type DaySummary = {
  date: LocalDateKey;
  shiftCount: number;
  paidDayCount: number;
  workedMinutes: number;
  earned: MinorUnits;
};

export type PeriodSummary = {
  holidayStatus?: "ready" | "disabled" | "needsLocation" | "unavailable" | "missingTimes";
  period: PayPeriod;
  shifts: ShiftWithPay[];
  paidDays: PaidDayWithPay[];
  days: Record<LocalDateKey, DaySummary>;
  shiftCount: number;
  /** Distinct days with at least one shift (paid days excluded). */
  daysWorked: number;
  workedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  nightShiftCount: number;
  restDayShiftCount: number;
  paidDayMinutes: number;
  payslip: Payslip;
};

export type PeriodSummaryInput = {
  holidayIntervals?: readonly HolidayPremiumInterval[];
  period: PayPeriod;
  /** Every job that may appear; monthly salaries are added for non-archived monthly jobs. */
  jobs: Job[];
  /** Shifts that started inside the period. Open and deleted shifts are ignored. */
  shifts: Shift[];
  paidDays: PaidDay[];
  adjustments: PayAdjustment[];
  components: PayComponent[];
  taxRules: TaxRules;
  taxStatus: TaxStatus;
  creditPoints: CreditPointResult;
};

/** Hourly value of a job: its rate, or monthly salary ÷ divisor. */
export function jobHourlyValue(job: Job): MinorUnits {
  if (job.payType === "monthly") {
    return job.monthlyHoursDivisor > 0 ? divideRounded(job.monthlySalary, job.monthlyHoursDivisor) : 0;
  }
  return job.hourlyRate;
}

export function calculatePayForShift(shift: Shift, job: Job, holidayIntervals: readonly HolidayPremiumInterval[] = []): ShiftPay | null {
  if (!shift.endAt || shift.deletedAt) return null;
  return calculateShiftPay({
    holidayIntervals,
    salaryAgreement: shift.salaryAgreement,
    startAt: fromIso(shift.startAt),
    endAt: fromIso(shift.endAt),
    breakMinutes: shift.breakMinutes,
    hourlyRate: job.payType === "monthly" ? jobHourlyValue(job) : shift.hourlyRate,
    payType: job.payType,
    isHoliday: shift.isHoliday,
    bonus: shift.bonus,
    tips: shift.tips,
    rules: job.payRules,
  });
}

/** A paid day earns `minutes × hourly rate × rateBp`. Monthly salaries already include it. */
export function calculatePaidDayPay(paidDay: PaidDay, job: Job): MinorUnits {
  if (paidDay.deletedAt || job.payType === "monthly") return 0;
  return payForMinutes(paidDay.hourlyRate, paidDay.minutes, paidDay.rateBp);
}

/**
 * Everything the Home, Calendar and Stats screens show for one pay period:
 * hours, shift counts and the full payslip. Shifts belong to the period
 * (and day) in which they started.
 */
export function summarizePeriod(input: PeriodSummaryInput): PeriodSummary {
  const jobsById = new Map(input.jobs.map((job) => [job.id, job]));
  const shifts: ShiftWithPay[] = [];
  const paidDays: PaidDayWithPay[] = [];
  const days: Record<LocalDateKey, DaySummary> = {};
  const dayFor = (date: LocalDateKey) =>
    (days[date] ??= { date, shiftCount: 0, paidDayCount: 0, workedMinutes: 0, earned: 0 });

  for (const shift of input.shifts) {
    const job = jobsById.get(shift.jobId);
    const pay = job ? calculatePayForShift(shift, job, input.holidayIntervals) : null;
    if (!job || !pay) continue;
    shifts.push({ shift, job, pay });
    const day = dayFor(toLocalDateKey(fromIso(shift.startAt)));
    day.shiftCount += 1;
    day.workedMinutes += pay.workedMinutes;
    day.earned += pay.total;
  }
  shifts.sort((a, b) => a.shift.startAt.localeCompare(b.shift.startAt));

  for (const paidDay of input.paidDays) {
    const job = jobsById.get(paidDay.jobId);
    if (!job || paidDay.deletedAt) continue;
    const amount = calculatePaidDayPay(paidDay, job);
    paidDays.push({ paidDay, job, amount });
    const day = dayFor(paidDay.date);
    day.paidDayCount += 1;
    day.earned += amount;
  }
  paidDays.sort((a, b) => a.paidDay.date.localeCompare(b.paidDay.date));

  const sum = (pick: (item: ShiftWithPay) => number) => shifts.reduce((total, item) => total + pick(item), 0);
  const workedMinutes = sum((item) => item.pay.workedMinutes);
  const daysWorked = Object.values(days).filter((day) => day.shiftCount > 0).length;
  const monthlySalaries = input.jobs.filter((job) => job.payType === "monthly" && !job.archivedAt);

  const baseEarnings: PayslipLine[] = [
    { key: "basePay", label: "Base pay", amount: sum((item) => item.pay.basePay) },
    ...monthlySalaries.map((job) => ({ key: `salary:${job.id}`, label: job.name, amount: job.monthlySalary })),
    { key: "agreementPay", label: "", amount: sum((item) => item.pay.agreementPay) + monthlySalaries.reduce((total, job) => total + agreementSupplement(job.monthlySalary, normalizeSalaryAgreement(job.payRules.salaryAgreement)), 0) },
    { key: "overtime", label: "Overtime", amount: sum((item) => item.pay.overtimePay) },
    { key: "nightPremium", label: "Night premium", amount: sum((item) => item.pay.nightPremium) },
    { key: "holidayPremium", label: "", amount: sum((item) => item.pay.holidayPremium) },
    { key: "paidDays", label: "Paid days off", amount: paidDays.reduce((total, item) => total + item.amount, 0) },
    { key: "shiftBonuses", label: "Shift bonuses", amount: sum((item) => item.pay.bonus) },
    { key: "tips", label: "Tips", amount: sum((item) => item.pay.tips) },
  ].filter((line) => line.key === "basePay" || line.amount !== 0);

  const adjustments = input.adjustments.filter((item) => !item.deletedAt && item.periodKey === input.period.key);
  const payslip = computePayslip({
    baseEarnings,
    daysWorked,
    workedMinutes,
    components: input.components,
    oneOffBonuses: adjustments
      .filter((item) => item.kind === "bonus")
      .map((item) => ({ key: `adjustment:${item.id}`, label: item.label, amount: item.amount, isTaxable: item.isTaxable })),
    oneOffDeductions: adjustments
      .filter((item) => item.kind === "deduction")
      .map((item) => ({ key: `adjustment:${item.id}`, label: item.label, amount: item.amount })),
    taxRules: input.taxRules,
    taxStatus: input.taxStatus,
    creditPoints: input.creditPoints,
  });

  return {
    period: input.period,
    shifts,
    paidDays,
    days,
    shiftCount: shifts.length,
    daysWorked,
    workedMinutes,
    regularMinutes: sum((item) => item.pay.regularMinutes),
    overtimeMinutes: sum((item) => item.pay.overtimeMinutes),
    nightShiftCount: shifts.filter((item) => item.pay.isNightShift).length,
    restDayShiftCount: shifts.filter((item) => item.pay.isRestDay).length,
    paidDayMinutes: paidDays.reduce((total, item) => total + item.paidDay.minutes, 0),
    payslip,
  };
}
