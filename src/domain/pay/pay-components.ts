import { applyBasisPoints, payForMinutes, type BasisPoints, type MinorUnits } from "../money/money";

/**
 * Recurring monthly items the user defines once:
 * - additions (travel, meal allowance, fixed bonus…) are added to gross pay,
 * - deductions (pension fund, study fund, provident fund…) are taken from it.
 * One-off items for a single month are `PayAdjustment`s instead.
 */
export type PayComponentKind = "addition" | "deduction";

export type PayComponentCalculation =
  /** `amount` once per month. */
  | "monthlyFixed"
  /** `amount` × days worked. */
  | "perWorkDay"
  /** `amount` per hour worked. */
  | "perWorkHour"
  /** `rateBp` of gross pay (deductions) or of base pay (additions). */
  | "percentOfGross";

export const PAY_COMPONENT_CALCULATIONS: readonly PayComponentCalculation[] = [
  "monthlyFixed",
  "perWorkDay",
  "perWorkHour",
  "percentOfGross",
];

export type PayComponent = {
  id: string;
  kind: PayComponentKind;
  name: string;
  calculation: PayComponentCalculation;
  amount: MinorUnits;
  rateBp: BasisPoints;
  /** Additions only: counted as taxable income. */
  isTaxable: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ComponentBase = {
  daysWorked: number;
  workedMinutes: number;
  /** For additions: base pay before additions. For deductions: gross pay. */
  percentBase: MinorUnits;
};

/** The amount a component contributes this month. */
export function componentAmount(component: PayComponent, base: ComponentBase): MinorUnits {
  switch (component.calculation) {
    case "monthlyFixed":
      return component.amount;
    case "perWorkDay":
      return component.amount * base.daysWorked;
    case "perWorkHour":
      return payForMinutes(component.amount, base.workedMinutes);
    case "percentOfGross":
      return applyBasisPoints(base.percentBase, component.rateBp);
  }
}
