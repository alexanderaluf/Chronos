import { fromLocalDateKey } from "../time/time";
import type { CreditPointRules } from "./tax-rules";
import type { PersonalInfo, TaxStatus } from "./tax-status";

/** Why the points were given. The UI translates the code; the domain stays language-free. */
export type CreditPointCode = "resident" | "woman" | "singleParent" | "firstDegree" | "child" | "manual";

export type CreditPointLine = {
  code: CreditPointCode;
  hundredths: number;
  /** For "child": which child (1-based) and their age in the tax year. */
  childNumber?: number;
  childAge?: number;
};

export type CreditPointResult = {
  /** Total in hundredths: 225 = 2.25 points. */
  totalHundredths: number;
  lines: CreditPointLine[];
};

/**
 * Credit points from personal info for a given tax year. A child's age is
 * the tax year minus the birth year (the child's age during that year).
 */
export function calculateAutoCreditPoints(
  personal: PersonalInfo,
  rules: CreditPointRules,
  taxYear: number,
): CreditPointResult {
  const lines: CreditPointLine[] = [{ code: "resident", hundredths: rules.residentHundredths }];
  if (personal.gender === "female") lines.push({ code: "woman", hundredths: rules.womanHundredths });
  if (personal.isSingleParent) lines.push({ code: "singleParent", hundredths: rules.singleParentHundredths });
  if (personal.hasFirstDegree) lines.push({ code: "firstDegree", hundredths: rules.firstDegreeHundredths });

  personal.childrenBirthDates.forEach((birthDate, index) => {
    const age = taxYear - fromLocalDateKey(birthDate).getFullYear();
    const rule = rules.children.find((item) => age >= item.fromAge && age <= item.toAge);
    if (!rule) return;
    const hundredths = personal.gender === "female" ? rule.motherHundredths : rule.fatherHundredths;
    if (hundredths > 0) lines.push({ code: "child", hundredths, childNumber: index + 1, childAge: age });
  });

  return {
    totalHundredths: lines.reduce((total, line) => total + line.hundredths, 0),
    lines: lines.filter((line) => line.hundredths > 0),
  };
}

/** The credit points actually used: manual override or the automatic result. */
export function resolveCreditPoints(
  personal: PersonalInfo,
  status: TaxStatus,
  rules: CreditPointRules,
  taxYear: number,
): CreditPointResult {
  if (status.creditPointsMode === "manual") {
    return {
      totalHundredths: status.manualCreditPointsHundredths,
      lines: [{ code: "manual", hundredths: status.manualCreditPointsHundredths }],
    };
  }
  return calculateAutoCreditPoints(personal, rules, taxYear);
}
