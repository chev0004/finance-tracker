import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { BUDGET_STORAGE_KEY } from '@/lib/budget-constants';
import { getPocketPerPeriodForDate } from '@/lib/pocket-per-period';
import {
  alignPaydayContainingDate,
  getCalendarPocketPeriodStarts,
  getPocketPeriodBounds,
  getPocketPeriodRange,
  pocketPeriodEndsOnOrAfterBalance,
} from '@/lib/pocketPeriods';
import { getLocalDateString } from '@/lib/utils';
import type {
  BudgetSettings,
  BudgetState,
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
  incomeSources: [],
  oneTimeIncome: [],
  paydayIncomeOverrides: [],
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

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

function getMonthsInRange(startDate: string, endDate: string): string[] {
  const result: string[] = [];
  const [sy, sm] = startDate.slice(0, 7).split('-').map(Number);
  const [ey, em] = endDate.slice(0, 7).split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${pad(m)}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
}

function isIncomePaydaySkipped(
  settings: BudgetSettings,
  payday: string,
): boolean {
  const goalsPausingIncome = settings.goals.filter((g) => g.pauseIncome);
  const pausedMonths = new Set(
    goalsPausingIncome.flatMap((g) => getMonthsInRange(g.startDate, g.endDate)),
  );
  if (pausedMonths.has(payday.slice(0, 7))) return true;
  for (const g of goalsPausingIncome) {
    if (g.incomeResumeDate && payday > g.endDate && payday < g.incomeResumeDate)
      return true;
  }
  return false;
}

function getSourceAmountForDate(source: IncomeSource, date: string): number {
  const sorted = [...source.rateChanges].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate),
  );
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

function getPaydayEditRowsForDate(
  settings: BudgetSettings,
  date: string,
): PaydayEditRow[] {
  const goalsPausingIncome = settings.goals.filter((g) => g.pauseIncome);
  const pausedMonths = new Set(
    goalsPausingIncome.flatMap((g) => getMonthsInRange(g.startDate, g.endDate)),
  );

  const isPaydayPaused = (payday: string): boolean => {
    if (pausedMonths.has(payday.slice(0, 7))) return true;
    for (const g of goalsPausingIncome) {
      if (
        g.incomeResumeDate &&
        payday > g.endDate &&
        payday < g.incomeResumeDate
      )
        return true;
    }
    return false;
  };

  const rows: PaydayEditRow[] = [];
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
    if (!sourcePaydays.includes(date)) continue;
    if (isPaydayPaused(date)) continue;
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
  return settings.incomeSources.reduce(
    (total, source) => total + getSourceAmountForDate(source, date),
    0,
  );
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

function buildPausedExpensesByMonth(
  settings: BudgetSettings,
): Map<string, Set<string>> {
  const pausedExpensesByMonth = new Map<string, Set<string>>();
  for (const goal of settings.goals) {
    if (goal.pausedExpenseIds.length === 0) continue;
    for (const month of getMonthsInRange(goal.startDate, goal.endDate)) {
      const existing = pausedExpensesByMonth.get(month) ?? new Set<string>();
      for (const id of goal.pausedExpenseIds) {
        existing.add(id);
      }
      pausedExpensesByMonth.set(month, existing);
    }
  }
  return pausedExpensesByMonth;
}

function getPocketDeductingRecurringPerPeriod(
  settings: BudgetSettings,
  paydays: string[],
  periodBounds: readonly { start: string; end: string }[],
): { totals: number[]; items: PocketExpenseItem[][] } {
  const totals = paydays.map(() => 0);
  const items: PocketExpenseItem[][] = paydays.map(() => []);
  const pausedExpensesByMonth = buildPausedExpensesByMonth(settings);
  const projectionEndYear =
    new Date(`${settings.startDate}T00:00:00`).getFullYear() + 4;

  for (const rec of settings.recurringExpenses) {
    if (!rec.deductFromPocket) continue;
    const endBound = rec.endMonth ?? `${projectionEndYear}-12`;

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
        if (isIncomePaydaySkipped(settings, payday)) continue;
        const monthStr = payday.slice(0, 7);
        if (monthStr < rec.startMonth || monthStr > endBound) continue;
        const isPaused =
          pausedExpensesByMonth.get(monthStr)?.has(rec.id) ?? false;
        if (isPaused) continue;
        const idx = getPeriodIndexWithBounds(payday, periodBounds);
        if (idx !== null) {
          totals[idx] += rec.amount;
          items[idx].push({
            label: rec.label,
            amount: rec.amount,
            date: payday,
          });
        }
      }
      continue;
    }

    const [endY, endM] = endBound.split('-').map(Number);
    let [y, m] = rec.startMonth.split('-').map(Number);

    while (y < endY || (y === endY && m <= endM)) {
      const monthStr = `${y}-${pad(m)}`;
      const isPaused =
        pausedExpensesByMonth.get(monthStr)?.has(rec.id) ?? false;

      if (!isPaused) {
        const day =
          rec.dayOfMonth <= 0
            ? lastDayOf(y, m)
            : Math.min(rec.dayOfMonth, lastDayOf(y, m));
        const dateStr = fmtDate(y, m, day);
        const idx = getPeriodIndexWithBounds(dateStr, periodBounds);
        if (idx !== null) {
          totals[idx] += rec.amount;
          items[idx].push({
            label: rec.label,
            amount: rec.amount,
            date: dateStr,
          });
        }
      }
      m++;
      if (m > 12) {
        m = 1;
        y++;
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

  const pausedPocketMonths = new Set(
    settings.goals
      .filter((g) => g.pausePocket)
      .flatMap((g) => getMonthsInRange(g.startDate, g.endDate)),
  );

  const pocketPaydays = getPocketPaydays(settings, coverDates);
  for (const payday of pocketPaydays) {
    if (!pausedPocketMonths.has(payday.slice(0, 7))) {
      const pocketAmt = getPocketPerPeriodForDate(settings, payday);
      ev.push({
        date: payday,
        label: 'pocket',
        delta: -pocketAmt,
        type: 'pocket',
      });
    }
  }

  const pausedExpensesByMonth = buildPausedExpensesByMonth(settings);

  const projectionEndYear =
    new Date(`${settings.startDate}T00:00:00`).getFullYear() + 4;

  for (const rec of settings.recurringExpenses) {
    const endBound = rec.endMonth ?? `${projectionEndYear}-12`;

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
          if (isIncomePaydaySkipped(settings, payday)) continue;
          const monthStr = payday.slice(0, 7);
          if (monthStr < rec.startMonth || monthStr > endBound) continue;
          const isPaused =
            pausedExpensesByMonth.get(monthStr)?.has(rec.id) ?? false;
          if (isPaused) continue;
          ev.push({
            date: payday,
            label: `${rec.label} $${rec.amount}`,
            delta: -rec.amount,
            type: 'recurring',
            sourceId: rec.deductIncomeSourceId,
          });
        }
      }
      continue;
    }

    if (rec.deductIncomeSourceId) continue;

    const [endY, endM] = endBound.split('-').map(Number);
    let [y, m] = rec.startMonth.split('-').map(Number);

    while (y < endY || (y === endY && m <= endM)) {
      const monthStr = `${y}-${pad(m)}`;
      const isPaused =
        pausedExpensesByMonth.get(monthStr)?.has(rec.id) ?? false;

      if (!isPaused && !rec.deductFromPocket) {
        const day =
          rec.dayOfMonth <= 0
            ? lastDayOf(y, m)
            : Math.min(rec.dayOfMonth, lastDayOf(y, m));
        ev.push({
          date: fmtDate(y, m, day),
          label: `${rec.label} $${rec.amount}`,
          delta: -rec.amount,
          type: 'recurring',
        });
      }
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }

  for (const o of settings.oneTimeIncome ?? []) {
    ev.push({
      date: o.date,
      label: `${o.label} $${o.amount}`,
      delta: o.amount,
      type: 'one-time',
    });
  }

  for (const goal of settings.goals) {
    const total = goal.lineItems.reduce((s, i) => s + i.amount, 0);
    if (total > 0) {
      ev.push({
        date: goal.startDate,
        label: `${goal.name} $${total.toLocaleString()}`,
        delta: -total,
        type: 'goal',
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
    return {
      ...base,
      deductFromPocket: base.deductFromPocket ?? false,
      deductIncomeSourceId: base.deductIncomeSourceId,
    };
  });
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
      if ('payFrequency' in s && s.payFrequency) return s;
      return {
        ...s,
        payFrequency: globalFreq,
        firstPayday: s.firstPayday ?? globalPayday,
        payInterval: s.payInterval,
      };
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
    {
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
    },
  ];
}

function migrateSettings(raw: Record<string, unknown>): BudgetSettings {
  if (raw.goals) {
    const settings = raw as unknown as BudgetSettings & {
      incomePerPeriod?: number;
      incomeChanges?: unknown[];
      payFrequency?: PayFrequency;
      firstPayday?: string;
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
      startMonth,
      endMonth: null,
      deductFromPocket: true,
    }));
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
      recurringExpenses: [
        ...migrateRecurringExpenses(settings.recurringExpenses ?? []),
        ...fromLegacyPocket,
      ],
      goals: (settings.goals as unknown as Record<string, unknown>[]).map(
        migrateGoal,
      ),
      incomeSources: migrateIncomeSources(raw),
      oneTimeIncome: settings.oneTimeIncome ?? [],
      paydayIncomeOverrides: migratePaydayIncomeOverrides(
        settings.paydayIncomeOverrides ?? [],
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
    paydayIncomeOverrides: [],
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

export function useBudget() {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const [isLoaded, setIsLoaded] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [spentPerPeriod, setSpentPerPeriod] = useState<number[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>(DEFAULT_SETTINGS);
  const [needsStartDatePrompt, setNeedsStartDatePrompt] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isSessionPending) return;

    async function load() {
      if (session) {
        const res = await fetch('/api/budget');
        if (res.ok) {
          const body = await res.json();
          if (body) {
            const parsed = parseAndApplyStored(body);
            setExpenses(parsed.expenses);
            setSpentPerPeriod(parsed.spentPerPeriod);
            setSettings(parsed.settings);
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
            const parsed = parseAndApplyStored(localData);
            setExpenses(parsed.expenses);
            setSpentPerPeriod(parsed.spentPerPeriod);
            setSettings(parsed.settings);
            setNeedsStartDatePrompt(false);
          } else {
            setNeedsStartDatePrompt(true);
            const pd = getPocketPaydays(DEFAULT_SETTINGS);
            setSpentPerPeriod(pd.map(() => 0));
          }
        } catch {
          setNeedsStartDatePrompt(true);
          const pd = getPocketPaydays(DEFAULT_SETTINGS);
          setSpentPerPeriod(pd.map(() => 0));
        }
      } else {
        try {
          const stored = localStorage.getItem(BUDGET_STORAGE_KEY);
          if (stored) {
            const parsed = parseAndApplyStored(JSON.parse(stored));
            setExpenses(parsed.expenses);
            setSpentPerPeriod(parsed.spentPerPeriod);
            setSettings(parsed.settings);
            setNeedsStartDatePrompt(parsed.needsStartDatePrompt);
          } else {
            setNeedsStartDatePrompt(true);
            const pd = getPocketPaydays(DEFAULT_SETTINGS);
            setSpentPerPeriod(pd.map(() => 0));
          }
        } catch {
          const pd = getPocketPaydays(DEFAULT_SETTINGS);
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
    const data: BudgetState = {
      expenses,
      spentPerPeriod,
      settings,
    };
    if (session) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        fetch('/api/budget', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        saveTimeoutRef.current = null;
      }, 500);
    } else {
      try {
        localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(data));
      } catch {
        // localStorage unavailable
      }
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [expenses, spentPerPeriod, settings, isLoaded, isSessionPending, session]);

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
    if (settings.pocketIncomeSourceId) {
      const exists = settings.incomeSources.some(
        (s) => s.id === settings.pocketIncomeSourceId,
      );
      if (!exists) {
        setSettings((prev) => ({ ...prev, pocketIncomeSourceId: undefined }));
      }
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
      pocketBal += getPocketPerPeriodForDate(settings, periodPayday);
      const range = pocketPeriodBounds[i];

      const periodExpenses = expenses
        .filter((e) => dateInPeriod(e.date, range.start, range.end))
        .sort((a, b) => a.date.localeCompare(b.date));

      const recurringItems = pocketDeductingRecurringPerPeriod.items[i] ?? [];
      for (const it of recurringItems) {
        const covered = Math.min(it.amount, pocketBal);
        const overflow = it.amount - covered;
        pocketBal -= covered;
        if (overflow > 0) {
          overflowEvents.push({
            date: it.date ?? range.end,
            label: it.label,
            delta: -overflow,
            type: 'recurring',
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
        ? getPocketPerPeriodForDate(settings, firstPeriodPayday)
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

    let carriedPocket = 0;

    for (const date of Object.keys(grouped).sort()) {
      const evs = grouped[date];
      for (const e of evs.filter((x) => x.delta > 0)) running += e.delta;
      for (const e of evs.filter((x) => x.delta < 0)) running += e.delta;

      const pocketTotal = evs
        .filter((e) => e.type === 'pocket')
        .reduce((s, e) => s + e.delta, 0);
      if (pocketTotal < 0) {
        carriedPocket += Math.abs(pocketTotal);
      }

      const paydays = evs.filter((e) => e.type === 'payday');
      const others = evs.filter(
        (e) => e.type !== 'pocket' && e.type !== 'payday',
      );

      const displayPaydays: FixedEvent[] = [];
      if (paydays.length > 0 && carriedPocket > 0) {
        const sorted = [...paydays].sort((a, b) => b.delta - a.delta);
        const allocation = new Map<FixedEvent, number>();
        let remaining = carriedPocket;

        for (const p of sorted) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, p.delta);
          allocation.set(p, take);
          remaining -= take;
        }

        carriedPocket = remaining;

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
      const periodPocket = getPocketPerPeriodForDate(settings, payday);
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
      prevBalance + getPocketPerPeriodForDate(settings, periodPayday);
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

  // --- Actions ---

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

  const updateSpentForPeriod = useCallback(
    (idx: number, amount: number): { success: boolean; error?: string } => {
      const pt = pocketTimeline[idx];
      if (!pt) return { success: false, error: 'Invalid period' };
      if (pt.expenseCount > 0) {
        return {
          success: false,
          error:
            'Expenses are logged for this period. Edit through the expense log.',
        };
      }
      const valid = Math.max(0, Math.min(amount, pt.available));
      setSpentPerPeriod((prev) => {
        const next = [...prev];
        next[idx] = valid;
        return next;
      });
      return { success: true };
    },
    [pocketTimeline],
  );

  const updateSettings = useCallback((patch: Partial<BudgetSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const addGoal = useCallback((goal: SavingsGoal) => {
    setSettings((prev) => ({
      ...prev,
      goals: [...prev.goals, goal],
    }));
  }, []);

  const updateGoal = useCallback((goal: SavingsGoal) => {
    setSettings((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === goal.id ? goal : g)),
    }));
  }, []);

  const removeGoal = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    }));
  }, []);

  const addRecurringExpense = useCallback(
    (expense: Omit<RecurringExpense, 'id'>) => {
      setSettings((prev) => ({
        ...prev,
        recurringExpenses: [
          ...prev.recurringExpenses,
          { ...expense, id: crypto.randomUUID() },
        ],
      }));
    },
    [],
  );

  const updateRecurringExpense = useCallback((expense: RecurringExpense) => {
    setSettings((prev) => ({
      ...prev,
      recurringExpenses: prev.recurringExpenses.map((e) =>
        e.id === expense.id ? expense : e,
      ),
    }));
  }, []);

  const removeRecurringExpense = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      recurringExpenses: prev.recurringExpenses.filter((e) => e.id !== id),
    }));
  }, []);

  const getPaydayEditRowsForDateCallback = useCallback(
    (date: string) => getPaydayEditRowsForDate(settings, date),
    [settings],
  );

  const applyPaydayIncomeAmounts = useCallback(
    (date: string, amounts: { sourceId: string; amount: number }[]) => {
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
    },
    [],
  );

  const addIncomeSource = useCallback((source: Omit<IncomeSource, 'id'>) => {
    setSettings((prev) => ({
      ...prev,
      incomeSources: [
        ...prev.incomeSources,
        { ...source, id: crypto.randomUUID() },
      ],
    }));
  }, []);

  const updateIncomeSource = useCallback((source: IncomeSource) => {
    setSettings((prev) => ({
      ...prev,
      incomeSources: prev.incomeSources.map((s) =>
        s.id === source.id ? source : s,
      ),
    }));
  }, []);

  const removeIncomeSource = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      incomeSources: prev.incomeSources.filter((s) => s.id !== id),
    }));
  }, []);

  const importState = useCallback((state: BudgetState) => {
    setExpenses(state.expenses);
    setSpentPerPeriod(state.spentPerPeriod);
    setSettings(
      migrateSettings(state.settings as unknown as Record<string, unknown>),
    );
  }, []);

  const addOneTimeIncome = useCallback((item: Omit<OneTimeIncome, 'id'>) => {
    setSettings((prev) => ({
      ...prev,
      oneTimeIncome: [
        ...prev.oneTimeIncome,
        { ...item, id: crypto.randomUUID() },
      ],
    }));
  }, []);

  const updateOneTimeIncome = useCallback((item: OneTimeIncome) => {
    setSettings((prev) => ({
      ...prev,
      oneTimeIncome: prev.oneTimeIncome.map((o) =>
        o.id === item.id ? item : o,
      ),
    }));
  }, []);

  const removeOneTimeIncome = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      oneTimeIncome: prev.oneTimeIncome.filter((o) => o.id !== id),
    }));
  }, []);

  return {
    isLoaded,
    needsStartDatePrompt,
    expenses,
    spentPerPeriod,
    settings,
    currentIncome,
    savedPerPeriod,
    effectivePocketPerPeriod,
    monthlyIncome,
    monthlySavings,
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
    updateSpentForPeriod,
    updateSettings,
    addGoal,
    updateGoal,
    removeGoal,
    addRecurringExpense,
    updateRecurringExpense,
    removeRecurringExpense,
    getPaydayEditRowsForDate: getPaydayEditRowsForDateCallback,
    applyPaydayIncomeAmounts,
    addIncomeSource,
    updateIncomeSource,
    removeIncomeSource,
    importState,
    addOneTimeIncome,
    updateOneTimeIncome,
    removeOneTimeIncome,
  };
}
