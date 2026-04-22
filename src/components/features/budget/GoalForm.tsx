'use client';

import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsivePicker } from '@/components/ui/responsive-picker';
import { cn } from '@/lib/utils';
import type { RecurringExpense, SavingsGoal } from '@/types';

interface GoalFormProps {
  goal?: SavingsGoal;
  recurringExpenses: RecurringExpense[];
  onSave: (goal: SavingsGoal) => void;
  onCancel: () => void;
}

interface LineItemDraft {
  id: string;
  label: string;
  amount: string;
}

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return 'Select date or range';
  if (!range.to || range.from.getTime() === range.to.getTime())
    return format(range.from, 'MMM d, yyyy');
  if (
    range.from.getFullYear() === range.to.getFullYear() &&
    range.from.getMonth() === range.to.getMonth()
  )
    return `${format(range.from, 'MMM d')}-${format(range.to, 'd, yyyy')}`;
  if (range.from.getFullYear() === range.to.getFullYear())
    return `${format(range.from, 'MMM d')} - ${format(range.to, 'MMM d, yyyy')}`;
  return `${format(range.from, 'MMM d, yyyy')} - ${format(range.to, 'MMM d, yyyy')}`;
}

export function GoalForm({
  goal,
  recurringExpenses,
  onSave,
  onCancel,
}: GoalFormProps) {
  const [name, setName] = useState(goal?.name ?? '');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    goal
      ? {
          from: parseISO(goal.startDate),
          to: parseISO(goal.endDate),
        }
      : undefined,
  );
  const [pauseIncome, setPauseIncome] = useState(goal?.pauseIncome ?? false);
  const [incomeResumeDate, setIncomeResumeDate] = useState<string | undefined>(
    goal?.incomeResumeDate,
  );
  const [pausedExpenseIds, setPausedExpenseIds] = useState<Set<string>>(
    new Set(goal?.pausedExpenseIds ?? []),
  );
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(
    goal?.lineItems.map((i) => ({
      id: i.id,
      label: i.label,
      amount: String(i.amount),
    })) ?? [{ id: crypto.randomUUID(), label: '', amount: '' }],
  );
  const [error, setError] = useState<string | null>(null);
  const [rangeCalendarMonths, setRangeCalendarMonths] = useState(1);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);

  const goalEnd = dateRange?.to ?? dateRange?.from;
  const goalEndStr = goalEnd ? format(goalEnd, 'yyyy-MM-dd') : null;
  useEffect(() => {
    if (goalEndStr && incomeResumeDate && incomeResumeDate < goalEndStr)
      setIncomeResumeDate(undefined);
  }, [goalEndStr, incomeResumeDate]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const apply = () => setRangeCalendarMonths(mq.matches ? 2 : 1);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const toggleExpense = (id: string) => {
    setPausedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: '', amount: '' },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateLineItem = (
    id: string,
    field: 'label' | 'amount',
    value: string,
  ) => {
    setLineItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    );
  };

  const handleSave = () => {
    setError(null);
    if (!name.trim()) {
      setError('Please enter a goal name.');
      return;
    }
    if (!dateRange?.from || !isValid(dateRange.from)) {
      setError('Please select at least a start date.');
      return;
    }
    const parsedItems = lineItems
      .filter((i) => i.label.trim() || i.amount)
      .map((i) => ({
        id: i.id,
        label: i.label.trim() || 'Unnamed',
        amount: Math.max(0, Number.parseFloat(i.amount) || 0),
      }));
    if (parsedItems.length === 0 || parsedItems.every((i) => i.amount === 0)) {
      setError('Add at least one line item with an amount.');
      return;
    }

    const from = dateRange.from;
    const to = dateRange.to ?? from;
    const goalEndStr = format(to, 'yyyy-MM-dd');
    if (pauseIncome && incomeResumeDate && incomeResumeDate < goalEndStr) {
      setError('Income resume date must be on or after the goal end date.');
      return;
    }

    onSave({
      id: goal?.id ?? crypto.randomUUID(),
      name: name.trim(),
      startDate: format(from, 'yyyy-MM-dd'),
      endDate: format(to, 'yyyy-MM-dd'),
      lineItems: parsedItems,
      pauseIncome,
      incomeResumeDate: pauseIncome ? incomeResumeDate : undefined,
      pausePocket: false,
      pausedExpenseIds: [...pausedExpenseIds],
    });
  };

  const total = lineItems.reduce(
    (s, i) => s + (Number.parseFloat(i.amount) || 0),
    0,
  );

  return (
    <Card className="border-border/50 bg-card/50 p-4">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-red-500 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Goal Name
            </Label>
            <Input
              placeholder="e.g. trip, new car, laptop"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Date or range
            </Label>
            <ResponsivePicker
              open={rangeOpen}
              onOpenChange={setRangeOpen}
              sheetTitle="Goal dates"
              popoverContentClassName="w-auto p-0"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'h-11 min-h-11 w-full justify-start text-left font-normal text-base sm:h-9 sm:min-h-9 sm:text-sm',
                    !dateRange?.from && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {formatRangeLabel(dateRange)}
                </Button>
              }
            >
              {(close) => (
                <div className="flex flex-col items-center">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={rangeCalendarMonths}
                    defaultMonth={dateRange?.from}
                    className="mx-auto w-full max-w-[100vw] rounded-lg"
                  />
                  <div className="flex w-full justify-end gap-2 px-3 pb-3 sm:px-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange(undefined)}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      variant="muted"
                      size="sm"
                      onClick={close}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </ResponsivePicker>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Cost Breakdown
            </Label>
            {total > 0 && (
              <span className="font-mono text-muted-foreground text-xs">
                Total: ${total.toLocaleString()}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <Input
                  placeholder="e.g. plane ticket, accommodation"
                  value={item.label}
                  onChange={(e) =>
                    updateLineItem(item.id, 'label', e.target.value)
                  }
                  className="min-w-0 flex-1"
                />
                <CurrencyInput
                  type="number"
                  placeholder="0"
                  min={0}
                  value={item.amount}
                  onChange={(e) =>
                    updateLineItem(item.id, 'amount', e.target.value)
                  }
                  className="w-full sm:w-28"
                />
                {lineItems.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-500"
                    onClick={() => removeLineItem(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground text-xs hover:text-foreground"
            onClick={addLineItem}
          >
            <Plus className="mr-1 h-3 w-3" /> Add Item
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              'cursor-pointer rounded-md border px-3 py-1.5 text-xs transition-colors',
              pauseIncome
                ? 'border-border bg-muted text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setPauseIncome(!pauseIncome)}
          >
            {pauseIncome && '\u2713 '}No income during this period
          </button>
        </div>

        {pauseIncome && (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Income resumes on
            </Label>
            <p className="text-[11px] text-muted-foreground/70">
              Optional. When you get paid again after the goal. Leave empty to
              resume on the first payday after the goal end.
            </p>
            <ResponsivePicker
              open={resumeOpen}
              onOpenChange={setResumeOpen}
              sheetTitle="Income resumes on"
              popoverContentClassName="w-auto p-0"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'h-11 min-h-11 w-full justify-start text-left font-normal text-base sm:h-9 sm:min-h-9 sm:w-auto sm:text-sm',
                    !incomeResumeDate && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {incomeResumeDate
                    ? format(parseISO(incomeResumeDate), 'MMM d, yyyy')
                    : 'Select date'}
                </Button>
              }
            >
              {(close) => (
                <Calendar
                  mode="single"
                  selected={
                    incomeResumeDate ? parseISO(incomeResumeDate) : undefined
                  }
                  onSelect={(d) => {
                    if (d && isValid(d)) {
                      setIncomeResumeDate(format(d, 'yyyy-MM-dd'));
                      close();
                    }
                  }}
                  defaultMonth={
                    incomeResumeDate
                      ? parseISO(incomeResumeDate)
                      : (dateRange?.to ?? dateRange?.from)
                  }
                  disabled={goalEnd ? { before: goalEnd } : undefined}
                  className="mx-auto w-full max-w-[100vw] rounded-lg"
                />
              )}
            </ResponsivePicker>
            {incomeResumeDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs hover:text-foreground"
                onClick={() => setIncomeResumeDate(undefined)}
              >
                Clear (resume first payday after goal)
              </Button>
            )}
          </div>
        )}

        {recurringExpenses.length > 0 && (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Pause recurring expenses
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {recurringExpenses.map((exp) => (
                <button
                  key={exp.id}
                  type="button"
                  className={cn(
                    'cursor-pointer rounded-md border px-3 py-1.5 text-xs transition-colors',
                    pausedExpenseIds.has(exp.id)
                      ? 'border-border bg-muted text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => toggleExpense(exp.id)}
                >
                  {pausedExpenseIds.has(exp.id) && '\u2713 '}
                  {exp.label} (${exp.amount})
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/50">
              Selected expenses won&apos;t be charged during this goal&apos;s
              dates.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} variant="muted">
            {goal ? 'Update Goal' : 'Add Goal'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
