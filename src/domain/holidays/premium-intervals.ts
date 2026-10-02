export type HolidayEvent = { id: string; name: string; hebrewName?: string; holidayDate: string; kind: "yomTov" | "independence"; source: "hebcal" };
export type HolidayTime = { date: string; instant: string; kind: "candles" | "havdalah" };
export type HolidayCalendar = { events: HolidayEvent[]; times: HolidayTime[] };
export type HolidayPremiumInterval = { startsAt: string; endsAt: string; rateBp: number; holidayIds: string[]; timeSource: "hebcal" | "custom" };
export function mergePremiumIntervals(intervals: readonly HolidayPremiumInterval[]): HolidayPremiumInterval[] {
  const sorted = intervals.filter((item) => Date.parse(item.endsAt) > Date.parse(item.startsAt))
    .map((item) => ({ ...item, holidayIds: [...item.holidayIds] })).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const merged: HolidayPremiumInterval[] = [];
  for (const item of sorted) {
    const last = merged.at(-1);
    if (last && item.startsAt <= last.endsAt && item.rateBp === last.rateBp) {
      last.endsAt = last.endsAt > item.endsAt ? last.endsAt : item.endsAt;
      last.holidayIds = [...new Set([...last.holidayIds, ...item.holidayIds])];
    } else merged.push(item);
  }
  return merged;
}
export type PremiumSlice = { start: Date; end: Date; minutes: number; rateBp: number; holidayIds: string[] };
export function splitShiftByPremiumIntervals(start: Date, end: Date, intervals: readonly HolidayPremiumInterval[]): PremiumSlice[] {
  const from = start.getTime(), to = end.getTime();
  if (to <= from) return [];
  const relevant = intervals.filter((item) => Date.parse(item.startsAt) < to && Date.parse(item.endsAt) > from);
  const boundaries = [...new Set([from, to, ...relevant.flatMap((item) => [Math.max(from, Date.parse(item.startsAt)), Math.min(to, Date.parse(item.endsAt))])])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((value, index) => {
    const next = boundaries[index + 1];
    const active = relevant.filter((item) => Date.parse(item.startsAt) <= value && Date.parse(item.endsAt) >= next);
    return { start: new Date(value), end: new Date(next), minutes: Math.floor((next - from) / 60_000) - Math.floor((value - from) / 60_000),
      rateBp: Math.max(10_000, ...active.map((item) => item.rateBp)), holidayIds: [...new Set(active.flatMap((item) => item.holidayIds))] };
  });
}
