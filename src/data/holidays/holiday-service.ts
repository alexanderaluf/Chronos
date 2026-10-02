import type { SQLiteDatabase } from "expo-sqlite";
import type { HolidayCalendar, HolidayPremiumInterval } from "@/domain/holidays/premium-intervals";
import { createHolidayWindows } from "@/domain/holidays/holiday-windows";
import { calendarDay, holidayYearsForRange, israelDateKey } from "@/domain/holidays/zoned-time";
import type { HolidayPaySettings, WorkCity } from "@/domain/holidays/holiday-settings";
import { getHolidayYearCache, saveHolidayYearCache } from "../repositories/holiday-cache-repository";
import { fetchHolidayYear } from "./hebcal-client";

export type HolidayLookup = {
  intervals: HolidayPremiumInterval[];
  status: "ready" | "disabled" | "needsLocation" | "unavailable" | "missingTimes";
};
type YearLoader = (year: number, city: WorkCity | null) => Promise<HolidayCalendar>;
const pending = new WeakMap<SQLiteDatabase, Map<string, Promise<HolidayCalendar | null>>>();
const failures = new WeakMap<SQLiteDatabase, Map<string, number>>();
async function ensureYear(db: SQLiteDatabase, year: number, city: WorkCity | null, loader: YearLoader): Promise<HolidayCalendar | null> {
  const key = `v1:${year}:${city ?? "dates"}`;
  const cache = await getHolidayYearCache(db, key);
  if (cache && Date.now() - Date.parse(cache.fetchedAt) < 30 * 86_400_000) return cache.calendar;
  const lastFailure = failures.get(db)?.get(key);
  if (lastFailure && Date.now() - lastFailure < 60_000) return cache?.calendar ?? null;
  let requests = pending.get(db);
  if (!requests) { requests = new Map(); pending.set(db, requests); }
  const existing = requests.get(key);
  if (existing) return cache?.calendar ?? existing;
  const request = (async () => {
    try {
      const calendar = await loader(year, city);
      await saveHolidayYearCache(db, key, year, calendar);
      if (city) {
        // The Israel holiday dates are shared across cities. Keep a dates-only
        // cache so switching to workplace hours also works offline.
        await saveHolidayYearCache(db, `v1:${year}:dates`, year, { events: calendar.events, times: [] });
      }
      return calendar;
    } catch {
      if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("Hebcal calendar unavailable; using cached data if present.");
      let errors = failures.get(db);
      if (!errors) { errors = new Map(); failures.set(db, errors); }
      errors.set(key, Date.now());
      return cache?.calendar ?? null;
    } finally { requests.delete(key); }
  })();
  requests.set(key, request);
  // Cached calendars remain usable immediately, even during a slow offline refresh.
  // A successful background refresh writes the cache and invalidates live reports.
  return cache?.calendar ?? request;
}
export async function ensureHolidayDataForRange(db: SQLiteDatabase, start: Date, end: Date, settings: HolidayPaySettings, loader: YearLoader = fetchHolidayYear): Promise<HolidayLookup> {
  if (!settings.enabled) return { intervals: [], status: "disabled" };
  if (settings.windowMode === "automatic" && !settings.workCity) return { intervals: [], status: "needsLocation" };
  const calendars = await Promise.all(holidayYearsForRange(start, end).map((year) => ensureYear(db, year, settings.windowMode === "automatic" ? settings.workCity : null, loader)));
  const events = [...new Map(calendars.flatMap((calendar) => calendar?.events ?? []).map((event) => [event.id, event])).values()];
  const times = [...new Map(calendars.flatMap((calendar) => calendar?.times ?? []).map((time) => [`${time.kind}:${time.instant}`, time])).values()];
  const firstDate = calendarDay(israelDateKey(start), -1);
  const lastDate = calendarDay(israelDateKey(end), 1);
  const result = createHolidayWindows({ events: events.filter((event) => event.holidayDate >= firstDate && event.holidayDate <= lastDate), times }, settings);
  return { intervals: result.intervals.filter((interval) => Date.parse(interval.startsAt) < end.getTime() && Date.parse(interval.endsAt) > start.getTime()),
    status: calendars.some((calendar) => !calendar) ? "unavailable" : result.missingTimes ? "missingTimes" : "ready" };
}
