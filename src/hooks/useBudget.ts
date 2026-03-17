import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BudgetSettings,
  BudgetState,
  Expense,
  FixedEvent,
  GoalStat,
  IncomeChange,
  PocketPoint,
  RecurringExpense,
  SavingsGoal,
  SavingsPoint,
} from '@/types';

const DEFAULT_SETTINGS: BudgetSettings = {
  startingBalance: 0,
  startDate: '2000-01-01',
  incomePerPeriod: 0,
  pocketPerPeriod: 0,
  payFrequency: 'weekly',
  firstPayday: '2000-01-01',
  goals: [
    {
      id: 'default-goal',
      name: 'Goal',
      startDate: '2000-01-01',
      endDate: '2026-07-31',
      lineItems: [
        {
          id: 'default-goal-cost',
          label: 'Trip Cost',
          amount: 0,
        },
      ],
      pauseIncome: true,
      pausedExpenseIds: ['default-rent'],
    },
  ],
  recurringExpenses: [
    {
      id: 'default-rent',
      label: 'Rent',
      amount: 0,
      dayOfMonth: 15,
      startMonth: '2000-01',
      endMonth: '2000-12',
    },
  ],
  incomeChanges: [],
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

function getPaydays(
  firstPayday: string,
  frequency: 'weekly' | 'biweekly',
): string[] {
  const result: string[] = [];
  const d = new Date(`${firstPayday}T00:00:00`);
  const step = frequency === 'biweekly' ? 14 : 7;
  while (d.getFullYear() === 2026) {
    result.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + step);
  }
  return result;
}

function getPeriodRange(
  payday: string,
  frequency: 'weekly' | 'biweekly',
): { start: string; end: string; label: string } {
  const end = new Date(`${payday}T00:00:00`);
  const start = new Date(end);
  start.setDate(end.getDate() - (frequency === 'biweekly' ? 13 : 6));

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
  frequency: 'weekly' | 'biweekly',
): number | null {
  for (let i = 0; i < paydays.length; i++) {
    const range = getPeriodRange(paydays[i], frequency);
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

function getIncomeForDate(settings: BudgetSettings, date: string): number {
  const sorted = [...settings.incomeChanges].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate),
  );
  let income = settings.incomePerPeriod;
  for (const change of sorted) {
    if (change.effectiveDate <= date) income = change.incomePerPeriod;
    else break;
  }
  return income;
}

function genFixedEvents(settings: BudgetSettings): FixedEvent[] {
  const ev: FixedEvent[] = [];

  const pausedMonths = new Set(
    settings.goals
      .filter((g) => g.pauseIncome)
      .flatMap((g) => getMonthsInRange(g.startDate, g.endDate)),
  );

  const paydays = getPaydays(settings.firstPayday, settings.payFrequency);
  for (const payday of paydays) {
    if (!pausedMonths.has(payday.slice(0, 7))) {
      const income = getIncomeForDate(settings, payday);
      const saved = income - settings.pocketPerPeriod;
      ev.push({
        date: payday,
        label: 'payday',
        delta: saved,
        type: 'payday',
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

  for (const rec of settings.recurringExpenses) {
    const [endY, endM] = rec.endMonth.split('-').map(Number);
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
          pausedExpenseIds: [] as string[],
        };
  if (!('pausedExpenseIds' in base) || !base.pausedExpenseIds) {
    return { ...base, pausedExpenseIds: [] };
  }
  return base;
}

function migrateRecurringExpenses(
  expenses: RecurringExpense[],
): RecurringExpense[] {
  return expenses.map((e) =>
    e.dayOfMonth === 31 ? { ...e, dayOfMonth: 0 } : e,
  );
}

function migrateSettings(raw: Record<string, unknown>): BudgetSettings {
  if (raw.goals) {
    const settings = raw as unknown as BudgetSettings;
    return {
      ...settings,
      incomeChanges: settings.incomeChanges ?? [],
      recurringExpenses: migrateRecurringExpenses(
        settings.recurringExpenses ?? [],
      ),
      goals: (settings.goals as unknown as Record<string, unknown>[]).map(
        migrateGoal,
      ),
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
    incomePerPeriod: weeklySave + weeklyPocket,
    pocketPerPeriod: weeklyPocket,
    payFrequency: 'weekly',
    firstPayday: '2000-01-01',
    incomeChanges: [],
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
            pausedExpenseIds: [],
          },
        ]
      : [],
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
        const pd = getPaydays(
          DEFAULT_SETTINGS.firstPayday,
          DEFAULT_SETTINGS.payFrequency,
        );
        setSpentPerPeriod(pd.map(() => 0));
      }
    } catch {
      const pd = getPaydays(
        DEFAULT_SETTINGS.firstPayday,
        DEFAULT_SETTINGS.payFrequency,
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

  const savedPerPeriod = currentIncome - settings.pocketPerPeriod;

  const paydays = useMemo(
    () => getPaydays(settings.firstPayday, settings.payFrequency),
    [settings.firstPayday, settings.payFrequency],
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
        settings.payFrequency,
      );
      if (idx !== null) {
        totals[idx] += expense.amount;
        counts[idx]++;
      }
    }

    return { totals, counts };
  }, [expenses, paydays, settings.payFrequency]);

  const savingsTimeline = useMemo((): SavingsPoint[] => {
    const overflowEvents: FixedEvent[] = [];
    let pocketBal = 0;

    for (let i = 0; i < paydays.length; i++) {
      pocketBal += settings.pocketPerPeriod;
      const range = getPeriodRange(paydays[i], settings.payFrequency);

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
        getPeriodIndexForDate(exp.date, paydays, settings.payFrequency) === null
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

    for (const date of Object.keys(grouped).sort()) {
      const evs = grouped[date];
      for (const e of evs.filter((x) => x.delta > 0)) running += e.delta;
      for (const e of evs.filter((x) => x.delta < 0)) running += e.delta;

      const hasPayday = evs.some((e) => e.type === 'payday');
      const hasRecurring = evs.some((e) => e.type === 'recurring');
      const hasGoal = evs.some((e) => e.type === 'goal');
      const hasUser = evs.some((e) => e.type === 'user-expense');

      let type: FixedEvent['type'] = 'payday';
      if (hasGoal && !hasPayday) type = 'goal';
      else if (hasGoal && hasPayday) type = 'payday-recurring';
      else if ((hasRecurring || hasUser) && !hasPayday)
        type = hasRecurring ? 'recurring' : 'user-expense';
      else if (hasPayday && (hasRecurring || hasUser))
        type = 'payday-recurring';
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
        label: evs.map((e) => e.label).join(' + '),
        type,
        events: evs.map((e) => ({
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
    settings.payFrequency,
    paydays,
    spentPerPeriod,
  ]);

  const pocketTimeline = useMemo((): PocketPoint[] => {
    let balance = 0;
    return paydays.map((payday, i) => {
      const range = getPeriodRange(payday, settings.payFrequency);
      const expenseTotal = expensesPerPeriod.totals[i] || 0;
      const expenseCount = expensesPerPeriod.counts[i] || 0;

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
      };
    });
  }, [
    paydays,
    spentPerPeriod,
    settings.pocketPerPeriod,
    settings.payFrequency,
    expensesPerPeriod,
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
    return {
      errors,
      hasError: errors.length > 0,
      isCritical: !!negPt || goalStats.some((s) => !s.isFeasible),
    };
  }, [settings.goals, goalStats, savingsTimeline]);

  // --- Actions ---

  const addExpense = useCallback(
    (date: string, label: string, amount: number) => {
      if (!date || !label || Number.isNaN(amount) || amount <= 0) return false;
      const periodIdx = getPeriodIndexForDate(
        date,
        paydays,
        settings.payFrequency,
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
    [paydays, settings.payFrequency],
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

  const addIncomeChange = useCallback((change: Omit<IncomeChange, 'id'>) => {
    setSettings((prev) => ({
      ...prev,
      incomeChanges: [
        ...prev.incomeChanges,
        { ...change, id: crypto.randomUUID() },
      ],
    }));
  }, []);

  const updateIncomeChange = useCallback((change: IncomeChange) => {
    setSettings((prev) => ({
      ...prev,
      incomeChanges: prev.incomeChanges.map((c) =>
        c.id === change.id ? change : c,
      ),
    }));
  }, []);

  const removeIncomeChange = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      incomeChanges: prev.incomeChanges.filter((c) => c.id !== id),
    }));
  }, []);

  return {
    isLoaded,
    expenses,
    settings,
    savedPerPeriod,
    paydays,
    savingsTimeline,
    pocketTimeline,
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
    addIncomeChange,
    updateIncomeChange,
    removeIncomeChange,
  };
}
