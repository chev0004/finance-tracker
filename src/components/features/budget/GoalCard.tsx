'use client';

import { format, parseISO } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from 'lucide-react';
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
  onToggleHidden: () => void;
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
  onToggleHidden,
}: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const dateLabel = formatDateRange(goal.startDate, goal.endDate);
  const finished = goal.endDate < format(new Date(), 'yyyy-MM-dd');
  const amountClassName = finished ? 'text-red-400' : 'text-foreground';
  const amountPrefix = finished ? '-' : '';

  const pausedNames = goal.pausedExpenseIds
    .map((id) => recurringExpenses.find((e) => e.id === id)?.label)
    .filter(Boolean);

  const statusBorder = !stat.isFeasible
    ? 'border-red-500/20'
    : stat.isWarning
      ? 'border-amber-500/20'
      : 'border-border/50';

  const details: string[] = [];
  if (goal.pauseIncome) {
    details.push('no income');
    if (goal.incomeResumeDate)
      details.push(
        `resumes ${format(parseISO(goal.incomeResumeDate), 'MMM d')}`,
      );
  }
  if (pausedNames.length > 0) details.push(`pauses ${pausedNames.join(', ')}`);

  return (
    <Card
      className={cn(
        'gap-0 bg-card/50 p-3 transition-colors hover:border-border/80 hover:bg-card/70',
        statusBorder,
        goal.hidden && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="-m-1 flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-md p-1 text-left transition-colors hover:bg-muted/40 hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="mt-0.5 shrink-0 text-muted-foreground">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                'truncate font-medium text-sm',
                goal.hidden && 'line-through',
              )}
            >
              {goal.name}
            </h3>
            {!expanded && (
              <p className="mt-0.5 truncate text-muted-foreground text-xs">
                {dateLabel} ·{' '}
                <span className={cn('font-mono', amountClassName)}>
                  {amountPrefix}${stat.totalCost.toLocaleString()}
                </span>
              </p>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onToggleHidden}
            title={
              goal.hidden ? 'Show in calculations' : 'Hide from calculations'
            }
          >
            {goal.hidden ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
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

      {expanded && (
        <div className="mt-3 space-y-2">
          <p className="break-words text-muted-foreground text-xs">
            {dateLabel} ·{' '}
            <span className={cn('font-mono', amountClassName)}>
              {amountPrefix}${stat.totalCost.toLocaleString()}
            </span>
            {details.length > 0 && ` · ${details.join(' · ')}`}
          </p>

          <div className="space-y-1 border-border/30 border-t pt-2">
            {goal.lineItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className={cn('font-mono', amountClassName)}>
                  {amountPrefix}${item.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
