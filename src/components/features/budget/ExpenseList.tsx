'use client';

import { format, parseISO } from 'date-fns';
import { Pencil, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NavStepper } from '@/components/ui/nav-stepper';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getPocketPeriodRange } from '@/lib/pocketPeriods';
import { getLocalDateString } from '@/lib/utils';
import type { Expense, PayFrequency } from '@/types';
import { ExpenseEditDialog } from './ExpenseEditDialog';

interface ExpenseListProps {
  expenses: Expense[];
  paydays: string[];
  payFrequency: PayFrequency;
  payInterval?: number;
  balanceStartDate: string;
  activePeriodStart?: string | null;
  onRemove: (id: string) => void;
  onUpdateExpense: (expense: Expense) => void;
  onActivePeriodChange?: (period: {
    start: string;
    end: string;
    label: string;
    index: number;
  }) => void;
}

interface PeriodGroup {
  label: string;
  start: string;
  end: string;
  expenses: Expense[];
}

export function ExpenseList({
  expenses,
  paydays,
  payFrequency,
  payInterval,
  balanceStartDate,
  activePeriodStart,
  onRemove,
  onUpdateExpense,
  onActivePeriodChange,
}: ExpenseListProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const periods = useMemo<PeriodGroup[]>(() => {
    const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));

    return paydays.map((payday, i) => {
      const range = getPocketPeriodRange(
        payday,
        paydays[i + 1],
        payFrequency,
        payInterval,
      );
      return {
        start: range.start,
        end: range.end,
        label: range.label,
        expenses: sorted.filter(
          (e) => e.date >= range.start && e.date <= range.end,
        ),
      };
    });
  }, [paydays, expenses, payFrequency, payInterval]);

  const defaultIdx = useMemo(() => {
    const today = getLocalDateString();
    for (let i = periods.length - 1; i >= 0; i--) {
      if (today >= periods[i].start && today <= periods[i].end) return i;
    }
    for (let i = periods.length - 1; i >= 0; i--) {
      if (periods[i].expenses.length > 0) return i;
    }
    return Math.max(0, periods.length - 1);
  }, [periods]);

  const [activeIdx, setActiveIdx] = useState(defaultIdx);
  const appliedActivePeriodStartRef = useRef<string | null>(null);

  useEffect(() => {
    if (activePeriodStart) return;
    setActiveIdx(defaultIdx);
  }, [activePeriodStart, defaultIdx]);

  useEffect(() => {
    if (!activePeriodStart) return;
    if (appliedActivePeriodStartRef.current === activePeriodStart) return;
    const nextIdx = periods.findIndex((p) => p.start === activePeriodStart);
    if (nextIdx >= 0) {
      appliedActivePeriodStartRef.current = activePeriodStart;
      setActiveIdx(nextIdx);
    }
  }, [activePeriodStart, periods]);

  useEffect(() => {
    if (!onActivePeriodChange) return;
    const active = periods[activeIdx];
    if (!active) return;
    onActivePeriodChange({
      start: active.start,
      end: active.end,
      label: active.label,
      index: activeIdx,
    });
  }, [activeIdx, periods, onActivePeriodChange]);

  const clampIdx = (i: number) => Math.max(0, Math.min(periods.length - 1, i));
  const active = periods[activeIdx];

  if (periods.length === 0) {
    return (
      <div className="py-4 text-muted-foreground/60 text-sm">
        No pocket periods in range.
      </div>
    );
  }

  const periodLabel =
    payFrequency === 'weekly'
      ? 'Week'
      : payFrequency === 'biweekly'
        ? 'Biweek'
        : 'Period';

  return (
    <div className="space-y-3">
      <ExpenseEditDialog
        expense={editingExpense}
        open={editingExpense !== null}
        onOpenChange={(open) => {
          if (!open) setEditingExpense(null);
        }}
        balanceStartDate={balanceStartDate}
        onSave={onUpdateExpense}
      />

      <NavStepper
        disablePrev={activeIdx <= 0}
        disableNext={activeIdx >= periods.length - 1}
        onPrev={() => setActiveIdx(clampIdx(activeIdx - 1))}
        onNext={() => setActiveIdx(clampIdx(activeIdx + 1))}
      >
        <div className="text-center">
          <span className="text-muted-foreground text-xs">
            {periodLabel} {activeIdx + 1} of {periods.length}
          </span>
          {active && <div className="font-medium text-sm">{active.label}</div>}
        </div>
      </NavStepper>

      {active && active.expenses.length > 0 ? (
        <ScrollArea className="[&_[data-radix-scroll-area-viewport]>div]:block! h-[min(40rem,calc(100dvh-14rem))] min-h-[11.25rem] w-full">
          <div className="space-y-1 pr-4">
            {active.expenses.map((expense) => (
              <div
                key={expense.id}
                className="group flex max-w-full cursor-default items-center justify-between gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="shrink-0 font-mono text-muted-foreground text-xs">
                    {format(parseISO(expense.date), 'MMM d')}
                  </span>
                  <span className="truncate text-sm">{expense.label}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="font-mono text-red-500 text-sm">
                    -${expense.amount.toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground opacity-100 transition-[opacity,color] hover:text-foreground sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() => setEditingExpense(expense)}
                    aria-label="Edit expense"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground opacity-100 transition-[opacity,color] hover:text-red-500 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() => onRemove(expense.id)}
                    aria-label="Remove expense"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="py-4 text-center text-muted-foreground/60 text-sm">
          No expenses this {periodLabel.toLowerCase()}.
        </div>
      )}

      {active && active.expenses.length > 0 && (
        <div className="flex justify-end text-muted-foreground text-xs">
          Total: -$
          {active.expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}
        </div>
      )}
    </div>
  );
}
