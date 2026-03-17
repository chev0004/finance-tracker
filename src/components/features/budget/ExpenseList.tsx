'use client';

import { format, parseISO } from 'date-fns';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Expense } from '@/types';

interface ExpenseListProps {
  expenses: Expense[];
  onRemove: (id: string) => void;
}

export function ExpenseList({ expenses, onRemove }: ExpenseListProps) {
  const sortedExpenses = [...expenses].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  if (sortedExpenses.length === 0) {
    return (
      <div className="py-4 text-muted-foreground/60 text-sm">
        No expenses logged yet.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px] w-full">
      <div className="space-y-1">
        {sortedExpenses.map((expense) => (
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
              <span className="font-mono text-red-500 text-sm">
                -${expense.amount.toFixed(2)}
              </span>
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
  );
}
