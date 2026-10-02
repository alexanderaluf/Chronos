import type { WeeklyRestWindow } from "../pay/pay-rules";
import type { HolidayPremiumInterval } from "../holidays/premium-intervals";
import { addLocalDays, atLocalMinute, startOfLocalWeek } from "./time";

/** Local calendar arithmetic preserves wall-clock boundaries across DST. */
export function weeklyRestIntervals(start: Date, end: Date, window: WeeklyRestWindow): HolidayPremiumInterval[] {
  const intervals: HolidayPremiumInterval[] = [];
  let endOffset = (window.endDay - window.startDay + 7) % 7;
  if (endOffset === 0 && window.endMinute <= window.startMinute) endOffset = 7;
  for (let day = addLocalDays(startOfLocalWeek(start, window.startDay), -7); day < end; day = addLocalDays(day, 7)) {
    const from = atLocalMinute(day, window.startMinute);
    const to = atLocalMinute(addLocalDays(day, endOffset), window.endMinute);
    if (from < end && to > start) intervals.push({
      startsAt: from.toISOString(), endsAt: to.toISOString(), rateBp: 10_000, holidayIds: [], timeSource: "custom",
    });
  }
  return intervals;
}
