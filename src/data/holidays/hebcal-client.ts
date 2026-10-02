import type { HolidayCalendar, HolidayEvent, HolidayTime } from "@/domain/holidays/premium-intervals";
import { HOLIDAY_TIMEZONE, WORK_CITIES, type WorkCity } from "@/domain/holidays/holiday-settings";

export const HEBCAL_BASE_URL = "https://www.hebcal.com/hebcal";
export type HebcalItem = { title: string; date: string; category: string; yomtov?: boolean; hebrew?: string; title_orig?: string };
export function normalizeHolidayTitle(title: string): string { return title.toLowerCase().replace(/[^a-z0-9]/g, ""); }
export function isPremiumHoliday(item: HebcalItem): boolean {
  return item.category === "holiday" && (item.yomtov === true || normalizeHolidayTitle(item.title) === "yomhaatzmaut" || item.hebrew?.replace(/[\u0591-\u05c7]/g, "") === "יום העצמאות");
}
export function normalizeHebcalResponse(value: unknown): HolidayCalendar {
  if (!value || typeof value !== "object" || !("items" in value) || !Array.isArray(value.items) || !value.items.length) throw new Error("Invalid Hebcal calendar");
  const events = new Map<string, HolidayEvent>();
  const times = new Map<string, HolidayTime>();
  for (const raw of value.items) {
    if (!raw || typeof raw !== "object" || typeof raw.title !== "string" || typeof raw.date !== "string" || typeof raw.category !== "string") throw new Error("Invalid Hebcal event");
    const item = raw as HebcalItem;
    if (isPremiumHoliday(item)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || Number.isNaN(Date.parse(item.date)) || new Date(item.date).toISOString().slice(0, 10) !== item.date) throw new Error("Invalid holiday date");
      const id = `${item.date}:${normalizeHolidayTitle(item.title)}`;
      events.set(id, { id, name: item.title, hebrewName: typeof item.hebrew === "string" ? item.hebrew : undefined,
        holidayDate: item.date, kind: item.yomtov === true ? "yomTov" : "independence", source: "hebcal" });
    } else if (item.category === "candles" || item.category === "havdalah") {
      if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(item.date) || Number.isNaN(Date.parse(item.date))) throw new Error("Invalid holiday time");
      const instant = new Date(item.date).toISOString();
      times.set(`${item.category}:${instant}`, { date: item.date.slice(0, 10), instant, kind: item.category });
    }
  }
  if (!events.size) throw new Error("Hebcal returned no premium holidays");
  return { events: [...events.values()], times: [...times.values()] };
}
export function hebcalUrl(year: number, city: WorkCity | null): string {
  const params = new URLSearchParams({ v: "1", cfg: "json", year: String(year), month: "x", i: "on", maj: "on", mod: "on", lg: "en" });
  if (city) {
    const location = WORK_CITIES[city];
    for (const [key, value] of Object.entries({ c: "on", M: "on", geo: "pos", latitude: String(location.latitude), longitude: String(location.longitude), tzid: HOLIDAY_TIMEZONE, b: String(location.candleMinutes) })) params.set(key, value);
  }
  return `${HEBCAL_BASE_URL}?${params}`;
}
export async function fetchHolidayYear(year: number, city: WorkCity | null, fetcher: typeof fetch = fetch): Promise<HolidayCalendar> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(hebcalUrl(year, city), { signal: controller.signal });
    if (!response.ok) throw new Error(`Hebcal status ${response.status}`);
    return normalizeHebcalResponse(await response.json());
  } finally { clearTimeout(timeout); }
}
