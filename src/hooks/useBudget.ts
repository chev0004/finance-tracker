import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BudgetSettings,
  BudgetState,
  Expense,
  FixedEvent,
  PocketPoint,
  SavingsPoint,
} from '@/types';

const DEFAULT_SETTINGS: BudgetSettings = {
  startingBalance: 0,
  tripCost: 0,
  weeklySave: 0,
  weeklyPocket: 0,
  tripMonth: '2000-01',
};

const STORAGE_KEY = 'budget-tracker-data';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function getFridays(): string[] {
  const f: string[] = [];
  const d = new Date('2000-01-01T00:00:00');
  while (d.getFullYear() === 2026) {
    f.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return f;
}

function getWeekRange(fridayDate: string): {
  start: string;
  end: string;
  label: string;
} {
  const friday = new Date(`${fridayDate}T00:00:00`);
  const saturday = new Date(friday);
  saturday.setDate(friday.getDate() - 6);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return {
    start: saturday.toISOString().slice(0, 10),
    end: fridayDate,
    label: `${formatDate(saturday)}-${formatDate(friday)}`,
  };
}

function dateInWeek(date: string, weekStart: string, weekEnd: string): boolean {
  return date >= weekStart && date <= weekEnd;
}

function getWeekIndexForDate(date: string, fridays: string[]): number | null {
  for (let i = 0; i < fridays.length; i++) {
    const weekRange = getWeekRange(fridays[i]);
    if (dateInWeek(date, weekRange.start, weekRange.end)) {
      return i;
    }
  }
  return null;
}

function genFixedEvents(weeklySave: number, tripMonth: string): FixedEvent[] {
  const ev: FixedEvent[] = [];
  const d = new Date('2000-01-01T00:00:00');
  while (d.getFullYear() === 2026) {
    const dateStr = d.toISOString().slice(0, 10);
    const inTripMonth = dateStr.startsWith(`${tripMonth}-`);
    if (!inTripMonth) {
      ev.push({
        date: dateStr,
        label: 'payday',
        delta: weeklySave,
        type: 'payday',
      });
    }
    d.setDate(d.getDate() + 7);
  }
  for (let m = 4; m <= 12; m++) {
    ev.push({
      date: dateStr(2026, m, 15),
      label: 'rent',
      delta: 0,
      type: 'rent',
    });
  }
  ev.push({
    date: '2000-01-01',
    label: 'adjustment',
    delta: 0,
    type: 'fixed-expense',
  });
  return ev;
}

export function useBudget() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [spentPerWeek, setSpentPerWeek] = useState<number[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: BudgetState = JSON.parse(stored);
        setExpenses(data.expenses || []);
        setSpentPerWeek(data.spentPerWeek || []);
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      } else {
        const fridays = getFridays();
        setSpentPerWeek(fridays.map(() => 0));
      }
    } catch {
      const fridays = getFridays();
      setSpentPerWeek(fridays.map(() => 0));
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      const data: BudgetState = { expenses, spentPerWeek, settings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage unavailable
    }
  }, [expenses, spentPerWeek, settings, isLoaded]);

  const fridays = useMemo(() => getFridays(), []);
  const fixedEvents = useMemo(
    () => genFixedEvents(settings.weeklySave, settings.tripMonth),
    [settings.weeklySave, settings.tripMonth],
  );

  const expensesPerWeek = useMemo(() => {
    const weekTotals: number[] = fridays.map(() => 0);
    const weekExpenseCounts: number[] = fridays.map(() => 0);

    for (const expense of expenses) {
      const weekIdx = getWeekIndexForDate(expense.date, fridays);
      if (weekIdx !== null) {
        weekTotals[weekIdx] += expense.amount;
        weekExpenseCounts[weekIdx]++;
      }
    }

    return { weekTotals, weekExpenseCounts };
  }, [expenses, fridays]);

  const savingsTimeline = useMemo((): SavingsPoint[] => {
    const tripDate = `${settings.tripMonth}-01`;
    const events: FixedEvent[] = [
      ...fixedEvents,
      ...expenses.map((e) => ({
        date: e.date,
        label: e.label,
        delta: -e.amount,
        type: 'user-expense' as const,
      })),
      {
        date: tripDate,
        label: 'trip cost',
        delta: -settings.tripCost,
        type: 'trip' as const,
      },
    ];
    events.sort(
      (a, b) => a.date.localeCompare(b.date) || (a.delta > 0 ? -1 : 1),
    );

    const points: SavingsPoint[] = [
      {
        date: 'Mar 16',
        rawDate: '2026-03-16',
        balance: settings.startingBalance,
        label: 'start',
        type: 'start',
      },
    ];
    let running = settings.startingBalance;
    const grouped: Record<string, FixedEvent[]> = {};

    for (const e of events) {
      if (e.date < '2000-01-01') continue;
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    }

    for (const date of Object.keys(grouped).sort()) {
      const evs = grouped[date];
      for (const e of evs.filter((x) => x.delta > 0)) running += e.delta;
      for (const e of evs.filter((x) => x.delta < 0)) running += e.delta;

      const hasPayday = evs.some((e) => e.type === 'payday');
      const hasRent = evs.some((e) => e.type === 'rent');
      const hasTrip = evs.some((e) => e.type === 'trip');
      const hasFixed = evs.some((e) => e.type === 'fixed-expense');
      const hasUser = evs.some((e) => e.type === 'user-expense');

      let type: FixedEvent['type'] = 'payday';
      if (hasTrip && hasPayday) type = 'payday-rent';
      else if (hasTrip) type = 'trip';
      else if ((hasFixed || hasUser) && !hasPayday && !hasRent)
        type = 'user-expense';
      else if (hasPayday && (hasRent || hasFixed || hasUser))
        type = 'payday-rent';
      else if (hasRent) type = 'rent';

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
      });
    }
    return points;
  }, [
    fixedEvents,
    expenses,
    settings.tripMonth,
    settings.tripCost,
    settings.startingBalance,
  ]);

  const pocketTimeline = useMemo((): PocketPoint[] => {
    let balance = 0;
    return fridays.map((fridayDate, i) => {
      const weekRange = getWeekRange(fridayDate);
      const expenseTotal = expensesPerWeek.weekTotals[i] || 0;
      const expenseCount = expensesPerWeek.weekExpenseCounts[i] || 0;

      const spentFromExpenses = expenseCount > 0 ? expenseTotal : 0;
      const manualSpent = spentPerWeek[i] || 0;
      const spent = expenseCount > 0 ? spentFromExpenses : manualSpent;

      const avail = balance + settings.weeklyPocket;
      const finalSpent = Math.min(spent, avail);
      balance = avail - finalSpent;

      const type =
        finalSpent < settings.weeklyPocket
          ? 'surplus'
          : finalSpent > settings.weeklyPocket
            ? 'over'
            : 'flat';

      return {
        date: weekRange.label,
        rawDate: fridayDate,
        weekStart: weekRange.start,
        weekEnd: weekRange.end,
        balance: Math.round(balance),
        available: Math.round(avail),
        spent: Math.round(finalSpent),
        type,
        idx: i,
        expenseCount,
      };
    });
  }, [fridays, spentPerWeek, settings.weeklyPocket, expensesPerWeek]);

  const stats = useMemo(() => {
    const tripDate = `${settings.tripMonth}-01`;
    const pts = savingsTimeline;
    const prePt = [...pts].filter((p) => p.rawDate < tripDate).pop();
    const tripPt = pts.find((p) => p.rawDate === tripDate);
    const pre = prePt ? prePt.balance : settings.startingBalance;
    const post = tripPt ? tripPt.balance : pre - settings.tripCost;

    let running = settings.startingBalance;
    const grouped: Record<string, FixedEvent[]> = {};
    for (const e of fixedEvents) {
      if (e.date < '2000-01-01') continue;
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    }
    for (const date of Object.keys(grouped).sort()) {
      const evs = grouped[date];
      for (const e of evs.filter((x) => x.delta > 0)) running += e.delta;
      for (const e of evs.filter((x) => x.delta < 0)) running += e.delta;
    }
    const eoy = Math.round(running);

    return { pre, post, eoy };
  }, [
    savingsTimeline,
    settings.tripMonth,
    settings.startingBalance,
    settings.tripCost,
    fixedEvents,
  ]);

  const validation = useMemo(() => {
    const errors: { field: string; message: string }[] = [];
    const tripDate = `${settings.tripMonth}-01`;
    const post = stats.post;

    if (post < 0) {
      const mn = new Date(`${tripDate}T00:00:00`).toLocaleDateString('en-US', {
        month: 'long',
      });
      errors.push({
        field: 'tripMonth',
        message: `You would be $${Math.abs(post).toLocaleString()} short in ${mn}. Pick a later month.`,
      });
    } else if (post < 500) {
      const mn = new Date(`${tripDate}T00:00:00`).toLocaleDateString('en-US', {
        month: 'long',
      });
      errors.push({
        field: 'tripMonth',
        message: `Cutting it close. Only $${post.toLocaleString()} left after main expense in ${mn}.`,
      });
    }

    return { errors, hasError: errors.length > 0, isCritical: post < 0 };
  }, [stats.post, settings.tripMonth]);

  const addExpense = useCallback(
    (date: string, label: string, amount: number) => {
      if (!date || !label || Number.isNaN(amount) || amount <= 0) return false;

      const weekIdx = getWeekIndexForDate(date, fridays);

      const newExpense: Expense = {
        id: crypto.randomUUID(),
        date,
        label,
        amount,
        weekIdx: weekIdx ?? undefined,
      };

      setExpenses((prev) => [...prev, newExpense]);
      return true;
    },
    [fridays],
  );

  const removeExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateSpentForWeek = useCallback(
    (weekIdx: number, amount: number): { success: boolean; error?: string } => {
      const pt = pocketTimeline[weekIdx];
      if (!pt) return { success: false, error: 'Invalid week' };

      if (pt.expenseCount > 0) {
        return {
          success: false,
          error:
            'Expenses are logged for this week. Edit through the expense log.',
        };
      }

      const validAmount = Math.max(0, Math.min(amount, pt.available));

      setSpentPerWeek((prev) => {
        const next = [...prev];
        next[weekIdx] = validAmount;
        return next;
      });
      return { success: true };
    },
    [pocketTimeline],
  );

  const updateTripMonth = useCallback((month: string) => {
    setSettings((prev) => ({ ...prev, tripMonth: month }));
  }, []);

  const updateSettings = useCallback((newSettings: Partial<BudgetSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  return {
    isLoaded,
    expenses,
    spentPerWeek,
    settings,
    fridays,
    savingsTimeline,
    pocketTimeline,
    stats,
    validation,
    addExpense,
    removeExpense,
    updateSpentForWeek,
    updateTripMonth,
    updateSettings,
  };
}
