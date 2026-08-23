import {
  getPocketAmountForPayday,
  getPocketPerPeriodForDate,
} from '@/lib/pocket-per-period';
import {
  alignPaydayContainingDate,
  getCalendarPocketPeriodStarts,
  getPocketPeriodBounds,
  pocketPeriodEndsOnOrAfterBalance,
} from '@/lib/pocketPeriods';
import {
  getCalendarRecurringInstances,
  getRecurringStartDate,
} from '@/lib/recurring-expenses';
import { getLocalDateString } from '@/lib/utils';
import type {
  BudgetSettings,
  BudgetState,
  FixedEvent,
  IncomeSource,
  PaydayEditRow,
  PayFrequency,
  PocketExpenseItem,
  RecurringExpense,
} from '@/types';

function lastDayOf(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function getPocketPaydays(
  settings: BudgetSettings,
  coverDates?: readonly string[],
): string[] {
  const source =
    settings.pocketIncomeSourceId &&
    settings.incomeSources.find((s) => s.id === settings.pocketIncomeSourceId);
  const firstPayday = source ? source.firstPayday : settings.pocketFirstPayday;
  const frequency = source ? source.payFrequency : settings.pocketFrequency;
  const interval = source ? source.payInterval : settings.pocketInterval;
  const startDate = settings.startDate;
  const merged = [startDate, ...(coverDates ?? [])].filter((s) =>
    /^\d{4}-\d{2}-\d{2}$/.test((s ?? '').slice(0, 10)),
  );
  const minCover =
    merged.length === 0 ? startDate : merged.reduce((a, b) => (a < b ? a : b));
  const listStart =
    source || frequency === 'custom'
      ? alignPaydayContainingDate(minCover, firstPayday, frequency, interval)
      : firstPayday;
  const all = source
    ? getPaydaysForFrequency(listStart, frequency, interval, startDate)
    : frequency === 'custom'
      ? getPaydaysForFrequency(listStart, frequency, interval, startDate)
      : getCalendarPocketPeriodStarts(
          frequency,
          new Date(`${startDate}T00:00:00`).getFullYear(),
        );
  return all.filter((start, i) => {
    const { end } = getPocketPeriodBounds(
      start,
      all[i + 1],
      frequency,
      interval,
    );
    return pocketPeriodEndsOnOrAfterBalance(end, startDate);
  });
}

function advancePayday(
  d: Date,
  frequency: PayFrequency,
  payInterval?: number,
): boolean {
  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
    return true;
  }
  if (frequency === 'biweekly') {
    d.setDate(d.getDate() + 14);
    return true;
  }
  if (frequency === 'monthly') {
    const day = d.getDate();
    d.setMonth(d.getMonth() + 1);
    const lastDay = lastDayOf(d.getFullYear(), d.getMonth() + 1);
    d.setDate(Math.min(day, lastDay));
    return true;
  }
  if (frequency === 'custom' && payInterval && payInterval > 0) {
    d.setDate(d.getDate() + payInterval);
    return true;
  }
  return false;
}

export function getPaydaysForFrequency(
  firstPayday: string,
  frequency: PayFrequency,
  payInterval?: number,
  startDate?: string,
): string[] {
  const result: string[] = [];
  const d = new Date(`${firstPayday}T00:00:00`);

  const base = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
  const startYear = base.getFullYear();
  const rangeStart = new Date(startYear, 0, 1);
  const rangeEnd = new Date(startYear + 4, 11, 31);

  while (d < rangeStart) {
    if (!advancePayday(d, frequency, payInterval)) return result;
  }

  while (d <= rangeEnd) {
    result.push(getLocalDateString(d));
    if (!advancePayday(d, frequency, payInterval)) break;
  }
  return result;
}

export function dateInPeriod(
  date: string,
  start: string,
  end: string,
): boolean {
  return date >= start && date <= end;
}

export function getPeriodIndexWithBounds(
  date: string,
  bounds: readonly { start: string; end: string }[],
): number | null {
  for (let i = 0; i < bounds.length; i++) {
    if (dateInPeriod(date, bounds[i].start, bounds[i].end)) return i;
  }
  return null;
}

function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function isIncomePaydaySkipped(
  settings: BudgetSettings,
  payday: string,
): boolean {
  for (const g of settings.goals) {
    if (g.hidden) continue;
    if (!g.pauseIncome) continue;
    if (isDateInRange(payday, g.startDate, g.endDate)) return true;
    if (g.incomeResumeDate && payday > g.endDate && payday < g.incomeResumeDate)
      return true;
  }
  return false;
}

function isExpensePausedOnDate(
  settings: BudgetSettings,
  expenseId: string,
  date: string,
): boolean {
  for (const goal of settings.goals) {
    if (goal.hidden) continue;
    if (!goal.pausedExpenseIds.includes(expenseId)) continue;
    if (isDateInRange(date, goal.startDate, goal.endDate)) return true;
  }
  return false;
}

function getRecurringInstanceAmount(
  rec: RecurringExpense,
  amount: number,
  date: string,
): number {
  const override = rec.occurrenceOverrides?.find(
    (candidate) => candidate.scheduledDate === date,
  );
  return override?.amount ?? amount;
}

function isPocketPausedOnDate(settings: BudgetSettings, date: string): boolean {
  for (const goal of settings.goals) {
    if (goal.hidden) continue;
    if (!goal.pausePocket) continue;
    if (isDateInRange(date, goal.startDate, goal.endDate)) return true;
  }
  return false;
}

export function getSourceAmountForDate(
  source: IncomeSource,
  date: string,
): number {
  const sorted = source.rateChanges
    .filter((change) => !change.hidden)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  let amount = source.amount;
  for (const change of sorted) {
    if (change.effectiveDate <= date) amount = change.amount;
    else break;
  }
  return amount;
}

function getPaydayAmountWithOverride(
  settings: BudgetSettings,
  source: IncomeSource,
  date: string,
): number {
  const o = settings.paydayIncomeOverrides?.find(
    (x) => x.date === date && x.sourceId === source.id,
  );
  if (o) return o.amount;
  return getSourceAmountForDate(source, date);
}

export function isValidIsoDate(s: string | undefined): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function incomeEndedBeforeDate(source: IncomeSource, date: string): boolean {
  if (!isValidIsoDate(source.endsOn) || source.endsOnIgnored) return false;
  return date > source.endsOn;
}

function includeIncomeSourceInProjection(source: IncomeSource): boolean {
  return !source.hidden;
}

function includeIncomePayday(source: IncomeSource, payday: string): boolean {
  if (!includeIncomeSourceInProjection(source)) return false;
  if (incomeEndedBeforeDate(source, payday)) return false;
  return true;
}

export function getPaydayEditRowsForDate(
  settings: BudgetSettings,
  date: string,
): PaydayEditRow[] {
  const rows: PaydayEditRow[] = [];
  for (const source of settings.incomeSources) {
    if (!includeIncomePayday(source, date)) continue;
    const incomeListStart = alignPaydayContainingDate(
      settings.startDate,
      source.firstPayday,
      source.payFrequency,
      source.payInterval,
    );
    const sourcePaydays = getPaydaysForFrequency(
      incomeListStart,
      source.payFrequency,
      source.payInterval,
      settings.startDate,
    );
    if (!sourcePaydays.includes(date)) continue;
    if (isIncomePaydaySkipped(settings, date)) continue;
    const scheduledAmount = getSourceAmountForDate(source, date);
    const currentAmount = getPaydayAmountWithOverride(settings, source, date);
    rows.push({
      sourceId: source.id,
      name: source.name,
      scheduledAmount,
      currentAmount,
    });
  }
  return rows;
}

export function getIncomeForDate(
  settings: BudgetSettings,
  date: string,
): number {
  return settings.incomeSources.reduce((total, source) => {
    if (source.hidden) return total;
    if (incomeEndedBeforeDate(source, date)) return total;
    return total + getSourceAmountForDate(source, date);
  }, 0);
}

export function periodsPerYear(freq: PayFrequency, interval?: number): number {
  if (freq === 'weekly') return 52;
  if (freq === 'biweekly') return 26;
  if (freq === 'monthly') return 12;
  if (freq === 'custom' && interval && interval > 0) return 365 / interval;
  return 0;
}

export function getMonthlyIncome(settings: BudgetSettings): number {
  const today = getLocalDateString();
  return settings.incomeSources.reduce((sum, source) => {
    if (source.hidden) return sum;
    if (incomeEndedBeforeDate(source, today)) return sum;
    const amount = getSourceAmountForDate(source, today);
    const periods = periodsPerYear(source.payFrequency, source.payInterval);
    return sum + (amount * periods) / 12;
  }, 0);
}

export function getMonthlySavings(settings: BudgetSettings): number {
  const monthlyIncome = getMonthlyIncome(settings);
  const pocketSource =
    settings.pocketIncomeSourceId &&
    settings.incomeSources.find((s) => s.id === settings.pocketIncomeSourceId);
  const pocketPeriods =
    periodsPerYear(
      pocketSource ? pocketSource.payFrequency : settings.pocketFrequency,
      pocketSource ? pocketSource.payInterval : settings.pocketInterval,
    ) || 26;
  const today = getLocalDateString();
  const pocketNow = getPocketPerPeriodForDate(settings, today);
  const monthlyPocket = (pocketNow * pocketPeriods) / 12;
  return monthlyIncome - monthlyPocket;
}

export function getPocketDeductingRecurringPerPeriod(
  settings: BudgetSettings,
  paydays: string[],
  periodBounds: readonly { start: string; end: string }[],
): { totals: number[]; items: PocketExpenseItem[][] } {
  const totals = paydays.map(() => 0);
  const items: PocketExpenseItem[][] = paydays.map(() => []);
  const projectionEndYear =
    new Date(`${settings.startDate}T00:00:00`).getFullYear() + 4;

  for (const rec of settings.recurringExpenses) {
    if (rec.hidden) continue;
    if (!rec.deductFromPocket) continue;
    const endBound = rec.endMonth ?? `${projectionEndYear}-12`;
    const startDate = getRecurringStartDate(rec);

    if (rec.deductIncomeSourceId) {
      const source = settings.incomeSources.find(
        (s) => s.id === rec.deductIncomeSourceId,
      );
      if (!source) continue;
      const incomeListStart = alignPaydayContainingDate(
        settings.startDate,
        source.firstPayday,
        source.payFrequency,
        source.payInterval,
      );
      const sourcePaydays = getPaydaysForFrequency(
        incomeListStart,
        source.payFrequency,
        source.payInterval,
        settings.startDate,
      );
      for (const payday of sourcePaydays) {
        if (!includeIncomePayday(source, payday)) continue;
        if (isIncomePaydaySkipped(settings, payday)) continue;
        const monthStr = payday.slice(0, 7);
        if (payday < startDate) continue;
        if (monthStr < rec.startMonth || monthStr > endBound) continue;
        if (isExpensePausedOnDate(settings, rec.id, payday)) continue;
        const amount = getRecurringInstanceAmount(rec, rec.amount, payday);
        const idx = getPeriodIndexWithBounds(payday, periodBounds);
        if (idx !== null) {
          totals[idx] += amount;
          items[idx].push({
            label: rec.label,
            amount,
            date: payday,
            recurringExpenseId: rec.id,
            recurringOccurrenceDate: payday,
          });
        }
      }
      continue;
    }

    for (const instance of getCalendarRecurringInstances(
      rec,
      projectionEndYear,
    )) {
      const dateStr = instance.date;
      if (!isExpensePausedOnDate(settings, rec.id, dateStr)) {
        const amount = getRecurringInstanceAmount(
          rec,
          instance.amount,
          instance.scheduledDate,
        );
        const idx = getPeriodIndexWithBounds(dateStr, periodBounds);
        if (idx !== null) {
          totals[idx] += amount;
          items[idx].push({
            label: rec.label,
            amount,
            date: dateStr,
            recurringExpenseId: rec.id,
            recurringOccurrenceDate: instance.scheduledDate,
          });
        }
      }
    }
  }

  return { totals, items };
}

export function genFixedEvents(
  settings: BudgetSettings,
  coverDates?: readonly string[],
): FixedEvent[] {
  const ev: FixedEvent[] = [];

  for (const source of settings.incomeSources) {
    const incomeListStart = alignPaydayContainingDate(
      settings.startDate,
      source.firstPayday,
      source.payFrequency,
      source.payInterval,
    );
    const sourcePaydays = getPaydaysForFrequency(
      incomeListStart,
      source.payFrequency,
      source.payInterval,
      settings.startDate,
    );
    for (const payday of sourcePaydays) {
      if (!includeIncomePayday(source, payday)) continue;
      if (!isIncomePaydaySkipped(settings, payday)) {
        const amount = getPaydayAmountWithOverride(settings, source, payday);
        ev.push({
          date: payday,
          label: `${source.name} $${amount}`,
          delta: amount,
          type: 'payday',
          sourceId: source.id,
        });
      }
    }
  }

  const pocketPaydays = getPocketPaydays(settings, coverDates);
  for (const payday of pocketPaydays) {
    if (!isPocketPausedOnDate(settings, payday)) {
      const pocketAmt = getPocketAmountForPayday(settings, payday);
      ev.push({
        date: payday,
        label: 'pocket',
        delta: -pocketAmt,
        type: 'pocket',
      });
    }
  }

  const projectionEndYear =
    new Date(`${settings.startDate}T00:00:00`).getFullYear() + 4;

  for (const rec of settings.recurringExpenses) {
    if (rec.hidden) continue;
    const endBound = rec.endMonth ?? `${projectionEndYear}-12`;
    const startDate = getRecurringStartDate(rec);

    if (rec.deductIncomeSourceId && !rec.deductFromPocket) {
      const source = settings.incomeSources.find(
        (s) => s.id === rec.deductIncomeSourceId,
      );
      if (source) {
        const incomeListStart = alignPaydayContainingDate(
          settings.startDate,
          source.firstPayday,
          source.payFrequency,
          source.payInterval,
        );
        const sourcePaydays = getPaydaysForFrequency(
          incomeListStart,
          source.payFrequency,
          source.payInterval,
          settings.startDate,
        );
        for (const payday of sourcePaydays) {
          if (!includeIncomePayday(source, payday)) continue;
          if (isIncomePaydaySkipped(settings, payday)) continue;
          const monthStr = payday.slice(0, 7);
          if (payday < startDate) continue;
          if (monthStr < rec.startMonth || monthStr > endBound) continue;
          if (isExpensePausedOnDate(settings, rec.id, payday)) continue;
          const amount = getRecurringInstanceAmount(rec, rec.amount, payday);
          ev.push({
            date: payday,
            label: `${rec.label} $${amount}`,
            delta: -amount,
            type: 'recurring',
            sourceId: rec.deductIncomeSourceId,
            recurringExpenseId: rec.id,
            recurringOccurrenceDate: payday,
          });
        }
      }
      continue;
    }

    if (rec.deductIncomeSourceId) continue;

    if (!rec.deductFromPocket) {
      for (const instance of getCalendarRecurringInstances(
        rec,
        projectionEndYear,
      )) {
        const dateStr = instance.date;
        if (isExpensePausedOnDate(settings, rec.id, dateStr)) continue;
        const amount = getRecurringInstanceAmount(
          rec,
          instance.amount,
          instance.scheduledDate,
        );
        ev.push({
          date: dateStr,
          label: `${rec.label} $${amount}`,
          delta: -amount,
          type: 'recurring',
          recurringExpenseId: rec.id,
          recurringOccurrenceDate: instance.scheduledDate,
        });
      }
    }
  }

  for (const o of settings.oneTimeIncome ?? []) {
    if (o.hidden) continue;
    ev.push({
      date: o.date,
      label: `${o.label} $${o.amount}`,
      delta: o.amount,
      type: 'one-time',
    });
  }

  for (const goal of settings.goals) {
    if (goal.hidden) continue;
    const total = goal.lineItems.reduce((s, i) => s + i.amount, 0);
    if (total > 0) {
      ev.push({
        date: goal.startDate,
        label: `${goal.name} $${total.toLocaleString()}`,
        delta: -total,
        type: 'goal',
        sourceId: goal.id,
      });
    }
  }

  return ev;
}

export function getCurrentBalances(state: BudgetState, today: string) {
  const { expenses, spentPerPeriod, settings } = state;
  const expenseDates = expenses.map((expense) => expense.date);
  const paydays = getPocketPaydays(settings, expenseDates);
  const pocketSource =
    settings.pocketIncomeSourceId &&
    settings.incomeSources.find(
      (source) => source.id === settings.pocketIncomeSourceId,
    );
  const frequency = pocketSource
    ? pocketSource.payFrequency
    : settings.pocketFrequency;
  const interval = pocketSource
    ? pocketSource.payInterval
    : settings.pocketInterval;
  const periodBounds = paydays.map((payday, index) =>
    getPocketPeriodBounds(payday, paydays[index + 1], frequency, interval),
  );
  const pocketRecurring = getPocketDeductingRecurringPerPeriod(
    settings,
    paydays,
    periodBounds,
  );
  const overflowEvents: FixedEvent[] = [];
  let pocketBalance = 0;

  for (let index = 0; index < periodBounds.length; index++) {
    const range = periodBounds[index];
    pocketBalance += getPocketAmountForPayday(
      settings,
      paydays[index] ?? range.start,
    );
    for (const item of pocketRecurring.items[index] ?? []) {
      const covered = Math.min(item.amount, pocketBalance);
      const overflow = item.amount - covered;
      pocketBalance -= covered;
      if (overflow > 0 || item.amount <= 0) {
        overflowEvents.push({
          date: item.date ?? range.end,
          label: item.label,
          delta: -overflow,
          type: 'recurring',
          recurringExpenseId: item.recurringExpenseId,
        });
      }
    }

    const periodExpenses = expenses
      .filter((expense) => dateInPeriod(expense.date, range.start, range.end))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (periodExpenses.length > 0) {
      for (const expense of periodExpenses) {
        const covered = Math.min(expense.amount, pocketBalance);
        const overflow = expense.amount - covered;
        pocketBalance -= covered;
        if (overflow > 0) {
          overflowEvents.push({
            date: expense.date,
            label: expense.label,
            delta: -overflow,
            type: 'user-expense',
          });
        }
      }
    } else {
      pocketBalance = Math.max(0, pocketBalance - (spentPerPeriod[index] || 0));
    }
  }

  for (const expense of expenses) {
    if (getPeriodIndexWithBounds(expense.date, periodBounds) === null) {
      overflowEvents.push({
        date: expense.date,
        label: expense.label,
        delta: -expense.amount,
        type: 'user-expense',
      });
    }
  }

  const firstPayday = paydays[0];
  let savings =
    settings.startingBalance -
    (firstPayday && firstPayday <= settings.startDate
      ? getPocketAmountForPayday(settings, firstPayday)
      : 0);
  for (const event of [
    ...genFixedEvents(settings, expenseDates),
    ...overflowEvents,
  ]) {
    if (event.date > settings.startDate && event.date <= today) {
      savings += event.delta;
    }
  }

  const currentPeriod = getPeriodIndexWithBounds(today, periodBounds);
  let pocket = 0;
  if (currentPeriod !== null) {
    for (let index = 0; index < currentPeriod; index++) {
      const range = periodBounds[index];
      const periodExpenses = expenses.filter((expense) =>
        dateInPeriod(expense.date, range.start, range.end),
      );
      const spent =
        (periodExpenses.length > 0
          ? periodExpenses.reduce((total, expense) => total + expense.amount, 0)
          : spentPerPeriod[index] || 0) + (pocketRecurring.totals[index] || 0);
      pocket = Math.max(
        0,
        pocket + getPocketAmountForPayday(settings, paydays[index]) - spent,
      );
    }

    const range = periodBounds[currentPeriod];
    pocket += getPocketAmountForPayday(
      settings,
      paydays[currentPeriod] ?? range.start,
    );
    for (const item of pocketRecurring.items[currentPeriod] ?? []) {
      if (!item.date || item.date <= today) {
        pocket -= Math.min(item.amount, pocket);
      }
    }
    const periodExpenses = expenses
      .filter(
        (expense) =>
          dateInPeriod(expense.date, range.start, range.end) &&
          expense.date <= today,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    if (periodExpenses.length > 0) {
      for (const expense of periodExpenses) {
        pocket -= Math.min(expense.amount, pocket);
      }
    } else {
      pocket = Math.max(0, pocket - (spentPerPeriod[currentPeriod] ?? 0));
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    savings: round(savings),
    pocket: round(pocket),
    combined: round(savings + pocket),
  };
}
