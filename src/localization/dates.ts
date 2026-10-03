import { formatNumericDate } from "@/domain/time/time";

import { i18n } from "./i18n";
import type { AppLanguage } from "./languages";

/** Explicit language is a render dependency; month names do not rely on native Intl data. */
export function localizedMonthLabel(date: Date, language: AppLanguage, short = false): string {
  const t = i18n.getFixedT(language);
  const months = t(short ? "dates.shortMonths" : "dates.months", { returnObjects: true });
  const month = months[date.getMonth()];
  return short ? month : t("dates.monthYear", { month, year: date.getFullYear() });
}

export function localizedDayLabel(date: Date, language: AppLanguage): string {
  const t = i18n.getFixedT(language);
  return t("dates.dayLabel", {
    weekday: t("dates.shortWeekdays", { returnObjects: true })[date.getDay()],
    date: formatNumericDate(date),
  });
}
