import {
  addDays,
  compareAsc,
  differenceInCalendarDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
} from 'date-fns';
import type { PayFrequency } from '@/types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function lastDayOf(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

const MONTH_WEEK_CHUNK_STARTS = [1, 8, 15, 22, 29] as const;

const BIWEEK_ANCHOR_MONDAY = parseISO('1970-01-05');

function advanceCustomPeriod(d: Date, payInterval?: number): void {
  if (payInterval && payInterval > 0) {
    d.setDate(d.getDate() + payInterval);
  } else {
    d.setDate(d.getDate() + 7);
  }
}

export function getMonthWeekChunkPeriodEnds(periodStart: string): string {
  const [y, m, d] = periodStart.split('-').map(Number);
  const last = lastDayOf(y, m);
  let endDay: number;
  if (d === 1) endDay = Math.min(7, last);
  else if (d === 8) endDay = Math.min(14, last);
  else if (d === 15) endDay = Math.min(21, last);
  else if (d === 22) endDay = Math.min(28, last);
  else endDay = last;
  return fmtDate(y, m, endDay);
}

export function getCalendarMonthWeekChunkStarts(
  projectionStartYear: number,
): string[] {
  const intervalStart = new Date(projectionStartYear, 0, 1);
  const intervalEnd = new Date(projectionStartYear + 4, 11, 31);
  const months = eachMonthOfInterval({
    start: intervalStart,
    end: intervalEnd,
  });
  const out: string[] = [];
  for (const monthDate of months) {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth() + 1;
    const last = lastDayOf(y, m);
    for (const day of MONTH_WEEK_CHUNK_STARTS) {
      if (day <= last) {
        out.push(fmtDate(y, m, day));
      }
    }
  }
  return out;
}

export function getCalendarIsoBiweekStarts(
  projectionStartYear: number,
): string[] {
  const intervalStart = new Date(projectionStartYear, 0, 1);
  const intervalEnd = new Date(projectionStartYear + 4, 11, 31);
  const weeks = eachWeekOfInterval(
    { start: intervalStart, end: intervalEnd },
    { weekStartsOn: 1 },
  );
  return weeks
    .filter(
      (monday) =>
        differenceInCalendarDays(monday, BIWEEK_ANCHOR_MONDAY) % 14 === 0,
    )
    .map((d) => format(d, 'yyyy-MM-dd'));
}

export function getCalendarMonthStarts(projectionStartYear: number): string[] {
  const intervalStart = new Date(projectionStartYear, 0, 1);
  const intervalEnd = new Date(projectionStartYear + 4, 11, 31);
  const months = eachMonthOfInterval({
    start: intervalStart,
    end: intervalEnd,
  });
  return months.map((d) => format(startOfMonth(d), 'yyyy-MM-dd'));
}

export function getPocketPeriodRange(
  periodStart: string,
  _nextPeriodStart: string | undefined,
  frequency: PayFrequency,
  payInterval?: number,
): { start: string; end: string; label: string } {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (frequency === 'custom') {
    const startD = new Date(`${periodStart}T00:00:00`);
    let endD: Date;
    if (_nextPeriodStart) {
      endD = new Date(`${_nextPeriodStart}T00:00:00`);
      endD.setDate(endD.getDate() - 1);
    } else {
      endD = new Date(`${periodStart}T00:00:00`);
      advanceCustomPeriod(endD, payInterval);
      endD.setDate(endD.getDate() - 1);
    }
    return {
      start: periodStart,
      end: endD.toISOString().slice(0, 10),
      label: `${fmt(startD)} - ${fmt(endD)}`,
    };
  }

  if (frequency === 'weekly') {
    const startD = parseISO(periodStart);
    const endStr = getMonthWeekChunkPeriodEnds(periodStart);
    const endD = parseISO(endStr);
    return {
      start: periodStart,
      end: endStr,
      label: `${fmt(startD)} - ${fmt(endD)}`,
    };
  }

  if (frequency === 'biweekly') {
    const startD = parseISO(periodStart);
    const endD = addDays(startD, 13);
    return {
      start: periodStart,
      end: format(endD, 'yyyy-MM-dd'),
      label: `${fmt(startD)} - ${fmt(endD)}`,
    };
  }

  const startD = parseISO(periodStart);
  const endD = endOfMonth(startD);
  return {
    start: periodStart,
    end: format(endD, 'yyyy-MM-dd'),
    label: `${fmt(startD)} - ${fmt(endD)}`,
  };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeBalanceStartDay(isoMaybe: string): string | null {
  const s = (isoMaybe ?? '').trim().slice(0, 10);
  if (!ISO_DAY.test(s)) return null;
  return s;
}

export function pocketPeriodEndsOnOrAfterBalance(
  periodEnd: string,
  balanceStart: string,
): boolean {
  const day = normalizeBalanceStartDay(balanceStart);
  if (!day) return true;
  const end = parseISO(periodEnd.slice(0, 10));
  const bal = parseISO(day);
  if (!isValid(end) || !isValid(bal)) return true;
  return compareAsc(end, bal) >= 0;
}

export function getCalendarPocketPeriodStarts(
  frequency: PayFrequency,
  projectionStartYear: number,
): string[] {
  if (frequency === 'weekly') {
    return getCalendarMonthWeekChunkStarts(projectionStartYear);
  }
  if (frequency === 'biweekly') {
    return getCalendarIsoBiweekStarts(projectionStartYear);
  }
  if (frequency === 'monthly') {
    return getCalendarMonthStarts(projectionStartYear);
  }
  return [];
}
