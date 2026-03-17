'use client';

import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Expense } from '@/types';

interface ExpenseListProps {
  expenses: Expense[];
  paydays: string[];
  payFrequency: 'weekly' | 'biweekly';
  onRemove: (id: string) => void;
  onUpdateAmount: (id: string, amount: number) => void;
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
  onRemove,
  onUpdateAmount,
}: ExpenseListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const daysBack = payFrequency === 'biweekly' ? 13 : 6;

  const periods = useMemo<PeriodGroup[]>(() => {
    const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));

    return paydays.map((payday) => {
      const endD = new Date(`${payday}T00:00:00`);
      const startD = new Date(endD);
      startD.setDate(endD.getDate() - daysBack);
      const start = startD.toISOString().slice(0, 10);
      const fmtD = (d: Date) =>
        d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

      return {
        start,
        end: payday,
        label: `${fmtD(startD)} - ${fmtD(endD)}`,
        expenses: sorted.filter((e) => e.date >= start && e.date <= payday),
      };
    });
  }, [paydays, expenses, daysBack]);

  const defaultIdx = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    for (let i = periods.length - 1; i >= 0; i--) {
      if (today >= periods[i].start && today <= periods[i].end) return i;
    }
    for (let i = periods.length - 1; i >= 0; i--) {
      if (periods[i].expenses.length > 0) return i;
    }
    return Math.max(0, periods.length - 1);
  }, [periods]);

  const [activeIdx, setActiveIdx] = useState(defaultIdx);

  useEffect(() => {
    setActiveIdx(defaultIdx);
  }, [defaultIdx]);

  const clampIdx = (i: number) => Math.max(0, Math.min(periods.length - 1, i));
  const active = periods[activeIdx];

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditValue(String(expense.amount));
  };

  const commitEdit = () => {
    if (editingId) {
      const num = Number.parseFloat(editValue);
      if (!Number.isNaN(num) && num > 0) {
        onUpdateAmount(editingId, num);
      }
    }
    setEditingId(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  if (expenses.length === 0) {
    return (
      <div className="py-4 text-muted-foreground/60 text-sm">
        No expenses logged yet.
      </div>
    );
  }

  const periodLabel = payFrequency === 'biweekly' ? 'Period' : 'Week';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          disabled={activeIdx <= 0}
          onClick={() => setActiveIdx(clampIdx(activeIdx - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <span className="text-muted-foreground text-xs">
            {periodLabel} {activeIdx + 1} of {periods.length}
          </span>
          {active && <div className="font-medium text-sm">{active.label}</div>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          disabled={activeIdx >= periods.length - 1}
          onClick={() => setActiveIdx(clampIdx(activeIdx + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {active && active.expenses.length > 0 ? (
        <ScrollArea className="h-[180px] w-full">
          <div className="space-y-1">
            {active.expenses.map((expense) => (
              <div
                key={expense.id}
                className="group flex cursor-default items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="shrink-0 font-mono text-muted-foreground text-xs">
                    {format(parseISO(expense.date), 'MMM d')}
                  </span>
                  <span className="truncate text-sm">{expense.label}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {editingId === expense.id ? (
                    <div className="relative w-20">
                      <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground text-xs">
                        $
                      </span>
                      <Input
                        autoFocus
                        type="number"
                        min={0}
                        step={0.01}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="h-7 pl-5 text-right font-mono text-xs"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="cursor-pointer font-mono text-red-500 text-sm transition-colors hover:text-red-400"
                      onClick={() => startEdit(expense)}
                    >
                      -${expense.amount.toFixed(2)}
                    </button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground opacity-0 transition-[opacity,color] hover:text-red-500 group-hover:opacity-100"
                    onClick={() => onRemove(expense.id)}
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
