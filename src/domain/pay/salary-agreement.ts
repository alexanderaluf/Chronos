import { divideRounded, FULL_RATE_BP, payForMinutes, type MinorUnits } from "../money/money";

/** A user-entered salary supplement; no sector or legal entitlement is assumed. */
export type AgreementTreatment = "excluded" | "flat" | "multiplied";
export type SalaryAgreement = {
  enabled: boolean;
  rateBp: number;
  overtime: AgreementTreatment;
  restDay: AgreementTreatment;
  holiday: AgreementTreatment;
  nightPremium: boolean;
};

export const DEFAULT_SALARY_AGREEMENT: SalaryAgreement = {
  enabled: false,
  rateBp: 900,
  overtime: "multiplied",
  restDay: "excluded",
  holiday: "excluded",
  nightPremium: false,
};

export function normalizeSalaryAgreement(input: unknown): SalaryAgreement {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const treatment = (key: "overtime" | "restDay" | "holiday") =>
    raw[key] === "excluded" || raw[key] === "flat" || raw[key] === "multiplied"
      ? raw[key] : DEFAULT_SALARY_AGREEMENT[key];
  return {
    enabled: raw.enabled === true,
    rateBp: typeof raw.rateBp === "number" && Number.isSafeInteger(raw.rateBp) && raw.rateBp >= 0 && raw.rateBp <= 100_000
      ? raw.rateBp : DEFAULT_SALARY_AGREEMENT.rateBp,
    overtime: treatment("overtime"),
    restDay: treatment("restDay"),
    holiday: treatment("holiday"),
    nightPremium: raw.nightPremium === true,
  };
}

export function agreementSupplement(base: MinorUnits, agreement: SalaryAgreement): MinorUnits {
  return agreement.enabled ? divideRounded(base * agreement.rateBp, FULL_RATE_BP) : 0;
}

/** If conditions overlap, every applicable exclusion wins; otherwise use the full pay rate only if all permit it. */
export function agreementPayRate(
  agreement: SalaryAgreement,
  rateBp: number,
  { overtime = false, restDay = false, holiday = false } = {},
): number {
  if (!agreement.enabled) return 0;
  const treatments = [overtime && agreement.overtime, restDay && agreement.restDay, holiday && agreement.holiday].filter(Boolean);
  if (treatments.includes("excluded")) return 0;
  return treatments.includes("flat") ? FULL_RATE_BP : rateBp;
}

export function hourlyPayWithAgreement(base: MinorUnits, agreement: SalaryAgreement, rateBp = FULL_RATE_BP, restDay = false): MinorUnits {
  return payForMinutes(base, 60, rateBp) + payForMinutes(agreementSupplement(base, agreement), 60, agreementPayRate(agreement, rateBp, { restDay }));
}
