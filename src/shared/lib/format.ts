import { getCalendars, getLocales } from "expo-localization";

import type { MinorUnits } from "@/domain/money/money";
import { formatDuration } from "@/domain/time/time";
import { i18n } from "@/localization/i18n";

/** Display helpers. Formatting only — never round or calculate money here. */

/**
 * Locale for dates and numbers: the APP language with the device region,
 * e.g. "he-IL", "ru-IL", "en-IL" — so formats follow the chosen language.
 */
export function getAppLocale(): string {
  const language = i18n.resolvedLanguage ?? "en";
  const region = getLocales()[0]?.regionCode;
  return region ? `${language}-${region}` : language;
}

/** IANA zone of the device, saved on each shift (e.g. "Asia/Jerusalem"). */
export function getDeviceTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
}

export function formatMoney(amount: MinorUnits, currencyCode = "ILS"): string {
  try {
    return new Intl.NumberFormat(getAppLocale(), {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currencyCode}`;
  }
}

/** 545 → "9:05 h" (the unit is translated). */
export function formatHours(minutes: number): string {
  return i18n.t("units.hours", { value: formatDuration(minutes) });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(getAppLocale(), { hour: "2-digit", minute: "2-digit" });
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(getAppLocale(), { weekday: "short", day: "numeric", month: "short" });
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(getAppLocale(), { month: "long", year: "numeric" });
}

/** Basis points → "125%" / "1.04%". */
export function formatPercent(basisPoints: number): string {
  const value = basisPoints / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}
