import { getCalendars, getLocales } from "expo-localization";

import type { MinorUnits } from "@/domain/money/money";
import { HOLIDAY_TIMEZONE } from "@/domain/holidays/holiday-settings";
import { formatDuration } from "@/domain/time/time";
import { i18n } from "@/localization/i18n";
import { localizedDayLabel, localizedMonthLabel } from "@/localization/dates";
import { isAppLanguage, type AppLanguage } from "@/localization/languages";
import { formatCurrencyStatement } from "./currency-display";

/** Display helpers. Formatting only — never round or calculate money here. */

/**
 * Locale for dates and numbers: the APP language with the device region,
 * e.g. "he-IL", "ru-IL", "en-IL" — so formats follow the chosen language.
 */
export function getAppLocale(language: string = i18n.resolvedLanguage ?? "en"): string {
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

export function formatNumber(value: number, options?: Intl.NumberFormatOptions, language?: AppLanguage): string {
  return new Intl.NumberFormat(getAppLocale(language), options).format(value);
}

export function formatStatementMoney(amount: MinorUnits, currencyCode = "ILS", language?: AppLanguage): string {
  return formatCurrencyStatement(amount, currencyCode, getAppLocale(language));
}

/** 545 → "9:05 h" (the unit is translated). */
export function formatHours(minutes: number): string {
  return i18n.t("units.hours", { value: formatDuration(minutes) });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(getAppLocale(), { hour: "2-digit", minute: "2-digit" });
}

/** Holiday payroll clocks always use Israel time, including on devices abroad. */
export function formatHolidayTime(date: Date): string {
  return new Intl.DateTimeFormat(getAppLocale(), { timeZone: HOLIDAY_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function activeLanguage(): AppLanguage {
  return isAppLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";
}

export function formatDayLabel(date: Date, language: AppLanguage = activeLanguage()): string {
  return localizedDayLabel(date, language);
}

export function formatMonthLabel(date: Date, language: AppLanguage = activeLanguage()): string {
  return localizedMonthLabel(date, language);
}

export function formatShortMonthLabel(date: Date, language: AppLanguage = activeLanguage()): string {
  return localizedMonthLabel(date, language, true);
}

/** Basis points → "125%" / "1.04%". */
export function formatPercent(basisPoints: number): string {
  const value = basisPoints / 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}
