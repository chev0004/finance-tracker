import { getLocalDateString } from '@/lib/utils';
import type { RecurringExpense } from '@/types';

export interface RecurringExpenseInstance {
  scheduledDate: string;
  date: string;
  scheduledAmount: number;
  amount: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function lastDayOf(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function recurringDateForMonth(
  dayOfMonth: number,
  year: number,
  month: number,
): string {
  const normalizedDay = Number.isFinite(dayOfMonth) ? dayOfMonth : 1;
  const day =
    normalizedDay <= 0
      ? lastDayOf(year, month)
      : Math.min(normalizedDay, lastDayOf(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function getRecurringStartDate(rec: RecurringExpense): string {
  const exactStart = rec.startDate?.slice(0, 10);
  if (exactStart && /^\d{4}-\d{2}-\d{2}$/.test(exactStart)) return exactStart;

  const [year, month] = rec.startMonth.split('-').map(Number);
  if (Number.isFinite(year) && Number.isFinite(month)) {
    return recurringDateForMonth(rec.dayOfMonth, year, month);
  }

  return getLocalDateString();
}

function addMonthsToYearMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function nextRecurringDateOnOrAfter(date: string, dayOfMonth: number): string {
  const [year, month] = date.split('-').map(Number);
  const current = recurringDateForMonth(dayOfMonth, year, month);
  if (current >= date) return current;

  const next = addMonthsToYearMonth(year, month, 1);
  return recurringDateForMonth(dayOfMonth, next.year, next.month);
}

function previousRecurringDateBefore(date: string, dayOfMonth: number): string {
  const [year, month] = date.split('-').map(Number);
  const current = recurringDateForMonth(dayOfMonth, year, month);
  if (current < date) return current;

  const previous = addMonthsToYearMonth(year, month, -1);
  return recurringDateForMonth(dayOfMonth, previous.year, previous.month);
}

function calendarDayMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function proratedAmount(
  amount: number,
  startDate: string,
  dayOfMonth: number,
): number {
  const nextRenewal = nextRecurringDateOnOrAfter(startDate, dayOfMonth);
  if (nextRenewal === startDate) return amount;

  const previousRenewal = previousRecurringDateBefore(nextRenewal, dayOfMonth);
  const cycleDays =
    (calendarDayMs(nextRenewal) - calendarDayMs(previousRenewal)) / 86_400_000;
  const activeDays =
    (calendarDayMs(nextRenewal) - calendarDayMs(startDate)) / 86_400_000;
  if (cycleDays <= 0 || activeDays <= 0) return amount;

  return (
    Math.round(
      (amount * Math.min(1, activeDays / cycleDays) + Number.EPSILON) * 100,
    ) / 100
  );
}

export function getCalendarRecurringInstances(
  rec: RecurringExpense,
  projectionEndYear: number,
): RecurringExpenseInstance[] {
  const endBound = rec.endMonth ?? `${projectionEndYear}-12`;
  const startDate = getRecurringStartDate(rec);
  const startMonth = startDate.slice(0, 7);
  if (startMonth > endBound) return [];

  const base: { date: string; amount: number }[] = [];
  const [startYear, startMonthNumber] = startMonth.split('-').map(Number);
  const [endYear, endMonth] = endBound.split('-').map(Number);
  const startMonthRenewal = recurringDateForMonth(
    rec.dayOfMonth,
    startYear,
    startMonthNumber,
  );

  if (startDate !== startMonthRenewal) {
    base.push({
      date: startDate,
      amount: rec.prorateFirstMonth
        ? proratedAmount(rec.amount, startDate, rec.dayOfMonth)
        : rec.amount,
    });
  }

  let year = startYear;
  let month = startMonthNumber;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const date = recurringDateForMonth(rec.dayOfMonth, year, month);
    if (date >= startDate) base.push({ date, amount: rec.amount });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return base.map((instance) => {
    const override = rec.occurrenceOverrides?.find(
      (candidate) => candidate.scheduledDate === instance.date,
    );
    return {
      scheduledDate: instance.date,
      date: override?.date ?? instance.date,
      scheduledAmount: instance.amount,
      amount: override?.amount ?? instance.amount,
    };
  });
}
