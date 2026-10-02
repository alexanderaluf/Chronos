export const HOLIDAY_TIMEZONE = "Asia/Jerusalem";
export const HOLIDAY_RATE_BP = 15_000;
export const WORK_CITIES = {
  jerusalem: { latitude: 31.778, longitude: 35.235, candleMinutes: 40 },
  telAviv: { latitude: 32.0853, longitude: 34.7818, candleMinutes: 18 },
  haifa: { latitude: 32.794, longitude: 34.9896, candleMinutes: 30 },
  beerSheva: { latitude: 31.252, longitude: 34.7915, candleMinutes: 18 },
  eilat: { latitude: 29.558, longitude: 34.948, candleMinutes: 18 },
} as const;
export type WorkCity = keyof typeof WORK_CITIES;
export type HolidayPaySettings = {
  enabled: boolean; rateBp: number; windowMode: "automatic" | "custom";
  customStartMinute: number; customEndMinute: number;
  timezone: typeof HOLIDAY_TIMEZONE; workCity: WorkCity | null;
};
export const DEFAULT_HOLIDAY_PAY_SETTINGS: HolidayPaySettings = {
  enabled: true, rateBp: HOLIDAY_RATE_BP, windowMode: "automatic",
  customStartMinute: 1080, customEndMinute: 1080, timezone: HOLIDAY_TIMEZONE, workCity: null,
};
export function normalizeHolidayPaySettings(value: unknown): HolidayPaySettings {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const minute = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1440 ? value : 1080;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : true, rateBp: HOLIDAY_RATE_BP,
    windowMode: raw.windowMode === "custom" ? "custom" : "automatic",
    customStartMinute: minute(raw.customStartMinute), customEndMinute: minute(raw.customEndMinute), timezone: HOLIDAY_TIMEZONE,
    workCity: typeof raw.workCity === "string" && Object.hasOwn(WORK_CITIES, raw.workCity) ? raw.workCity as WorkCity : null,
  };
}
