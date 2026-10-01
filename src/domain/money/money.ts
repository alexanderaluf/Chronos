/**
 * Money rules for all of Chronos:
 *
 * - An amount is always an integer count of minor units (agorot for ILS,
 *   cents for USD). Never store or pass shekels as floats.
 * - A percentage is always an integer in basis points: 10000 bp = 100%,
 *   12500 bp = 125%, 104 bp = 1.04%.
 * - Every division rounds once, half away from zero, using integer math so
 *   results are identical on every device.
 */

/** Integer minor units (agorot / cents). */
export type MinorUnits = number;

/** Integer basis points. 10000 = 100%. */
export type BasisPoints = number;

export const FULL_RATE_BP: BasisPoints = 10_000;

export function isMinorUnits(value: unknown): value is MinorUnits {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function assertMinorUnits(value: number, label = "amount"): MinorUnits {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be an integer number of minor units, got ${value}`);
  }
  return value;
}

/** Integer division rounded half away from zero. Both inputs must be safe integers. */
export function divideRounded(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new RangeError("divideRounded only accepts safe integers");
  }
  if (denominator === 0) throw new RangeError("Division by zero");
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const quotient = Math.floor(n / d);
  const remainder = n - quotient * d;
  return sign * (remainder * 2 >= d ? quotient + 1 : quotient);
}

/** `amount × rate`, e.g. 125% of a wage or 7% insurance. */
export function applyBasisPoints(amount: MinorUnits, rate: BasisPoints): MinorUnits {
  return divideRounded(amount * rate, FULL_RATE_BP);
}

/** Pay for `minutes` of work at `hourlyRate`, multiplied by `rate` (default 100%). */
export function payForMinutes(
  hourlyRate: MinorUnits,
  minutes: number,
  rate: BasisPoints = FULL_RATE_BP,
): MinorUnits {
  return divideRounded(hourlyRate * minutes * rate, 60 * FULL_RATE_BP);
}

export function sumMinor(values: readonly MinorUnits[]): MinorUnits {
  return values.reduce((total, value) => total + value, 0);
}

/** Converts user input such as "45.5" or "45,50" into minor units. Returns null when invalid. */
export function parseMajorToMinor(input: string, fractionDigits = 2): MinorUnits | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const negative = normalized.startsWith("-");
  const [whole, fraction = ""] = normalized.replace("-", "").split(".");
  if (fraction.length > fractionDigits) return null;
  const minor =
    Number(whole) * 10 ** fractionDigits + Number(fraction.padEnd(fractionDigits, "0") || 0);
  if (!Number.isSafeInteger(minor)) return null;
  return negative ? -minor : minor;
}
