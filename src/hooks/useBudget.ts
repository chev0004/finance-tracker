import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { authClient } from '@/lib/auth-client';
import { BUDGET_STORAGE_KEY } from '@/lib/budget-constants';
import { getHourlyNetAmount } from '@/lib/income';
import {
  getPocketAmountForPayday,
  getPocketPerPeriodForDate,
} from '@/lib/pocket-per-period';
import {
  alignPaydayContainingDate,
  getCalendarPocketPeriodStarts,
  getPocketPeriodBounds,
  getPocketPeriodRange,
  pocketPeriodEndsOnOrAfterBalance,
} from '@/lib/pocketPeriods';
import {
  getCalendarRecurringInstances,
  getRecurringStartDate,
} from '@/lib/recurring-expenses';
import { getLocalDateString } from '@/lib/utils';
import type {
  BudgetBranch,
  BudgetSettings,
  BudgetState,
  BudgetWorkspace,
  Expense,
  FixedEvent,
  GoalStat,
  IncomeSource,
  OneTimeIncome,
  PaydayEditRow,
  PayFrequency,
  PocketExpenseItem,
  PocketPerPeriodChange,
  PocketPoint,
  RecurringExpense,
  RecurringExpenseOccurrenceOverride,
  RecurringExpenseSkip,
  SavingsGoal,
  SavingsPoint,
} from '@/types';

const DEFAULT_SETTINGS: BudgetSettings = {
  startingBalance: 0,
  startDate: getLocalDateString(),
  pocketPerPeriod: 0,
  pocketPerPeriodChanges: [],
  pocketFrequency: 'weekly',
  pocketFirstPayday: getLocalDateString(),
  pocketIncomeSourceId: undefined,
  goals: [],
  recurringExpenses: [],
  recurringExpenseSkips: [],
  incomeSources: [],
  oneTimeIncome: [],
  paydayIncomeOverrides: [],
  pocketAmountOverrides: [],
};

const DEFAULT_BRANCH_NAME = 'Main';

function lastDayOf(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function getPocketPaydays(
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

function getPaydaysForFrequency(
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

function dateInPeriod(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function getPeriodIndexWithBounds(
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

function getSourceAmountForDate(source: IncomeSource, date: string): number {
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

function isValidIsoDate(s: string | undefined): s is string {
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

function getPaydayEditRowsForDate(
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

function getIncomeForDate(settings: BudgetSettings, date: string): number {
  return settings.incomeSources.reduce((total, source) => {
    if (source.hidden) return total;
    if (incomeEndedBeforeDate(source, date)) return total;
    return total + getSourceAmountForDate(source, date);
  }, 0);
}

function periodsPerYear(freq: PayFrequency, interval?: number): number {
  if (freq === 'weekly') return 52;
  if (freq === 'biweekly') return 26;
  if (freq === 'monthly') return 12;
  if (freq === 'custom' && interval && interval > 0) return 365 / interval;
  return 0;
}

function getMonthlyIncome(settings: BudgetSettings): number {
  const today = getLocalDateString();
  return settings.incomeSources.reduce((sum, source) => {
    if (source.hidden) return sum;
    if (incomeEndedBeforeDate(source, today)) return sum;
    const amount = getSourceAmountForDate(source, today);
    const periods = periodsPerYear(source.payFrequency, source.payInterval);
    return sum + (amount * periods) / 12;
  }, 0);
}

function getMonthlySavings(settings: BudgetSettings): number {
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

function getPocketDeductingRecurringPerPeriod(
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

function genFixedEvents(
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

function migrateGoal(g: Record<string, unknown>): SavingsGoal {
  const base =
    'startDate' in g
      ? (g as unknown as SavingsGoal)
      : {
          id: (g.id as string) ?? crypto.randomUUID(),
          name: (g.name as string) ?? '',
          startDate: (g.targetDate as string) ?? getLocalDateString(),
          endDate: (g.targetDate as string) ?? getLocalDateString(),
          lineItems: (g.lineItems as SavingsGoal['lineItems']) ?? [],
          pauseIncome: (g.pauseIncome as boolean) ?? false,
          pausePocket: (g.pausePocket as boolean) ?? false,
          pausedExpenseIds: [] as string[],
        };
  return {
    ...base,
    incomeResumeDate: base.incomeResumeDate,
    pausePocket: base.pausePocket ?? false,
    pausedExpenseIds: base.pausedExpenseIds ?? [],
  };
}

function migrateRecurringExpenses(
  expenses: RecurringExpense[],
): RecurringExpense[] {
  return expenses.map((e) => {
    const base = e.dayOfMonth === 31 ? { ...e, dayOfMonth: 0 } : e;
    const startDate = getRecurringStartDate(base);
    return {
      ...base,
      startDate,
      startMonth: startDate.slice(0, 7),
      prorateFirstMonth: base.prorateFirstMonth ?? false,
      occurrenceOverrides: migrateRecurringExpenseOccurrenceOverrides(
        base.occurrenceOverrides,
      ),
      deductFromPocket: base.deductFromPocket ?? false,
      deductIncomeSourceId: base.deductIncomeSourceId,
    };
  });
}

function migrateRecurringExpenseOccurrenceOverrides(
  raw: unknown,
): RecurringExpenseOccurrenceOverride[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (value): value is Record<string, unknown> =>
        value !== null && typeof value === 'object',
    )
    .map((value): RecurringExpenseOccurrenceOverride | null => {
      const scheduledDate =
        typeof value.scheduledDate === 'string'
          ? value.scheduledDate.slice(0, 10)
          : '';
      if (!isValidIsoDate(scheduledDate)) return null;
      const date =
        typeof value.date === 'string' &&
        isValidIsoDate(value.date.slice(0, 10)) &&
        value.date.slice(0, 10) !== scheduledDate
          ? value.date.slice(0, 10)
          : undefined;
      const amount =
        typeof value.amount === 'number' &&
        Number.isFinite(value.amount) &&
        value.amount >= 0
          ? value.amount
          : undefined;
      if (!date && amount === undefined) return null;
      const note = typeof value.note === 'string' ? value.note : undefined;
      return { scheduledDate, date, amount, note };
    })
    .filter(
      (value): value is RecurringExpenseOccurrenceOverride => value !== null,
    );
}

function migratePaydayIncomeOverrides(
  list: {
    id?: string;
    date: string;
    sourceId: string;
    amount: number;
  }[],
) {
  return list.map((o) => ({
    id: o.id ?? crypto.randomUUID(),
    date: o.date,
    sourceId: o.sourceId,
    amount: o.amount,
  }));
}

function migratePocketAmountOverrides(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is Record<string, unknown> => x !== null && typeof x === 'object',
    )
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : crypto.randomUUID(),
      date: typeof x.date === 'string' ? x.date.slice(0, 10) : '',
      amount:
        typeof x.amount === 'number' && !Number.isNaN(x.amount) ? x.amount : 0,
    }))
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date));
}

function migrateRecurringExpenseSkips(raw: unknown): RecurringExpenseSkip[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is Record<string, unknown> => x !== null && typeof x === 'object',
    )
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : crypto.randomUUID(),
      recurringExpenseId:
        typeof x.recurringExpenseId === 'string' ? x.recurringExpenseId : '',
      date: typeof x.date === 'string' ? x.date.slice(0, 10) : '',
      amount:
        typeof x.amount === 'number' && !Number.isNaN(x.amount) ? x.amount : 0,
      note: typeof x.note === 'string' ? x.note : '',
    }))
    .filter((x) => x.recurringExpenseId && /^\d{4}-\d{2}-\d{2}$/.test(x.date));
}

function applyRecurringExpenseSkips(
  expenses: RecurringExpense[],
  skips: RecurringExpenseSkip[],
): RecurringExpense[] {
  if (skips.length === 0) return expenses;
  return expenses.map((expense) => {
    const matching = skips.filter(
      (skip) => skip.recurringExpenseId === expense.id,
    );
    if (matching.length === 0) return expense;
    let occurrenceOverrides = [...(expense.occurrenceOverrides ?? [])];
    for (const skip of matching) {
      const existing = occurrenceOverrides.find(
        (override) => override.scheduledDate === skip.date,
      );
      occurrenceOverrides = [
        ...occurrenceOverrides.filter(
          (override) => override.scheduledDate !== skip.date,
        ),
        {
          ...existing,
          scheduledDate: skip.date,
          amount: skip.amount,
          note: skip.note,
        },
      ];
    }
    return { ...expense, occurrenceOverrides };
  });
}

function migratePocketPerPeriodChanges(raw: unknown): PocketPerPeriodChange[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is Record<string, unknown> => x !== null && typeof x === 'object',
    )
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : crypto.randomUUID(),
      effectiveDate:
        typeof x.effectiveDate === 'string'
          ? x.effectiveDate.slice(0, 10)
          : getLocalDateString(),
      amount:
        typeof x.amount === 'number' && !Number.isNaN(x.amount) ? x.amount : 0,
    }));
}

function normalizeIncomeSource(s: IncomeSource): IncomeSource {
  const rawEnd =
    typeof s.endsOn === 'string' ? s.endsOn.slice(0, 10) : undefined;
  const endsOn = rawEnd && isValidIsoDate(rawEnd) ? rawEnd : undefined;
  const source = {
    ...s,
    hidden: Boolean(s.hidden),
    endsOn,
    endsOnIgnored: endsOn ? Boolean(s.endsOnIgnored) : false,
  };
  return {
    ...source,
    rateChanges: source.rateChanges.map((change) =>
      change.hourlyRate === undefined
        ? change
        : {
            ...change,
            amount: getHourlyNetAmount(source, change.hourlyRate),
          },
    ),
  };
}

function migrateIncomeSources(raw: Record<string, unknown>): IncomeSource[] {
  const globalFreq =
    (raw.payFrequency as PayFrequency) ??
    (raw.pocketFrequency as PayFrequency) ??
    'weekly';
  const globalPayday =
    (raw.firstPayday as string) ??
    (raw.pocketFirstPayday as string) ??
    getLocalDateString();

  if (Array.isArray(raw.incomeSources) && raw.incomeSources.length > 0) {
    return (raw.incomeSources as IncomeSource[]).map((s) => {
      const merged: IncomeSource =
        'payFrequency' in s && s.payFrequency
          ? (s as IncomeSource)
          : {
              ...(s as IncomeSource),
              payFrequency: globalFreq,
              firstPayday: (s as IncomeSource).firstPayday ?? globalPayday,
              payInterval: (s as IncomeSource).payInterval,
            };
      return normalizeIncomeSource(merged);
    });
  }

  const baseIncome = (raw.incomePerPeriod as number) ?? 0;
  const oldChanges =
    (raw.incomeChanges as {
      id: string;
      effectiveDate: string;
      incomePerPeriod: number;
    }[]) ?? [];

  return [
    normalizeIncomeSource({
      id: crypto.randomUUID(),
      name: 'Income',
      amount: baseIncome,
      payFrequency: globalFreq,
      firstPayday: globalPayday,
      rateChanges: oldChanges.map((c) => ({
        id: c.id ?? crypto.randomUUID(),
        effectiveDate: c.effectiveDate,
        amount: c.incomePerPeriod,
      })),
    }),
  ];
}

function migrateSettings(raw: Record<string, unknown>): BudgetSettings {
  if (raw.goals) {
    const settings = raw as unknown as BudgetSettings & {
      incomePerPeriod?: number;
      incomeChanges?: unknown[];
      payFrequency?: PayFrequency;
      firstPayday?: string;
      recurringPocketSkips?: unknown;
      recurringExpenseSkips?: unknown;
      recurringPocketExpenses?: {
        id: string;
        label: string;
        amount: number;
        everyNPeriods?: number;
      }[];
    };
    const startMonth = (settings.startDate ?? getLocalDateString()).slice(0, 7);
    const legacyPocket = settings.recurringPocketExpenses ?? [];
    const fromLegacyPocket: RecurringExpense[] = legacyPocket.map((p) => ({
      id: p.id,
      label: p.label,
      amount: p.amount,
      dayOfMonth: 1,
      startDate: `${startMonth}-01`,
      startMonth,
      endMonth: null,
      prorateFirstMonth: false,
      deductFromPocket: true,
    }));
    const recurringExpenseSkips = migrateRecurringExpenseSkips(
      settings.recurringExpenseSkips ?? settings.recurringPocketSkips,
    );
    const recurringExpenses = applyRecurringExpenseSkips(
      [
        ...migrateRecurringExpenses(settings.recurringExpenses ?? []),
        ...fromLegacyPocket,
      ],
      recurringExpenseSkips,
    );
    return {
      startingBalance: settings.startingBalance,
      startDate: settings.startDate ?? getLocalDateString(),
      pocketPerPeriod: settings.pocketPerPeriod,
      pocketPerPeriodChanges: migratePocketPerPeriodChanges(
        settings.pocketPerPeriodChanges,
      ),
      pocketFrequency:
        settings.pocketFrequency ?? settings.pocketFrequency ?? 'weekly',
      pocketFirstPayday:
        settings.pocketFirstPayday ??
        settings.firstPayday ??
        getLocalDateString(),
      pocketInterval: settings.pocketInterval,
      pocketIncomeSourceId: settings.pocketIncomeSourceId,
      recurringExpenses,
      recurringExpenseSkips: [],
      goals: (settings.goals as unknown as Record<string, unknown>[]).map(
        migrateGoal,
      ),
      incomeSources: migrateIncomeSources(raw),
      oneTimeIncome: settings.oneTimeIncome ?? [],
      paydayIncomeOverrides: migratePaydayIncomeOverrides(
        settings.paydayIncomeOverrides ?? [],
      ),
      pocketAmountOverrides: migratePocketAmountOverrides(
        settings.pocketAmountOverrides,
      ),
    };
  }

  const old = raw as {
    startingBalance?: number;
    weeklySave?: number;
    weeklyPocket?: number;
  };
  const weeklySave = old.weeklySave ?? 0;
  const weeklyPocket = old.weeklyPocket ?? 0;

  const payday = getLocalDateString();
  return {
    startingBalance: old.startingBalance ?? 0,
    startDate: payday,
    pocketPerPeriod: weeklyPocket,
    pocketPerPeriodChanges: [],
    pocketFrequency: 'weekly',
    pocketFirstPayday: payday,
    pocketIncomeSourceId: undefined,
    incomeSources: [
      {
        id: crypto.randomUUID(),
        name: 'Income',
        amount: weeklySave + weeklyPocket,
        payFrequency: 'weekly',
        firstPayday: payday,
        rateChanges: [],
      },
    ],
    goals: [],
    oneTimeIncome: [],
    recurringExpenses: [],
    recurringExpenseSkips: [],
    paydayIncomeOverrides: [],
    pocketAmountOverrides: [],
  };
}

function parseAndApplyStored(raw: unknown): {
  expenses: Expense[];
  spentPerPeriod: number[];
  settings: BudgetSettings;
  needsStartDatePrompt: boolean;
} {
  if (!raw || typeof raw !== 'object') {
    const pd = getPocketPaydays(DEFAULT_SETTINGS);
    return {
      expenses: [],
      spentPerPeriod: pd.map(() => 0),
      settings: DEFAULT_SETTINGS,
      needsStartDatePrompt: true,
    };
  }
  const data = raw as Record<string, unknown>;
  const expenses = (data.expenses as Expense[]) || [];
  const settings = migrateSettings(
    (data.settings as Record<string, unknown>) || {},
  );
  const pd = getPocketPaydays(
    settings,
    expenses.map((e) => e.date),
  );
  const storedSpent =
    (data.spentPerPeriod as number[]) || (data.spentPerWeek as number[]) || [];
  const spentPerPeriod =
    storedSpent.length === pd.length ? storedSpent : pd.map(() => 0);
  return {
    expenses,
    spentPerPeriod,
    settings,
    needsStartDatePrompt: false,
  };
}

function makeBudgetState(
  expenses: Expense[],
  spentPerPeriod: number[],
  settings: BudgetSettings,
): BudgetState {
  return { expenses, spentPerPeriod, settings };
}

function makeBranch(name: string, state: BudgetState): BudgetBranch {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    state,
    createdAt: now,
    updatedAt: now,
  };
}

function uniqueBranchName(branches: BudgetBranch[], baseName: string): string {
  const names = new Set(branches.map((branch) => branch.name));
  if (!names.has(baseName)) return baseName;
  let n = 2;
  while (names.has(`${baseName} ${n}`)) n++;
  return `${baseName} ${n}`;
}

function withCurrentBranchState(
  branches: BudgetBranch[],
  activeBranchId: string,
  state: BudgetState,
): BudgetBranch[] {
  const now = new Date().toISOString();
  return branches.map((branch) =>
    branch.id === activeBranchId
      ? { ...branch, state, updatedAt: now }
      : branch,
  );
}

function parseStoredWorkspace(raw: unknown): {
  branches: BudgetBranch[];
  activeBranchId: string;
  activeState: BudgetState;
  needsStartDatePrompt: boolean;
} {
  if (
    raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as Partial<BudgetWorkspace>).branches)
  ) {
    const workspace = raw as Partial<BudgetWorkspace>;
    const branches = (workspace.branches ?? [])
      .map((branch, index) => {
        if (!branch || typeof branch !== 'object') return null;
        const parsed = parseAndApplyStored(
          (branch as Partial<BudgetBranch>).state,
        );
        const now = new Date().toISOString();
        return {
          id:
            typeof (branch as Partial<BudgetBranch>).id === 'string'
              ? (branch as BudgetBranch).id
              : crypto.randomUUID(),
          name:
            typeof (branch as Partial<BudgetBranch>).name === 'string' &&
            (branch as BudgetBranch).name.trim()
              ? (branch as BudgetBranch).name.trim()
              : `Branch ${index + 1}`,
          state: makeBudgetState(
            parsed.expenses,
            parsed.spentPerPeriod,
            parsed.settings,
          ),
          createdAt:
            typeof (branch as Partial<BudgetBranch>).createdAt === 'string'
              ? (branch as BudgetBranch).createdAt
              : now,
          updatedAt:
            typeof (branch as Partial<BudgetBranch>).updatedAt === 'string'
              ? (branch as BudgetBranch).updatedAt
              : now,
        };
      })
      .filter((branch): branch is BudgetBranch => branch !== null);

    if (branches.length > 0) {
      const activeBranchId = branches.some(
        (branch) => branch.id === workspace.activeBranchId,
      )
        ? (workspace.activeBranchId as string)
        : branches[0].id;
      const activeBranch = branches.find(
        (branch) => branch.id === activeBranchId,
      ) as BudgetBranch;
      return {
        branches,
        activeBranchId,
        activeState: activeBranch.state,
        needsStartDatePrompt: false,
      };
    }
  }

  const parsed = parseAndApplyStored(raw);
  const activeState = makeBudgetState(
    parsed.expenses,
    parsed.spentPerPeriod,
    parsed.settings,
  );
  const branch = makeBranch(DEFAULT_BRANCH_NAME, activeState);
  return {
    branches: [branch],
    activeBranchId: branch.id,
    activeState,
    needsStartDatePrompt: parsed.needsStartDatePrompt,
  };
}

function getSavingsStartOffset(
  settings: BudgetSettings,
  expenseDates: readonly string[],
): number {
  const paydays = getPocketPaydays(settings, expenseDates);
  const firstPeriodPayday = paydays[0];
  return firstPeriodPayday && firstPeriodPayday <= settings.startDate
    ? getPocketAmountForPayday(settings, firstPeriodPayday)
    : 0;
}

export function useBudget() {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const [isLoaded, setIsLoaded] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [spentPerPeriod, setSpentPerPeriod] = useState<number[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>(DEFAULT_SETTINGS);
  const [branches, setBranches] = useState<BudgetBranch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState('');
  const [needsStartDatePrompt, setNeedsStartDatePrompt] = useState(false);
  const [isMutating, startMutation] = useTransition();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isSessionPending) return;

    async function load() {
      if (session) {
        const res = await fetch('/api/budget');
        if (res.ok) {
          const body = await res.json();
          if (body) {
            const parsed = parseStoredWorkspace(body);
            setBranches(parsed.branches);
            setActiveBranchId(parsed.activeBranchId);
            setExpenses(parsed.activeState.expenses);
            setSpentPerPeriod(parsed.activeState.spentPerPeriod);
            setSettings(parsed.activeState.settings);
            setNeedsStartDatePrompt(parsed.needsStartDatePrompt);
            setIsLoaded(true);
            return;
          }
        }
        try {
          const stored = localStorage.getItem(BUDGET_STORAGE_KEY);
          if (stored) {
            const localData = JSON.parse(stored) as BudgetState;
            await fetch('/api/budget', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(localData),
            });
            const parsed = parseStoredWorkspace(localData);
            setBranches(parsed.branches);
            setActiveBranchId(parsed.activeBranchId);
            setExpenses(parsed.activeState.expenses);
            setSpentPerPeriod(parsed.activeState.spentPerPeriod);
            setSettings(parsed.activeState.settings);
            setNeedsStartDatePrompt(parsed.needsStartDatePrompt);
          } else {
            setNeedsStartDatePrompt(true);
            const pd = getPocketPaydays(DEFAULT_SETTINGS);
            const activeState = makeBudgetState(
              [],
              pd.map(() => 0),
              DEFAULT_SETTINGS,
            );
            const branch = makeBranch(DEFAULT_BRANCH_NAME, activeState);
            setBranches([branch]);
            setActiveBranchId(branch.id);
            setSpentPerPeriod(pd.map(() => 0));
          }
        } catch {
          setNeedsStartDatePrompt(true);
          const pd = getPocketPaydays(DEFAULT_SETTINGS);
          const activeState = makeBudgetState(
            [],
            pd.map(() => 0),
            DEFAULT_SETTINGS,
          );
          const branch = makeBranch(DEFAULT_BRANCH_NAME, activeState);
          setBranches([branch]);
          setActiveBranchId(branch.id);
          setSpentPerPeriod(pd.map(() => 0));
        }
      } else {
        try {
          const stored = localStorage.getItem(BUDGET_STORAGE_KEY);
          if (stored) {
            const parsed = parseStoredWorkspace(JSON.parse(stored));
            setBranches(parsed.branches);
            setActiveBranchId(parsed.activeBranchId);
            setExpenses(parsed.activeState.expenses);
            setSpentPerPeriod(parsed.activeState.spentPerPeriod);
            setSettings(parsed.activeState.settings);
            setNeedsStartDatePrompt(parsed.needsStartDatePrompt);
          } else {
            setNeedsStartDatePrompt(true);
            const pd = getPocketPaydays(DEFAULT_SETTINGS);
            const activeState = makeBudgetState(
              [],
              pd.map(() => 0),
              DEFAULT_SETTINGS,
            );
            const branch = makeBranch(DEFAULT_BRANCH_NAME, activeState);
            setBranches([branch]);
            setActiveBranchId(branch.id);
            setSpentPerPeriod(pd.map(() => 0));
          }
        } catch {
          const pd = getPocketPaydays(DEFAULT_SETTINGS);
          const activeState = makeBudgetState(
            [],
            pd.map(() => 0),
            DEFAULT_SETTINGS,
          );
          const branch = makeBranch(DEFAULT_BRANCH_NAME, activeState);
          setBranches([branch]);
          setActiveBranchId(branch.id);
          setSpentPerPeriod(pd.map(() => 0));
          setNeedsStartDatePrompt(false);
        }
      }
      setIsLoaded(true);
    }

    load();
  }, [session, isSessionPending]);

  useEffect(() => {
    if (!isLoaded || isSessionPending) return;
    const activeState = makeBudgetState(expenses, spentPerPeriod, settings);
    const workspaceBranches =
      branches.length > 0 && activeBranchId
        ? withCurrentBranchState(branches, activeBranchId, activeState)
        : [makeBranch(DEFAULT_BRANCH_NAME, activeState)];
    const workspace: BudgetWorkspace = {
      activeBranchId: activeBranchId || workspaceBranches[0].id,
      branches: workspaceBranches,
    };
    if (session) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        fetch('/api/budget', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workspace),
        });
        saveTimeoutRef.current = null;
      }, 500);
    } else {
      try {
        localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(workspace));
      } catch {}
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    expenses,
    spentPerPeriod,
    settings,
    branches,
    activeBranchId,
    isLoaded,
    isSessionPending,
    session,
  ]);

  const currentIncome = useMemo(() => {
    const today = getLocalDateString();
    return getIncomeForDate(settings, today);
  }, [settings]);

  const monthlyIncome = useMemo(() => getMonthlyIncome(settings), [settings]);

  const monthlySavings = useMemo(() => getMonthlySavings(settings), [settings]);

  const effectivePocketPerPeriod = useMemo(() => {
    const today = getLocalDateString();
    return getPocketPerPeriodForDate(settings, today);
  }, [settings]);

  const savedPerPeriod = currentIncome - effectivePocketPerPeriod;

  const pocketSchedule = useMemo(() => {
    const source =
      settings.pocketIncomeSourceId &&
      settings.incomeSources.find(
        (s) => s.id === settings.pocketIncomeSourceId,
      );
    return {
      frequency: source ? source.payFrequency : settings.pocketFrequency,
      interval: source ? source.payInterval : settings.pocketInterval,
    };
  }, [
    settings.pocketIncomeSourceId,
    settings.incomeSources,
    settings.pocketFrequency,
    settings.pocketInterval,
  ]);

  const expenseDates = useMemo(() => expenses.map((e) => e.date), [expenses]);

  const paydays = useMemo(
    () => getPocketPaydays(settings, expenseDates),
    [settings, expenseDates],
  );

  const pocketPeriodBounds = useMemo(
    () =>
      paydays.map((p, i) =>
        getPocketPeriodBounds(
          p,
          paydays[i + 1],
          pocketSchedule.frequency,
          pocketSchedule.interval,
        ),
      ),
    [paydays, pocketSchedule.frequency, pocketSchedule.interval],
  );

  useEffect(() => {
    if (!settings.pocketIncomeSourceId) return;
    const src = settings.incomeSources.find(
      (s) => s.id === settings.pocketIncomeSourceId,
    );
    if (!src || src.hidden) {
      setSettings((prev) => ({ ...prev, pocketIncomeSourceId: undefined }));
    }
  }, [settings.pocketIncomeSourceId, settings.incomeSources]);

  useEffect(() => {
    const ids = new Set(settings.incomeSources.map((s) => s.id));
    if (
      !settings.recurringExpenses.some(
        (r) => r.deductIncomeSourceId && !ids.has(r.deductIncomeSourceId),
      )
    ) {
      return;
    }
    setSettings((prev) => ({
      ...prev,
      recurringExpenses: prev.recurringExpenses.map((r) =>
        r.deductIncomeSourceId && !ids.has(r.deductIncomeSourceId)
          ? { ...r, deductIncomeSourceId: undefined }
          : r,
      ),
    }));
  }, [settings.incomeSources, settings.recurringExpenses]);

  useEffect(() => {
    if (!isLoaded) return;
    if (spentPerPeriod.length !== paydays.length) {
      setSpentPerPeriod(paydays.map(() => 0));
    }
  }, [paydays.length, isLoaded, spentPerPeriod.length, paydays]);

  const fixedEvents = useMemo(
    () => genFixedEvents(settings, expenseDates),
    [settings, expenseDates],
  );

  const monthlyNetSavings = useMemo(() => {
    const startD = new Date(`${settings.startDate}T00:00:00`);
    const startYear = startD.getFullYear();
    const startMonth = startD.getMonth();
    const endYear = startYear + 4;
    const monthsInRange = (endYear - startYear) * 12 + (12 - startMonth);
    if (monthsInRange <= 0) return 0;

    const lastDate = `${endYear}-12-31`;
    let total = 0;
    for (const ev of fixedEvents) {
      if (ev.type === 'pocket') continue;
      if (ev.date <= settings.startDate) continue;
      if (ev.date > lastDate) continue;
      total += ev.delta;
    }
    return total / monthsInRange;
  }, [fixedEvents, settings.startDate]);

  const expensesPerPeriod = useMemo(() => {
    const totals: number[] = pocketPeriodBounds.map(() => 0);
    const counts: number[] = pocketPeriodBounds.map(() => 0);

    for (const expense of expenses) {
      const idx = getPeriodIndexWithBounds(expense.date, pocketPeriodBounds);
      if (idx !== null) {
        totals[idx] += expense.amount;
        counts[idx]++;
      }
    }

    return { totals, counts };
  }, [expenses, pocketPeriodBounds]);

  const pocketDeductingRecurringPerPeriod = useMemo(
    () =>
      getPocketDeductingRecurringPerPeriod(
        settings,
        paydays,
        pocketPeriodBounds,
      ),
    [settings, paydays, pocketPeriodBounds],
  );

  const savingsTimeline = useMemo((): SavingsPoint[] => {
    const overflowEvents: FixedEvent[] = [];
    let pocketBal = 0;

    for (let i = 0; i < pocketPeriodBounds.length; i++) {
      const periodPayday = paydays[i] ?? pocketPeriodBounds[i].start;
      pocketBal += getPocketAmountForPayday(settings, periodPayday);
      const range = pocketPeriodBounds[i];

      const periodExpenses = expenses
        .filter((e) => dateInPeriod(e.date, range.start, range.end))
        .sort((a, b) => a.date.localeCompare(b.date));

      const recurringItems = pocketDeductingRecurringPerPeriod.items[i] ?? [];
      for (const it of recurringItems) {
        const covered = Math.min(it.amount, pocketBal);
        const overflow = it.amount - covered;
        pocketBal -= covered;
        if (overflow > 0 || it.amount <= 0) {
          overflowEvents.push({
            date: it.date ?? range.end,
            label: it.label,
            delta: -overflow,
            type: 'recurring',
            recurringExpenseId: it.recurringExpenseId,
          });
        }
      }

      if (periodExpenses.length > 0) {
        for (const exp of periodExpenses) {
          const covered = Math.min(exp.amount, pocketBal);
          const overflow = exp.amount - covered;
          pocketBal -= covered;
          if (overflow > 0) {
            overflowEvents.push({
              date: exp.date,
              label: exp.label,
              delta: -overflow,
              type: 'user-expense',
            });
          }
        }
      } else {
        const manualSpent = spentPerPeriod[i] || 0;
        pocketBal = Math.max(0, pocketBal - manualSpent);
      }
    }

    for (const exp of expenses) {
      if (getPeriodIndexWithBounds(exp.date, pocketPeriodBounds) === null) {
        overflowEvents.push({
          date: exp.date,
          label: exp.label,
          delta: -exp.amount,
          type: 'user-expense',
        });
      }
    }

    const events: FixedEvent[] = [...fixedEvents, ...overflowEvents];
    events.sort(
      (a, b) => a.date.localeCompare(b.date) || (a.delta > 0 ? -1 : 1),
    );

    const startD = new Date(`${settings.startDate}T00:00:00`);
    const startLabel = startD.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const firstPeriodPayday = paydays[0];
    const preStartPocket =
      firstPeriodPayday && firstPeriodPayday <= settings.startDate
        ? getPocketAmountForPayday(settings, firstPeriodPayday)
        : 0;
    const effectiveStartBalance = settings.startingBalance - preStartPocket;

    const points: SavingsPoint[] = [
      {
        date: startLabel,
        rawDate: settings.startDate,
        balance: effectiveStartBalance,
        label: 'start',
        type: 'start',
        events: [],
      },
    ];
    let running = effectiveStartBalance;
    const grouped: Record<string, FixedEvent[]> = {};

    for (const e of events) {
      if (e.date <= settings.startDate) continue;
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    }

    for (const date of Object.keys(grouped).sort()) {
      const evs = grouped[date];
      for (const e of evs.filter((x) => x.delta > 0)) running += e.delta;
      for (const e of evs.filter((x) => x.delta < 0)) running += e.delta;

      const paydays = evs.filter((e) => e.type === 'payday');
      const others = evs.filter(
        (e) => e.type !== 'pocket' && e.type !== 'payday',
      );
      const pocketOnThisDate = evs
        .filter((e) => e.type === 'pocket')
        .reduce((s, e) => s + Math.abs(e.delta), 0);

      const displayPaydays: FixedEvent[] = [];
      if (paydays.length > 0 && pocketOnThisDate > 0) {
        const sorted = [...paydays].sort((a, b) => b.delta - a.delta);
        const allocation = new Map<FixedEvent, number>();
        let remaining = pocketOnThisDate;

        for (const p of sorted) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, p.delta);
          allocation.set(p, take);
          remaining -= take;
        }

        for (const p of paydays) {
          const taken = allocation.get(p) || 0;
          const net = p.delta - taken;
          displayPaydays.push({
            ...p,
            delta: net,
            label: p.label.replace(/\$\d+(\.\d+)?/, `$${net.toFixed(2)}`),
          });
        }
      } else {
        displayPaydays.push(...paydays);
      }

      const visible = [...displayPaydays, ...others];
      if (visible.length === 0) continue;

      const hasPayday = displayPaydays.length > 0;
      const hasRecurring = others.some((e) => e.type === 'recurring');
      const hasGoal = others.some((e) => e.type === 'goal');
      const hasUser = others.some((e) => e.type === 'user-expense');
      const hasOneTime = others.some((e) => e.type === 'one-time');

      let type: FixedEvent['type'] = 'payday';
      if (hasGoal && !hasPayday) type = 'goal';
      else if (hasGoal && hasPayday) type = 'payday-recurring';
      else if ((hasRecurring || hasUser) && !hasPayday)
        type = hasRecurring ? 'recurring' : 'user-expense';
      else if (hasPayday && (hasRecurring || hasUser))
        type = 'payday-recurring';
      else if (
        hasOneTime &&
        !hasPayday &&
        !hasRecurring &&
        !hasGoal &&
        !hasUser
      )
        type = 'one-time';
      else if (hasRecurring) type = 'recurring';

      const d = new Date(`${date}T00:00:00`);
      const fmt = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      points.push({
        date: fmt,
        rawDate: date,
        balance: running,
        label: visible.map((e) => e.label).join(' + '),
        type,
        events: visible.map((e) => ({
          label: e.label,
          delta: e.delta,
          type: e.type,
          sourceId: e.sourceId,
          recurringExpenseId: e.recurringExpenseId,
          recurringOccurrenceDate: e.recurringOccurrenceDate,
        })),
      });
    }
    return points;
  }, [
    fixedEvents,
    expenses,
    pocketDeductingRecurringPerPeriod,
    pocketPeriodBounds,
    paydays,
    settings,
    spentPerPeriod,
  ]);

  const pocketTimeline = useMemo((): PocketPoint[] => {
    let balance = 0;
    return paydays.map((payday, i) => {
      const scheduledPocket = getPocketPerPeriodForDate(settings, payday);
      const periodPocket = getPocketAmountForPayday(settings, payday);
      const range = getPocketPeriodRange(
        payday,
        paydays[i + 1],
        pocketSchedule.frequency,
        pocketSchedule.interval,
      );
      const expenseTotal = expensesPerPeriod.totals[i] || 0;
      const expenseCount = expensesPerPeriod.counts[i] || 0;
      const recurringTotal = pocketDeductingRecurringPerPeriod.totals[i] || 0;
      const recurringItems = pocketDeductingRecurringPerPeriod.items[i] || [];

      const periodExpenses = expenses.filter((e) =>
        dateInPeriod(e.date, range.start, range.end),
      );

      const baseSpent =
        expenseCount > 0 ? expenseTotal : spentPerPeriod[i] || 0;
      const spent = baseSpent + recurringTotal;
      const avail = balance + periodPocket;
      const finalSpent = Math.min(spent, avail);
      balance = avail - finalSpent;

      const type =
        finalSpent < periodPocket
          ? 'surplus'
          : finalSpent > periodPocket
            ? 'over'
            : 'flat';

      const expenseItems =
        periodExpenses.length > 0 || recurringItems.length > 0
          ? [
              ...periodExpenses.map((e) => ({
                label: e.label,
                amount: e.amount,
              })),
              ...recurringItems,
            ]
          : spent > 0
            ? [{ label: 'Spent', amount: spent }]
            : [];

      return {
        date: range.label,
        rawDate: payday,
        weekStart: range.start,
        weekEnd: range.end,
        balance,
        available: avail,
        spent: finalSpent,
        overage: Math.max(0, spent - avail),
        type,
        idx: i,
        expenseCount,
        pocketAllocated: periodPocket,
        scheduledPocket,
        expenseItems,
      };
    });
  }, [
    paydays,
    expenses,
    spentPerPeriod,
    settings,
    pocketSchedule.frequency,
    pocketSchedule.interval,
    expensesPerPeriod,
    pocketDeductingRecurringPerPeriod,
  ]);

  const currentPocketBalance = useMemo(() => {
    const today = getLocalDateString();
    const periodIdx = getPeriodIndexWithBounds(today, pocketPeriodBounds);
    if (periodIdx === null) return 0;
    const prevBalance =
      periodIdx === 0 ? 0 : (pocketTimeline[periodIdx - 1]?.balance ?? 0);
    const range = pocketPeriodBounds[periodIdx];
    const periodPayday = paydays[periodIdx] ?? range.start;
    let pocketBal =
      prevBalance + getPocketAmountForPayday(settings, periodPayday);
    const recurringItems =
      pocketDeductingRecurringPerPeriod.items[periodIdx] ?? [];
    for (const it of recurringItems) {
      if (it.date && it.date > today) continue;
      const covered = Math.min(it.amount, pocketBal);
      pocketBal -= covered;
    }
    const periodExpenses = expenses
      .filter(
        (e) => dateInPeriod(e.date, range.start, range.end) && e.date <= today,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    if (periodExpenses.length > 0) {
      for (const exp of periodExpenses) {
        const covered = Math.min(exp.amount, pocketBal);
        pocketBal -= covered;
      }
    } else {
      const manualSpent = spentPerPeriod[periodIdx] ?? 0;
      pocketBal = Math.max(0, pocketBal - manualSpent);
    }
    return Math.max(0, pocketBal);
  }, [
    pocketTimeline,
    pocketPeriodBounds,
    expenses,
    spentPerPeriod,
    pocketDeductingRecurringPerPeriod,
    paydays,
    settings,
  ]);

  const goalStats = useMemo((): GoalStat[] => {
    return settings.goals.map((goal) => {
      const total = goal.lineItems.reduce((s, item) => s + item.amount, 0);
      if (goal.hidden) {
        return {
          goalId: goal.id,
          totalCost: total,
          preBalance: 0,
          postBalance: 0,
          isFeasible: true,
          isWarning: false,
        };
      }
      const prePt = [...savingsTimeline]
        .filter((p) => p.rawDate < goal.startDate)
        .pop();
      const goalPt = savingsTimeline.find((p) => p.rawDate === goal.startDate);
      const preBalance = prePt ? prePt.balance : settings.startingBalance;
      const postBalance = goalPt ? goalPt.balance : preBalance - total;

      return {
        goalId: goal.id,
        totalCost: total,
        preBalance,
        postBalance,
        isFeasible: postBalance >= 0,
        isWarning: postBalance >= 0 && postBalance < 500,
      };
    });
  }, [settings.goals, savingsTimeline, settings.startingBalance]);

  const stats = useMemo(() => {
    const last = savingsTimeline[savingsTimeline.length - 1];
    return {
      eoy: last ? last.balance : settings.startingBalance,
    };
  }, [savingsTimeline, settings.startingBalance]);

  const validation = useMemo(() => {
    const errors: { field: string; message: string }[] = [];

    const negPt = savingsTimeline.find((p) => p.balance < 0);
    if (negPt) {
      errors.push({
        field: 'balance',
        message: `Balance goes negative ($${negPt.balance.toLocaleString()}) on ${negPt.date}. You're spending more than you've saved.`,
      });
    }

    for (const goal of settings.goals) {
      if (goal.hidden) continue;
      const stat = goalStats.find((s) => s.goalId === goal.id);
      if (stat && !stat.isFeasible) {
        errors.push({
          field: 'goal',
          message: `You'd be $${Math.abs(stat.postBalance).toLocaleString()} short for ${goal.name}.`,
        });
      } else if (stat?.isWarning) {
        errors.push({
          field: 'goal',
          message: `Cutting it close for ${goal.name}. Only $${stat.postBalance.toLocaleString()} left after.`,
        });
      }
    }

    const pocketPeriods = periodsPerYear(
      pocketSchedule.frequency,
      pocketSchedule.interval,
    );
    const today = getLocalDateString();
    const pocketNow = getPocketPerPeriodForDate(settings, today);
    const monthlyPocket =
      pocketPeriods > 0 ? (pocketNow * pocketPeriods) / 12 : 0;
    if (monthlyPocket > 0 && monthlyPocket > monthlyIncome) {
      errors.push({
        field: 'pocket',
        message: `Your pocket exceeds your income. Reduce your pocket/period or increase income.`,
      });
    }

    return {
      errors,
      hasError: errors.length > 0,
      isCritical:
        !!negPt ||
        goalStats.some((s) => !s.isFeasible) ||
        monthlyPocket > monthlyIncome,
    };
  }, [
    settings.goals,
    goalStats,
    savingsTimeline,
    settings,
    pocketSchedule.frequency,
    pocketSchedule.interval,
    monthlyIncome,
  ]);

  const addExpense = useCallback(
    (date: string, label: string, amount: number) => {
      if (!date || !label || Number.isNaN(amount) || amount <= 0) return false;
      const periodIdx = getPeriodIndexWithBounds(date, pocketPeriodBounds);
      setExpenses((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          date,
          label,
          amount,
          weekIdx: periodIdx ?? undefined,
        },
      ]);
      return true;
    },
    [pocketPeriodBounds],
  );

  const removeExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateExpense = useCallback(
    (expense: Expense) => {
      if (
        !expense.date ||
        !expense.label?.trim() ||
        Number.isNaN(expense.amount) ||
        expense.amount <= 0
      ) {
        return;
      }
      const periodIdx = getPeriodIndexWithBounds(
        expense.date,
        pocketPeriodBounds,
      );
      const trimmed = expense.label.trim();
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === expense.id
            ? {
                ...e,
                date: expense.date,
                label: trimmed,
                amount: expense.amount,
                weekIdx: periodIdx ?? undefined,
              }
            : e,
        ),
      );
    },
    [pocketPeriodBounds],
  );

  const updateSettings = useCallback((patch: Partial<BudgetSettings>) => {
    startMutation(() => {
      setSettings((prev) => ({ ...prev, ...patch }));
    });
  }, []);

  const addGoal = useCallback((goal: SavingsGoal) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        goals: [...prev.goals, goal],
      }));
    });
  }, []);

  const updateGoal = useCallback((goal: SavingsGoal) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        goals: prev.goals.map((g) => (g.id === goal.id ? goal : g)),
      }));
    });
  }, []);

  const removeGoal = useCallback((id: string) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        goals: prev.goals.filter((g) => g.id !== id),
      }));
    });
  }, []);

  const toggleGoalHidden = useCallback((id: string) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        goals: prev.goals.map((g) =>
          g.id === id ? { ...g, hidden: !g.hidden } : g,
        ),
      }));
    });
  }, []);

  const addRecurringExpense = useCallback(
    (expense: Omit<RecurringExpense, 'id'>) => {
      startMutation(() => {
        const startDate = getRecurringStartDate({ ...expense, id: '' });
        setSettings((prev) => ({
          ...prev,
          recurringExpenses: [
            ...prev.recurringExpenses,
            {
              ...expense,
              id: crypto.randomUUID(),
              startDate,
              startMonth: startDate.slice(0, 7),
              prorateFirstMonth: expense.prorateFirstMonth ?? false,
            },
          ],
        }));
      });
    },
    [],
  );

  const updateRecurringExpense = useCallback((expense: RecurringExpense) => {
    startMutation(() => {
      const startDate = getRecurringStartDate(expense);
      setSettings((prev) => ({
        ...prev,
        recurringExpenses: prev.recurringExpenses.map((e) =>
          e.id === expense.id
            ? {
                ...expense,
                startDate,
                startMonth: startDate.slice(0, 7),
                prorateFirstMonth: expense.prorateFirstMonth ?? false,
              }
            : e,
        ),
      }));
    });
  }, []);

  const removeRecurringExpense = useCallback((id: string) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        recurringExpenses: prev.recurringExpenses.filter((e) => e.id !== id),
        recurringExpenseSkips: (prev.recurringExpenseSkips ?? []).filter(
          (s) => s.recurringExpenseId !== id,
        ),
      }));
    });
  }, []);

  const toggleRecurringExpenseHidden = useCallback((id: string) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        recurringExpenses: prev.recurringExpenses.map((e) =>
          e.id === id ? { ...e, hidden: !e.hidden } : e,
        ),
      }));
    });
  }, []);

  const addRecurringExpenseSkip = useCallback(
    (
      recurringExpenseId: string,
      date: string,
      note: string,
      amount = 0,
    ): { success: boolean; error?: string } => {
      if (
        !settings.recurringExpenses.some(
          (expense) => expense.id === recurringExpenseId,
        )
      ) {
        return { success: false, error: 'Could not adjust recurring expense.' };
      }
      startMutation(() => {
        setSettings((prev) => {
          const recurringExpenses = prev.recurringExpenses.map((expense) => {
            if (expense.id !== recurringExpenseId) return expense;
            const existing = expense.occurrenceOverrides ?? [];
            const current = existing.find(
              (override) => override.scheduledDate === date,
            );
            return {
              ...expense,
              occurrenceOverrides: [
                ...existing.filter(
                  (override) => override.scheduledDate !== date,
                ),
                {
                  ...current,
                  scheduledDate: date,
                  amount,
                  note: note.trim(),
                },
              ],
            };
          });
          return { ...prev, recurringExpenses };
        });
      });
      return { success: true };
    },
    [settings.recurringExpenses],
  );

  const removeRecurringExpenseSkip = useCallback(
    (recurringExpenseId: string, date: string) => {
      startMutation(() => {
        setSettings((prev) => ({
          ...prev,
          recurringExpenses: prev.recurringExpenses.map((expense) => {
            if (expense.id !== recurringExpenseId) return expense;
            return {
              ...expense,
              occurrenceOverrides: (expense.occurrenceOverrides ?? []).flatMap(
                (override) => {
                  if (override.scheduledDate !== date) return [override];
                  return override.date
                    ? [
                        {
                          scheduledDate: override.scheduledDate,
                          date: override.date,
                        },
                      ]
                    : [];
                },
              ),
            };
          }),
        }));
      });
    },
    [],
  );

  const getPaydayEditRowsForDateCallback = useCallback(
    (date: string) => getPaydayEditRowsForDate(settings, date),
    [settings],
  );

  const applyPaydayIncomeAmounts = useCallback(
    (date: string, amounts: { sourceId: string; amount: number }[]) => {
      startMutation(() => {
        setSettings((prev) => {
          const paydayIncomeOverrides = [...prev.paydayIncomeOverrides];
          for (const { sourceId, amount } of amounts) {
            const source = prev.incomeSources.find((s) => s.id === sourceId);
            if (!source) continue;
            const base = getSourceAmountForDate(source, date);
            const idx = paydayIncomeOverrides.findIndex(
              (o) => o.date === date && o.sourceId === sourceId,
            );
            const nextAmount = amount;
            if (Math.abs(nextAmount - base) < 0.005) {
              if (idx >= 0) paydayIncomeOverrides.splice(idx, 1);
            } else if (idx >= 0) {
              paydayIncomeOverrides[idx] = {
                ...paydayIncomeOverrides[idx],
                amount: nextAmount,
              };
            } else {
              paydayIncomeOverrides.push({
                id: crypto.randomUUID(),
                date,
                sourceId,
                amount: nextAmount,
              });
            }
          }
          return { ...prev, paydayIncomeOverrides };
        });
      });
    },
    [],
  );

  const applyPocketAmountForPayday = useCallback(
    (date: string, amount: number): { success: boolean; error?: string } => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { success: false, error: 'Invalid pocket period' };
      }
      const nextAmount = Math.max(0, amount);
      startMutation(() => {
        setSettings((prev) => {
          const overrides = [...prev.pocketAmountOverrides];
          const base = getPocketPerPeriodForDate(prev, date);
          const idx = overrides.findIndex((o) => o.date === date);
          if (Math.abs(nextAmount - base) < 0.005) {
            if (idx >= 0) overrides.splice(idx, 1);
          } else if (idx >= 0) {
            overrides[idx] = { ...overrides[idx], amount: nextAmount };
          } else {
            overrides.push({
              id: crypto.randomUUID(),
              date,
              amount: nextAmount,
            });
          }
          return { ...prev, pocketAmountOverrides: overrides };
        });
      });
      return { success: true };
    },
    [],
  );

  const resetPocketAmountForPayday = useCallback((date: string) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        pocketAmountOverrides: prev.pocketAmountOverrides.filter(
          (o) => o.date !== date,
        ),
      }));
    });
  }, []);

  const addIncomeSource = useCallback((source: Omit<IncomeSource, 'id'>) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        incomeSources: [
          ...prev.incomeSources,
          normalizeIncomeSource({
            ...source,
            id: crypto.randomUUID(),
          } as IncomeSource),
        ],
      }));
    });
  }, []);

  const updateIncomeSource = useCallback((source: IncomeSource) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        incomeSources: prev.incomeSources.map((s) =>
          s.id === source.id ? normalizeIncomeSource(source) : s,
        ),
      }));
    });
  }, []);

  const removeIncomeSource = useCallback((id: string) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        incomeSources: prev.incomeSources.filter((s) => s.id !== id),
      }));
    });
  }, []);

  const switchBranch = useCallback(
    (id: string) => {
      if (id === activeBranchId) return;
      const target = branches.find((branch) => branch.id === id);
      if (!target) return;
      startMutation(() => {
        const currentState = makeBudgetState(
          expenses,
          spentPerPeriod,
          settings,
        );
        setBranches((prev) =>
          withCurrentBranchState(prev, activeBranchId, currentState),
        );
        setActiveBranchId(target.id);
        setExpenses(target.state.expenses);
        setSpentPerPeriod(target.state.spentPerPeriod);
        setSettings(target.state.settings);
        setNeedsStartDatePrompt(false);
      });
    },
    [activeBranchId, branches, expenses, settings, spentPerPeriod],
  );

  const createBranch = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      startMutation(() => {
        const currentState = makeBudgetState(
          expenses,
          spentPerPeriod,
          settings,
        );
        const branch = makeBranch(trimmed, currentState);
        setBranches((prev) => [
          ...withCurrentBranchState(prev, activeBranchId, currentState),
          branch,
        ]);
        setActiveBranchId(branch.id);
      });
    },
    [activeBranchId, expenses, settings, spentPerPeriod],
  );

  const branchFromSavingsPoint = useCallback(
    (rawDate: string, savingsBalance: number) => {
      if (!rawDate) return;
      startMutation(() => {
        const futureExpenses = expenses.filter(
          (expense) => expense.date > rawDate,
        );
        const branchSettingsBase: BudgetSettings = {
          ...settings,
          startDate: rawDate,
          pocketFirstPayday: settings.pocketIncomeSourceId
            ? settings.pocketFirstPayday
            : rawDate,
        };
        const startOffset = getSavingsStartOffset(
          branchSettingsBase,
          futureExpenses.map((expense) => expense.date),
        );
        const branchSettings: BudgetSettings = {
          ...branchSettingsBase,
          startingBalance: savingsBalance + startOffset,
        };
        const nextPaydays = getPocketPaydays(
          branchSettings,
          futureExpenses.map((expense) => expense.date),
        );
        const nextState = makeBudgetState(
          futureExpenses,
          nextPaydays.map(() => 0),
          branchSettings,
        );
        const currentState = makeBudgetState(
          expenses,
          spentPerPeriod,
          settings,
        );
        const branchName = uniqueBranchName(branches, `From ${rawDate}`);
        const branch = makeBranch(branchName, nextState);
        setBranches((prev) => [
          ...withCurrentBranchState(prev, activeBranchId, currentState),
          branch,
        ]);
        setActiveBranchId(branch.id);
        setExpenses(nextState.expenses);
        setSpentPerPeriod(nextState.spentPerPeriod);
        setSettings(nextState.settings);
        setNeedsStartDatePrompt(false);
      });
    },
    [activeBranchId, branches, expenses, settings, spentPerPeriod],
  );

  const renameBranch = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    startMutation(() => {
      setBranches((prev) =>
        prev.map((branch) =>
          branch.id === id
            ? { ...branch, name: trimmed, updatedAt: new Date().toISOString() }
            : branch,
        ),
      );
    });
  }, []);

  const deleteBranch = useCallback(
    (id: string) => {
      if (branches.length <= 1) return;
      const nextBranch = branches.find((branch) => branch.id !== id);
      if (!nextBranch) return;
      startMutation(() => {
        const currentState = makeBudgetState(
          expenses,
          spentPerPeriod,
          settings,
        );
        setBranches((prev) =>
          withCurrentBranchState(prev, activeBranchId, currentState).filter(
            (branch) => branch.id !== id,
          ),
        );
        if (id === activeBranchId) {
          setActiveBranchId(nextBranch.id);
          setExpenses(nextBranch.state.expenses);
          setSpentPerPeriod(nextBranch.state.spentPerPeriod);
          setSettings(nextBranch.state.settings);
          setNeedsStartDatePrompt(false);
        }
      });
    },
    [activeBranchId, branches, expenses, settings, spentPerPeriod],
  );

  const importState = useCallback(
    (state: BudgetState) => {
      startMutation(() => {
        const nextState = makeBudgetState(
          state.expenses,
          state.spentPerPeriod,
          migrateSettings(state.settings as unknown as Record<string, unknown>),
        );
        setExpenses(state.expenses);
        setSpentPerPeriod(state.spentPerPeriod);
        setSettings(nextState.settings);
        if (activeBranchId) {
          setBranches((prev) =>
            withCurrentBranchState(prev, activeBranchId, nextState),
          );
        } else {
          const branch = makeBranch(DEFAULT_BRANCH_NAME, nextState);
          setActiveBranchId(branch.id);
          setBranches([branch]);
        }
      });
    },
    [activeBranchId],
  );

  const addOneTimeIncome = useCallback((item: Omit<OneTimeIncome, 'id'>) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        oneTimeIncome: [
          ...prev.oneTimeIncome,
          { ...item, id: crypto.randomUUID() },
        ],
      }));
    });
  }, []);

  const updateOneTimeIncome = useCallback((item: OneTimeIncome) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        oneTimeIncome: prev.oneTimeIncome.map((o) =>
          o.id === item.id ? item : o,
        ),
      }));
    });
  }, []);

  const removeOneTimeIncome = useCallback((id: string) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        oneTimeIncome: prev.oneTimeIncome.filter((o) => o.id !== id),
      }));
    });
  }, []);

  const toggleOneTimeIncomeHidden = useCallback((id: string) => {
    startMutation(() => {
      setSettings((prev) => ({
        ...prev,
        oneTimeIncome: prev.oneTimeIncome.map((o) =>
          o.id === id ? { ...o, hidden: !o.hidden } : o,
        ),
      }));
    });
  }, []);

  const toggleIncomeSourceHidden = useCallback((id: string) => {
    startMutation(() => {
      setSettings((prev) => {
        const nextSources = prev.incomeSources.map((s) =>
          s.id === id ? { ...s, hidden: !s.hidden } : s,
        );
        const next = nextSources.find((s) => s.id === id);
        const clearPocket =
          Boolean(next?.hidden) && prev.pocketIncomeSourceId === id;
        return {
          ...prev,
          incomeSources: nextSources,
          ...(clearPocket ? { pocketIncomeSourceId: undefined } : {}),
        };
      });
    });
  }, []);

  return {
    isLoaded,
    isMutating,
    needsStartDatePrompt,
    expenses,
    spentPerPeriod,
    settings,
    branches,
    activeBranchId,
    currentIncome,
    savedPerPeriod,
    effectivePocketPerPeriod,
    monthlyIncome,
    monthlySavings,
    monthlyNetSavings,
    paydays,
    savingsTimeline,
    pocketTimeline,
    currentPocketBalance,
    goalStats,
    stats,
    validation,
    addExpense,
    removeExpense,
    updateExpense,
    updateSettings,
    addGoal,
    updateGoal,
    removeGoal,
    toggleGoalHidden,
    addRecurringExpense,
    updateRecurringExpense,
    removeRecurringExpense,
    toggleRecurringExpenseHidden,
    addRecurringExpenseSkip,
    removeRecurringExpenseSkip,
    getPaydayEditRowsForDate: getPaydayEditRowsForDateCallback,
    applyPaydayIncomeAmounts,
    applyPocketAmountForPayday,
    resetPocketAmountForPayday,
    addIncomeSource,
    updateIncomeSource,
    removeIncomeSource,
    toggleIncomeSourceHidden,
    switchBranch,
    createBranch,
    branchFromSavingsPoint,
    renameBranch,
    deleteBranch,
    importState,
    addOneTimeIncome,
    updateOneTimeIncome,
    removeOneTimeIncome,
    toggleOneTimeIncomeHidden,
  };
}
