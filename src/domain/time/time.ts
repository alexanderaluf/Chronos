/**
 * Time rules for all of Chronos:
 *
 * - A moment is stored as an ISO-8601 UTC string (`2026-10-01T05:30:00.000Z`)
 *   and handled as a `Date`. Durations are computed from those instants, so a
 *   shift that crosses midnight or a daylight-saving change is still exact.
 * - Calendar questions ("which day / month is this shift in", "is it night")
 *   are answered in the device's local time zone with `new Date(y, m, d, h)`,
 *   which already accounts for DST.
 * - Durations are integer minutes.
 */

export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MS_PER_MINUTE = 60_000;

/** "YYYY-MM-DD" in local time. */
export type LocalDateKey = string;
/** "YYYY-MM" — names a pay period. */
export type PeriodKey = string;

export function toIso(date: Date): string {
  return date.toISOString();
}

export function fromIso(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid ISO timestamp: ${iso}`);
  return date;
}

/** Whole elapsed minutes between two instants (never negative). */
export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / MS_PER_MINUTE));
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** A local wall-clock time on the day of `day`. `minuteOfDay` may exceed 1440. */
export function atLocalMinute(day: Date, minuteOfDay: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minuteOfDay);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toLocalDateKey(date: Date): LocalDateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromLocalDateKey(key: LocalDateKey): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toPeriodKey(year: number, month: number): PeriodKey {
  return `${year}-${pad(month)}`;
}

export function parsePeriodKey(key: PeriodKey): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) throw new RangeError(`Invalid period key: ${key}`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function shiftPeriodKey(key: PeriodKey, deltaMonths: number): PeriodKey {
  const { year, month } = parsePeriodKey(key);
  const date = new Date(year, month - 1 + deltaMonths, 1);
  return toPeriodKey(date.getFullYear(), date.getMonth() + 1);
}

/** Minutes of overlap between [aStart, aEnd) and [bStart, bEnd). */
export function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return end > start ? Math.floor((end - start) / MS_PER_MINUTE) : 0;
}

/**
 * Minutes of [start, end) that fall inside a window repeating every local day,
 * e.g. night hours 22:00 → 06:00 (`windowStart` 1320, `windowEnd` 360).
 * A window whose end is before its start crosses midnight.
 */
export function minutesInDailyWindow(
  start: Date,
  end: Date,
  windowStartMinute: number,
  windowEndMinute: number,
): number {
  if (end <= start) return 0;
  const crossesMidnight = windowEndMinute <= windowStartMinute;
  let total = 0;
  // Begin one day early so a window that started yesterday evening is counted.
  for (
    let day = addLocalDays(startOfLocalDay(start), -1);
    day < end;
    day = addLocalDays(day, 1)
  ) {
    const windowStart = atLocalMinute(day, windowStartMinute);
    const windowEnd = crossesMidnight
      ? atLocalMinute(addLocalDays(day, 1), windowEndMinute)
      : atLocalMinute(day, windowEndMinute);
    total += overlapMinutes(start, end, windowStart, windowEnd);
  }
  return total;
}

/** Minutes of [start, end) that fall on the given local weekdays (0 = Sunday … 6 = Saturday). */
export function minutesOnWeekdays(start: Date, end: Date, weekdays: readonly number[]): number {
  if (end <= start || weekdays.length === 0) return 0;
  let total = 0;
  for (let day = startOfLocalDay(start); day < end; day = addLocalDays(day, 1)) {
    if (weekdays.includes(day.getDay())) {
      total += overlapMinutes(start, end, day, addLocalDays(day, 1));
    }
  }
  return total;
}

export type PayPeriod = {
  key: PeriodKey;
  /** Inclusive local start. */
  start: Date;
  /** Exclusive local end. */
  end: Date;
};

/**
 * The pay period named `key`. With `startDay` 1 it is the calendar month.
 * With e.g. `startDay` 25, period "2026-10" runs from 25 Oct to 25 Nov.
 * `startDay` is clamped to 1…28 so every month has that day.
 */
export function getPayPeriod(key: PeriodKey, startDay = 1): PayPeriod {
  const { year, month } = parsePeriodKey(key);
  const day = Math.min(Math.max(Math.trunc(startDay), 1), 28);
  return {
    key,
    start: new Date(year, month - 1, day),
    end: new Date(year, month, day),
  };
}

/** The pay period that contains `date`. */
export function getPayPeriodForDate(date: Date, startDay = 1): PayPeriod {
  const day = Math.min(Math.max(Math.trunc(startDay), 1), 28);
  const monthOffset = date.getDate() >= day ? 0 : -1;
  const anchor = new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
  return getPayPeriod(toPeriodKey(anchor.getFullYear(), anchor.getMonth() + 1), day);
}

/** Rounds to the nearest `stepMinutes` (e.g. 5). A step of 0 or 1 only drops seconds. */
export function roundToStep(date: Date, stepMinutes: number): Date {
  const stepMs = Math.max(1, Math.trunc(stepMinutes)) * MS_PER_MINUTE;
  return new Date(Math.round(date.getTime() / stepMs) * stepMs);
}

/** Local minutes since midnight, e.g. 07:30 → 450. */
export function minuteOfDay(date: Date): number {
  return date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
}

/**
 * Start and end instants for a shift entered as a local date plus clock times.
 * An end time at or before the start time means the shift ends the next day.
 */
export function shiftRangeFromClockTimes(
  day: Date,
  startMinute: number,
  endMinute: number,
): { start: Date; end: Date } {
  const start = atLocalMinute(day, startMinute);
  const endDay = endMinute <= startMinute ? addLocalDays(day, 1) : day;
  return { start, end: atLocalMinute(endDay, endMinute) };
}

/** The local day the week containing `date` starts on (`weekStartDay` 0 = Sunday). */
export function startOfLocalWeek(date: Date, weekStartDay: number): Date {
  const day = startOfLocalDay(date);
  return addLocalDays(day, -((day.getDay() - weekStartDay + 7) % 7));
}

/** Whole years between a birth date and a day, e.g. for credit points. */
export function ageOn(birthDate: Date, on: Date): number {
  let age = on.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    on.getMonth() < birthDate.getMonth() ||
    (on.getMonth() === birthDate.getMonth() && on.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** 450 → "07:30" */
export function formatMinuteOfDay(minute: number): string {
  const normalized = ((Math.trunc(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const absolute = Math.abs(Math.trunc(minutes));
  return `${sign}${Math.floor(absolute / 60)}:${pad(absolute % 60)}`;
}
