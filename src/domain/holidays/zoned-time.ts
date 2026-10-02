import { HOLIDAY_TIMEZONE } from "./holiday-settings";
const formatter = new Intl.DateTimeFormat("en-GB-u-ca-iso8601-nu-latn", {
  timeZone: HOLIDAY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function parts(date: Date) { return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value])); }
export function israelDateKey(date: Date): string {
  const p = parts(date); return `${p.year}-${p.month}-${p.day}`;
}
export function calendarDay(dateKey: string, delta: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}
function wallEpoch(date: Date): number {
  const p = parts(date); return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
}
/** IANA wall-clock conversion: repeated clocks use the first occurrence, skipped clocks move forward. */
export function israelWallTime(dateKey: string, minute: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, 0, minute);
  const offsets = [-36, 0, 36].map((hours) => { const sample = new Date(target + hours * 3_600_000); return wallEpoch(sample) - sample.getTime(); });
  const candidates = [...new Set(offsets)].map((offset) => new Date(target - offset)).sort((a, b) => a.getTime() - b.getTime());
  return candidates.find((candidate) => wallEpoch(candidate) === target)
    ?? candidates.filter((candidate) => wallEpoch(candidate) > target).sort((a, b) => wallEpoch(a) - wallEpoch(b))[0];
}
export function holidayYearsForRange(start: Date, end: Date): number[] {
  const first = Number(calendarDay(israelDateKey(start), -1).slice(0, 4));
  const last = Number(calendarDay(israelDateKey(end), 1).slice(0, 4));
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}
