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
import { getLocalDateString } from '@/lib/utils';
import type { PayFrequency } from '@/types';

const BIWEEK_ANCHOR_SUNDAY = new Date(1970, 0, 4);

export function alignPaydayContainingDate(
  minCover: string,
  anchorPayday: string,
  frequency: PayFrequency,
  payInterval?: number,
): string {
  const anchor = parseISO(anchorPayday.slice(0, 10));
  const d = parseISO(minCover.slice(0, 10));
  if (!isValid(anchor) || !isValid(d)) return anchorPayday.slice(0, 10);
  const diff = differenceInCalendarDays(d, anchor);
  if (frequency === 'weekly') {
    const step = Math.floor(diff / 7);
    return format(addDays(anchor, step * 7), 'yyyy-MM-dd');
  }
  if (frequency === 'biweekly') {
    const step = Math.floor(diff / 14);
    return format(addDays(anchor, step * 14), 'yyyy-MM-dd');
  }
  if (frequency === 'custom' && payInterval && payInterval > 0) {
    const step = Math.floor(diff / payInterval);
    return format(addDays(anchor, step * payInterval), 'yyyy-MM-dd');
  }
  return anchorPayday.slice(0, 10);
}

function advanceCustomPeriod(d: Date, payInterval?: number): void {
  if (payInterval && payInterval > 0) {
    d.setDate(d.getDate() + payInterval);
  } else {
    d.setDate(d.getDate() + 7);
  }
}

function getCalendarSundayWeekStarts(projectionStartYear: number): string[] {
  const intervalStart = new Date(projectionStartYear, 0, 1);
  const intervalEnd = new Date(projectionStartYear + 4, 11, 31);
  const weeks = eachWeekOfInterval(
    { start: intervalStart, end: intervalEnd },
    { weekStartsOn: 0 },
  );
  return weeks.map((d) => format(d, 'yyyy-MM-dd'));
}

function getCalendarSundayBiweekStarts(projectionStartYear: number): string[] {
  const intervalStart = new Date(projectionStartYear, 0, 1);
  const intervalEnd = new Date(projectionStartYear + 4, 11, 31);
  const weeks = eachWeekOfInterval(
    { start: intervalStart, end: intervalEnd },
    { weekStartsOn: 0 },
  );
  return weeks
    .filter((sunday) => {
      const diff = differenceInCalendarDays(sunday, BIWEEK_ANCHOR_SUNDAY);
      return ((diff % 14) + 14) % 14 === 0;
    })
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
      end: getLocalDateString(endD),
      label: `${fmt(startD)} - ${fmt(endD)}`,
    };
  }

  if (frequency === 'weekly') {
    const startD = parseISO(periodStart);
    if (!isValid(startD)) {
      const bad = parseISO(periodStart.slice(0, 10));
      return {
        start: periodStart,
        end: periodStart,
        label: `${fmt(bad)} - ${fmt(bad)}`,
      };
    }
    if (_nextPeriodStart) {
      const nextD = parseISO(_nextPeriodStart);
      if (isValid(nextD)) {
        const endD = addDays(nextD, -1);
        return {
          start: periodStart,
          end: format(endD, 'yyyy-MM-dd'),
          label: `${fmt(startD)} - ${fmt(endD)}`,
        };
      }
    }
    const endD = addDays(startD, 6);
    return {
      start: periodStart,
      end: format(endD, 'yyyy-MM-dd'),
      label: `${fmt(startD)} - ${fmt(endD)}`,
    };
  }

  if (frequency === 'biweekly') {
    const startD = parseISO(periodStart);
    if (!isValid(startD)) {
      const bad = parseISO(periodStart.slice(0, 10));
      return {
        start: periodStart,
        end: periodStart,
        label: `${fmt(bad)} - ${fmt(bad)}`,
      };
    }
    if (_nextPeriodStart) {
      const nextD = parseISO(_nextPeriodStart);
      if (isValid(nextD)) {
        const endD = addDays(nextD, -1);
        return {
          start: periodStart,
          end: format(endD, 'yyyy-MM-dd'),
          label: `${fmt(startD)} - ${fmt(endD)}`,
        };
      }
    }
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
    return getCalendarSundayWeekStarts(projectionStartYear);
  }
  if (frequency === 'biweekly') {
    return getCalendarSundayBiweekStarts(projectionStartYear);
  }
  if (frequency === 'monthly') {
    return getCalendarMonthStarts(projectionStartYear);
  }
  return [];
}
