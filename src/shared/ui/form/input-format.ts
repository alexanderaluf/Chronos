import { parseMajorToMinor, type MinorUnits } from "@/domain/money/money";
import { i18n } from "@/localization/i18n";

/**
 * Converting between stored integers and the strings shown in inputs.
 * Parsers return `null` for invalid input so forms can show an error.
 */

/** 4263 → "42.63", 0 → "0" */
export function minorToInput(amount: MinorUnits): string {
  if (amount % 100 === 0) return String(amount / 100);
  return (amount / 100).toFixed(2);
}

/** "42.63" → 4263. Empty input is 0. */
export function inputToMinor(text: string): MinorUnits | null {
  if (text.trim() === "") return 0;
  const value = parseMajorToMinor(text);
  return value !== null && value >= 0 ? value : null;
}

/** 12500 → "125", 104 → "1.04" */
export function basisPointsToInput(bp: number): string {
  return minorToInput(bp);
}

/** "1.04" → 104 (percent with up to 2 decimals). */
export function inputToBasisPoints(text: string): number | null {
  return inputToMinor(text);
}

/** 225 → "2.25" (hundredths, e.g. credit points). */
export const hundredthsToInput = minorToInput;
export const inputToHundredths = inputToMinor;

/** 510 → "8.5" hours */
export function minutesToHoursInput(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 100) / 100);
}

/** "8.5" → 510 minutes. Empty input is 0. */
export function hoursInputToMinutes(text: string): number | null {
  const hundredths = inputToMinor(text);
  return hundredths === null ? null : Math.round((hundredths * 60) / 100);
}

/** Whole number ≥ 0, e.g. break minutes. */
export function inputToWholeNumber(text: string): number | null {
  if (text.trim() === "") return 0;
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/** Throws a readable error for an invalid field — FormScreen shows it. */
export function required<T>(value: T | null, field: string): T {
  if (value === null) throw new Error(i18n.t("common.checkValue", { field }));
  return value;
}
