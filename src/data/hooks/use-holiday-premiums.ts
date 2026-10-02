import type { HolidayPaySettings } from "@/domain/holidays/holiday-settings";
import { TABLES } from "../database/sql";
import { ensureHolidayDataForRange } from "../holidays/holiday-service";
import { useLiveQuery } from "./use-live-query";

export function useHolidayPremiums(start: string, end: string, settings: HolidayPaySettings) {
  const key = `holidays:${start}:${end}:${JSON.stringify(settings)}`;
  const query = useLiveQuery(key, [TABLES.holidayCache, TABLES.settings], async (db) => ({
    ...(await ensureHolidayDataForRange(db, new Date(start), new Date(end), settings)), key,
  }));
  return { ...query, data: query.data?.key === key ? query.data : undefined };
}
