import type { SQLiteDatabase } from "expo-sqlite";
import type { HolidayCalendar } from "@/domain/holidays/premium-intervals";
import { parseJson, nowIso, writeTransaction } from "../database/sql";

export async function getHolidayYearCache(database: SQLiteDatabase, key: string): Promise<{ calendar: HolidayCalendar; fetchedAt: string } | null> {
  const row = await database.getFirstAsync<{ calendar_json: string; fetched_at: string }>("SELECT calendar_json, fetched_at FROM holiday_year_cache WHERE cache_key = ?", key);
  if (!row) return null;
  const calendar = parseJson(row.calendar_json) as HolidayCalendar | undefined;
  if (!calendar || !Array.isArray(calendar.events) || !calendar.events.length || !Array.isArray(calendar.times)) return null;
  const invalidEvent = calendar.events.some((event) => !event
    || typeof event.id !== "string" || typeof event.name !== "string" || event.source !== "hebcal"
    || typeof event.holidayDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(event.holidayDate)
    || Number.isNaN(Date.parse(event.holidayDate)) || new Date(event.holidayDate).toISOString().slice(0, 10) !== event.holidayDate
    || (event.kind !== "yomTov" && event.kind !== "independence"));
  const invalidTime = calendar.times.some((time) => !time
    || typeof time.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(time.date)
    || (time.kind !== "candles" && time.kind !== "havdalah")
    || typeof time.instant !== "string" || !/T.*Z$/.test(time.instant) || Number.isNaN(Date.parse(time.instant)));
  if (invalidEvent || invalidTime) return null;
  return { calendar, fetchedAt: row.fetched_at };
}
export async function saveHolidayYearCache(database: SQLiteDatabase, key: string, year: number, calendar: HolidayCalendar): Promise<void> {
  await writeTransaction(database, (db) => db.runAsync(
    `INSERT INTO holiday_year_cache (cache_key, year, calendar_json, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET calendar_json = excluded.calendar_json, fetched_at = excluded.fetched_at`,
    key, year, JSON.stringify(calendar), nowIso(),
  ));
}
