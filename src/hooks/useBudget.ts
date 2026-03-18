import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BudgetSettings,
  BudgetState,
  Expense,
  FixedEvent,
  GoalStat,
  IncomeSource,
  OneTimeIncome,
  PayFrequency,
  PocketPoint,
  RecurringExpense,
  SavingsGoal,
  SavingsPoint,
} from '@/types';

const DEFAULT_SETTINGS: BudgetSettings = {
  startingBalance: 0,
  startDate: '2026-01-01',
  pocketPerPeriod: 0,
  pocketFrequency: 'weekly',
  pocketFirstPayday: '2026-01-01',
  goals: [],
  recurringExpenses: [],
  incomeSources: [],
  oneTimeIncome: [],
};

const STORAGE_KEY = 'budget-tracker-data';

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
  firstPayday: string,
  frequency: PayFrequency,
  interval: number | undefined,
  startDate: string,
): string[] {
  return getPaydaysForFrequency(firstPayday, frequency, interval, startDate);
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
    result.push(d.toISOString().slice(0, 10));
    if (!advancePayday(d, frequency, payInterval)) break;
  }
  return result;
}

function periodDaysBack(frequency: PayFrequency, payInterval?: number): number {
  if (frequency === 'biweekly') return 13;
  if (frequency === 'monthly') return 29;
  if (frequency === 'custom' && payInterval && payInterval > 0)
    return payInterval - 1;
  return 6;
}

function getPeriodRange(
  payday: string,
  frequency: PayFrequency,
  payInterval?: number,
): { start: string; end: string; label: string } {
  const end = new Date(`${payday}T00:00:00`);
  const start = new Date(end);
  start.setDate(end.getDate() - periodDaysBack(frequency, payInterval));

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return {
    start: start.toISOString().slice(0, 10),
    end: payday,
    label: `${fmt(start)}-${fmt(end)}`,
  };
}

function dateInPeriod(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function getPeriodIndexForDate(
  date: string,
  paydays: string[],
  frequency: PayFrequency,
  payInterval?: number,
): number | null {
  for (let i = 0; i < paydays.length; i++) {
    const range = getPeriodRange(paydays[i], frequency, payInterval);
    if (dateInPeriod(date, range.start, range.end)) return i;
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
  const today = new Date().toISOString().slice(0, 10);
  return settings.incomeSources.reduce((sum, source) => {
    const amount = getSourceAmountForDate(source, today);
    const periods = periodsPerYear(source.payFrequency, source.payInterval);
    return sum + (amount * periods) / 12;
  }, 0);
}

function getMonthlySavings(settings: BudgetSettings): number {
  const monthlyIncome = getMonthlyIncome(settings);
  const pocketPeriods =
    periodsPerYear(settings.pocketFrequency, settings.pocketInterval) || 26;
  const monthlyPocket = (settings.pocketPerPeriod * pocketPeriods) / 12;
  return monthlyIncome - monthlyPocket;
}

function genFixedEvents(settings: BudgetSettings): FixedEvent[] {
  const ev: FixedEvent[] = [];

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

  for (const source of settings.incomeSources) {
    const sourcePaydays = getPaydaysForFrequency(
      source.firstPayday,
      source.payFrequency,
      source.payInterval,
      settings.startDate,
    );
    for (const payday of sourcePaydays) {
      if (!isPaydayPaused(payday)) {
        const amount = getSourceAmountForDate(source, payday);
        ev.push({
          date: payday,
          label: `${source.name} $${amount}`,
          delta: amount,
          type: 'payday',
        });
      }
    }
  }

  const pausedPocketMonths = new Set(
    settings.goals
      .filter((g) => g.pausePocket)
      .flatMap((g) => getMonthsInRange(g.startDate, g.endDate)),
  );

  const pocketPaydays = getPaydaysForFrequency(
    settings.pocketFirstPayday,
    settings.pocketFrequency,
    settings.pocketInterval,
    settings.startDate,
  );
  for (const payday of pocketPaydays) {
    if (!pausedPocketMonths.has(payday.slice(0, 7))) {
      ev.push({
        date: payday,
        label: 'pocket',
        delta: -settings.pocketPerPeriod,
        type: 'pocket',
      });
    }
  }

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

  const projectionEndYear =
    new Date(`${settings.startDate}T00:00:00`).getFullYear() + 4;

  for (const rec of settings.recurringExpenses) {
    const endBound = rec.endMonth ?? `${projectionEndYear}-12`;
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
          startDate: (g.targetDate as string) ?? '2000-01-01',
          endDate: (g.targetDate as string) ?? '2000-01-01',
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
  return expenses.map((e) =>
    e.dayOfMonth === 31 ? { ...e, dayOfMonth: 0 } : e,
  );
}

function migrateIncomeSources(raw: Record<string, unknown>): IncomeSource[] {
  const globalFreq =
    (raw.payFrequency as PayFrequency) ??
    (raw.pocketFrequency as PayFrequency) ??
    'weekly';
  const globalPayday =
    (raw.firstPayday as string) ??
    (raw.pocketFirstPayday as string) ??
    '2000-01-01';

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
    };
    return {
      startingBalance: settings.startingBalance,
      startDate: settings.startDate,
      pocketPerPeriod: settings.pocketPerPeriod,
      pocketFrequency:
        settings.pocketFrequency ?? settings.pocketFrequency ?? 'weekly',
      pocketFirstPayday:
        settings.pocketFirstPayday ?? settings.firstPayday ?? '2000-01-01',
      pocketInterval: settings.pocketInterval,
      recurringExpenses: migrateRecurringExpenses(
        settings.recurringExpenses ?? [],
      ),
      goals: (settings.goals as unknown as Record<string, unknown>[]).map(
        migrateGoal,
      ),
      incomeSources: migrateIncomeSources(raw),
      oneTimeIncome: settings.oneTimeIncome ?? [],
    };
  }

  const old = raw as {
    startingBalance?: number;
    tripCost?: number;
    weeklySave?: number;
    weeklyPocket?: number;
    tripMonth?: string;
  };
  const weeklySave = old.weeklySave ?? 0;
  const weeklyPocket = old.weeklyPocket ?? 0;

  return {
    startingBalance: old.startingBalance ?? 0,
    startDate: '2000-01-01',
    pocketPerPeriod: weeklyPocket,
    pocketFrequency: 'weekly',
    pocketFirstPayday: '2000-01-01',
    incomeSources: [
      {
        id: crypto.randomUUID(),
        name: 'Income',
        amount: weeklySave + weeklyPocket,
        payFrequency: 'weekly',
        firstPayday: '2000-01-01',
        rateChanges: [],
      },
    ],
    goals: old.tripMonth
      ? [
          {
            id: crypto.randomUUID(),
            name: 'Goal',
            startDate: `${old.tripMonth}-01`,
            endDate: `${old.tripMonth}-01`,
            lineItems: [
              {
                id: crypto.randomUUID(),
                label: 'Trip Cost',
                amount: old.tripCost ?? 0,
              },
            ],
            pauseIncome: true,
            pausePocket: false,
            pausedExpenseIds: [],
          },
        ]
      : [],
    oneTimeIncome: [],
    recurringExpenses: [
      {
        id: crypto.randomUUID(),
        label: 'Rent',
        amount: 0,
        dayOfMonth: 15,
        startMonth: '2000-01',
        endMonth: '2000-12',
      },
    ],
  };
}

export function useBudget() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [spentPerPeriod, setSpentPerPeriod] = useState<number[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setExpenses(data.expenses || []);
        setSpentPerPeriod(data.spentPerPeriod || data.spentPerWeek || []);
        setSettings(migrateSettings(data.settings || {}));
      } else {
        const pd = getPocketPaydays(
          DEFAULT_SETTINGS.pocketFirstPayday,
          DEFAULT_SETTINGS.pocketFrequency,
          DEFAULT_SETTINGS.pocketInterval,
          DEFAULT_SETTINGS.startDate,
        );
        setSpentPerPeriod(pd.map(() => 0));
      }
    } catch {
      const pd = getPocketPaydays(
        DEFAULT_SETTINGS.pocketFirstPayday,
        DEFAULT_SETTINGS.pocketFrequency,
        DEFAULT_SETTINGS.pocketInterval,
        DEFAULT_SETTINGS.startDate,
      );
      setSpentPerPeriod(pd.map(() => 0));
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      const data: BudgetState = {
        expenses,
        spentPerPeriod,
        settings,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage unavailable
    }
  }, [expenses, spentPerPeriod, settings, isLoaded]);

  const currentIncome = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return getIncomeForDate(settings, today);
  }, [settings]);

  const monthlyIncome = useMemo(() => getMonthlyIncome(settings), [settings]);

  const monthlySavings = useMemo(() => getMonthlySavings(settings), [settings]);

  const savedPerPeriod = currentIncome - settings.pocketPerPeriod;

  const paydays = useMemo(
    () =>
      getPocketPaydays(
        settings.pocketFirstPayday,
        settings.pocketFrequency,
        settings.pocketInterval,
        settings.startDate,
      ),
    [
      settings.pocketFirstPayday,
      settings.pocketFrequency,
      settings.pocketInterval,
      settings.startDate,
    ],
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (spentPerPeriod.length !== paydays.length) {
      setSpentPerPeriod(paydays.map(() => 0));
    }
  }, [paydays.length, isLoaded, spentPerPeriod.length, paydays]);

  const fixedEvents = useMemo(() => genFixedEvents(settings), [settings]);

  const expensesPerPeriod = useMemo(() => {
    const totals: number[] = paydays.map(() => 0);
    const counts: number[] = paydays.map(() => 0);

    for (const expense of expenses) {
      const idx = getPeriodIndexForDate(
        expense.date,
        paydays,
        settings.pocketFrequency,
        settings.pocketInterval,
      );
      if (idx !== null) {
        totals[idx] += expense.amount;
        counts[idx]++;
      }
    }

    return { totals, counts };
  }, [expenses, paydays, settings.pocketFrequency, settings.pocketInterval]);

  const savingsTimeline = useMemo((): SavingsPoint[] => {
    const overflowEvents: FixedEvent[] = [];
    let pocketBal = 0;

    for (let i = 0; i < paydays.length; i++) {
      pocketBal += settings.pocketPerPeriod;
      const range = getPeriodRange(
        paydays[i],
        settings.pocketFrequency,
        settings.pocketInterval,
      );

      const periodExpenses = expenses
        .filter((e) => dateInPeriod(e.date, range.start, range.end))
        .sort((a, b) => a.date.localeCompare(b.date));

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
      if (
        getPeriodIndexForDate(
          exp.date,
          paydays,
          settings.pocketFrequency,
          settings.pocketInterval,
        ) === null
      ) {
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

    const points: SavingsPoint[] = [
      {
        date: startLabel,
        rawDate: settings.startDate,
        balance: settings.startingBalance,
        label: 'start',
        type: 'start',
        events: [],
      },
    ];
    let running = settings.startingBalance;
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
            label: p.label.replace(/\$\d+/, `$${net}`),
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
        balance: Math.round(running),
        label: visible.map((e) => e.label).join(' + '),
        type,
        events: visible.map((e) => ({
          label: e.label,
          delta: e.delta,
          type: e.type,
        })),
      });
    }
    return points;
  }, [
    fixedEvents,
    expenses,
    settings.startDate,
    settings.startingBalance,
    settings.pocketPerPeriod,
    settings.pocketFrequency,
    settings.pocketInterval,
    paydays,
    spentPerPeriod,
  ]);

  const pocketTimeline = useMemo((): PocketPoint[] => {
    let balance = 0;
    return paydays.map((payday, i) => {
      const range = getPeriodRange(
        payday,
        settings.pocketFrequency,
        settings.pocketInterval,
      );
      const expenseTotal = expensesPerPeriod.totals[i] || 0;
      const expenseCount = expensesPerPeriod.counts[i] || 0;

      const periodExpenses = expenses.filter((e) =>
        dateInPeriod(e.date, range.start, range.end),
      );

      const spent = expenseCount > 0 ? expenseTotal : spentPerPeriod[i] || 0;
      const avail = balance + settings.pocketPerPeriod;
      const finalSpent = Math.min(spent, avail);
      balance = avail - finalSpent;

      const type =
        finalSpent < settings.pocketPerPeriod
          ? 'surplus'
          : finalSpent > settings.pocketPerPeriod
            ? 'over'
            : 'flat';

      const expenseItems =
        periodExpenses.length > 0
          ? periodExpenses.map((e) => ({ label: e.label, amount: e.amount }))
          : spent > 0
            ? [{ label: 'Spent', amount: spent }]
            : [];

      return {
        date: range.label,
        rawDate: payday,
        weekStart: range.start,
        weekEnd: range.end,
        balance: Math.round(balance),
        available: Math.round(avail),
        spent: Math.round(finalSpent),
        overage: Math.round(Math.max(0, spent - avail)),
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
    settings.pocketPerPeriod,
    settings.pocketFrequency,
    settings.pocketInterval,
    expensesPerPeriod,
  ]);

  const currentPocketBalance = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const periodIdx = getPeriodIndexForDate(
      today,
      paydays,
      settings.pocketFrequency,
      settings.pocketInterval,
    );
    if (periodIdx === null) return 0;
    const prevBalance =
      periodIdx === 0 ? 0 : (pocketTimeline[periodIdx - 1]?.balance ?? 0);
    const range = getPeriodRange(
      paydays[periodIdx],
      settings.pocketFrequency,
      settings.pocketInterval,
    );
    const periodExpenses = expenses.filter(
      (e) => dateInPeriod(e.date, range.start, range.end) && e.date <= today,
    );
    const spentSoFar =
      periodExpenses.length > 0
        ? periodExpenses.reduce((s, e) => s + e.amount, 0)
        : (spentPerPeriod[periodIdx] ?? 0);
    const available = prevBalance + settings.pocketPerPeriod;
    return Math.max(0, Math.round(available - spentSoFar));
  }, [
    paydays,
    pocketTimeline,
    expenses,
    spentPerPeriod,
    settings.pocketPerPeriod,
    settings.pocketFrequency,
    settings.pocketInterval,
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
      settings.pocketFrequency,
      settings.pocketInterval,
    );
    const monthlyPocket =
      pocketPeriods > 0 ? (settings.pocketPerPeriod * pocketPeriods) / 12 : 0;
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
    settings.pocketPerPeriod,
    settings.pocketFrequency,
    settings.pocketInterval,
    monthlyIncome,
  ]);

  // --- Actions ---

  const addExpense = useCallback(
    (date: string, label: string, amount: number) => {
      if (!date || !label || Number.isNaN(amount) || amount <= 0) return false;
      const periodIdx = getPeriodIndexForDate(
        date,
        paydays,
        settings.pocketFrequency,
        settings.pocketInterval,
      );
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
    [paydays, settings.pocketFrequency, settings.pocketInterval],
  );

  const removeExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateExpenseAmount = useCallback((id: string, amount: number) => {
    if (Number.isNaN(amount) || amount <= 0) return;
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, amount } : e)),
    );
  }, []);

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
    expenses,
    settings,
    currentIncome,
    savedPerPeriod,
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
    updateExpenseAmount,
    updateSpentForPeriod,
    updateSettings,
    addGoal,
    updateGoal,
    removeGoal,
    addRecurringExpense,
    updateRecurringExpense,
    removeRecurringExpense,
    addIncomeSource,
    updateIncomeSource,
    removeIncomeSource,
    addOneTimeIncome,
    updateOneTimeIncome,
    removeOneTimeIncome,
  };
}
