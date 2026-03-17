'use client';

import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { GoalStat, RecurringExpense, SavingsGoal } from '@/types';

interface GoalCardProps {
  goal: SavingsGoal;
  stat: GoalStat;
  recurringExpenses: RecurringExpense[];
  onEdit: () => void;
  onDelete: () => void;
}

function formatDateRange(startDate: string, endDate: string): string {
  const s = parseISO(startDate);
  const e = parseISO(endDate);
  if (startDate === endDate) return format(s, 'MMM d, yyyy');
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth())
      return `${format(s, 'MMM d')}-${format(e, 'd, yyyy')}`;
    return `${format(s, 'MMM d')} - ${format(e, 'MMM d, yyyy')}`;
  }
  return `${format(s, 'MMM d, yyyy')} - ${format(e, 'MMM d, yyyy')}`;
}

export function GoalCard({
  goal,
  stat,
  recurringExpenses,
  onEdit,
  onDelete,
}: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const dateLabel = formatDateRange(goal.startDate, goal.endDate);

  const pausedNames = goal.pausedExpenseIds
    .map((id) => recurringExpenses.find((e) => e.id === id)?.label)
    .filter(Boolean);

  const statusColor = !stat.isFeasible
    ? 'text-red-500'
    : stat.isWarning
      ? 'text-amber-500'
      : 'text-emerald-500';

  const statusBorder = !stat.isFeasible
    ? 'border-red-500/20'
    : stat.isWarning
      ? 'border-amber-500/20'
      : 'border-border/50';

  return (
    <Card className={cn('bg-card/50 p-4 transition-colors', statusBorder)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium text-sm">{goal.name}</h3>
            {goal.pauseIncome && (
              <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400">
                no income
              </span>
            )}
            {pausedNames.length > 0 && (
              <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
                pauses {pausedNames.join(', ')}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-muted-foreground">{dateLabel}</span>
            <span className="font-medium font-mono">
              ${stat.totalCost.toLocaleString()}
            </span>
            <span className={cn('font-mono', statusColor)}>
              ${stat.preBalance.toLocaleString()} &rarr; $
              {stat.postBalance.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-red-500"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {goal.lineItems.length > 1 && (
        <button
          type="button"
          className="mt-2 flex cursor-pointer items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {goal.lineItems.length} items
        </button>
      )}

      {(expanded || goal.lineItems.length === 1) && (
        <div className="mt-2 space-y-1 border-border/30 border-t pt-2">
          {goal.lineItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono">${item.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
