import { HOLIDAY_RATE_BP, type HolidayPaySettings } from "./holiday-settings";
import { type HolidayCalendar, type HolidayPremiumInterval, mergePremiumIntervals } from "./premium-intervals";
import { calendarDay, israelWallTime } from "./zoned-time";
export function createHolidayWindows(calendar: HolidayCalendar, settings: HolidayPaySettings): { intervals: HolidayPremiumInterval[]; missingTimes: boolean } {
  if (!settings.enabled) return { intervals: [], missingTimes: false };
  const intervals: HolidayPremiumInterval[] = [];
  let missingTimes = false;
  const yomTov = calendar.events.filter((event) => event.kind === "yomTov").sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));
  for (const event of calendar.events) {
    const custom = settings.windowMode === "custom";
    if (custom || event.kind === "independence") {
      intervals.push({ startsAt: israelWallTime(calendarDay(event.holidayDate, -1), custom ? settings.customStartMinute : 1200).toISOString(),
        endsAt: israelWallTime(event.holidayDate, custom ? settings.customEndMinute : 1200).toISOString(),
        rateBp: HOLIDAY_RATE_BP, holidayIds: [event.id], timeSource: custom ? "custom" : "hebcal" });
      continue;
    }
    const index = yomTov.findIndex((item) => item.id === event.id);
    if (index > 0 && yomTov[index - 1].holidayDate === calendarDay(event.holidayDate, -1)) continue;
    let last = index;
    while (last + 1 < yomTov.length && yomTov[last + 1].holidayDate === calendarDay(yomTov[last].holidayDate, 1)) last++;
    const lastDay = yomTov[last].holidayDate;
    const entry = calendar.times.filter((time) => time.kind === "candles" && time.date === calendarDay(event.holidayDate, -1)).sort((a, b) => a.instant.localeCompare(b.instant))[0];
    // Hebcal exits a Friday holiday after the adjoining Shabbat.
    const exit = calendar.times.filter((time) => time.kind === "havdalah" && time.date >= lastDay && time.date <= calendarDay(lastDay, 1)).sort((a, b) => a.instant.localeCompare(b.instant))[0];
    if (!entry || !exit || exit.instant <= entry.instant) { missingTimes = true; continue; }
    intervals.push({ startsAt: entry.instant, endsAt: exit.instant, rateBp: HOLIDAY_RATE_BP,
      holidayIds: yomTov.slice(index, last + 1).map((item) => item.id), timeSource: "hebcal" });
  }
  return { intervals: mergePremiumIntervals(intervals), missingTimes };
}
