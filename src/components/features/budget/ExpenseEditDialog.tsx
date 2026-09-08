'use client';

import { format, isValid, parseISO } from 'date-fns';
import {
  ArrowRightLeft,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsivePicker } from '@/components/ui/responsive-picker';
import { cn } from '@/lib/utils';
import type { Expense } from '@/types';

interface ExpenseEditDialogProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balanceStartDate: string;
  onSave: (expense: Expense) => void;
  onMoveToGoal: (expense: Expense) => void;
}

export function ExpenseEditDialog({
  expense,
  open,
  onOpenChange,
  balanceStartDate,
  onSave,
  onMoveToGoal,
}: ExpenseEditDialogProps) {
  const { minDate, maxDate } = useMemo(() => {
    const parsedMin = parseISO(balanceStartDate);
    const parsedMinValid = isValid(parsedMin) ? parsedMin : new Date();
    parsedMinValid.setHours(0, 0, 0, 0);

    const startYear = parsedMinValid.getFullYear();
    const chartEndYear = startYear + 4;
    const parsedMax = parseISO(`${chartEndYear}-12-31`);
    const parsedMaxValid = isValid(parsedMax) ? parsedMax : parsedMinValid;
    parsedMaxValid.setHours(0, 0, 0, 0);

    return { minDate: parsedMinValid, maxDate: parsedMaxValid };
  }, [balanceStartDate]);

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !expense) return;
    const d = parseISO(expense.date);
    setDate(isValid(d) ? d : undefined);
    setLabel(expense.label);
    setAmount(String(expense.amount));
    setError(null);
  }, [open, expense]);

  useEffect(() => {
    if (!open || !date || !isValid(date)) return;
    if (date < minDate) setDate(minDate);
    if (date > maxDate) setDate(maxDate);
  }, [open, date, minDate, maxDate]);

  const stepAmount = (dir: 1 | -1) => {
    const current = Number.parseFloat(amount) || 0;
    const next = Math.max(0, +(current + dir).toFixed(2));
    setAmount(next === 0 ? '' : String(next));
    amountRef.current?.focus();
  };

  const getExpense = (): Expense | null => {
    setError(null);
    if (!expense) return null;

    if (!date || !isValid(date)) {
      setError('Please select a valid date');
      return null;
    }
    if (!label.trim()) {
      setError('Please enter a description');
      return null;
    }
    const numAmount = Number.parseFloat(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return null;
    }

    return {
      ...expense,
      date: format(date, 'yyyy-MM-dd'),
      label: label.trim(),
      amount: numAmount,
    };
  };

  const handleSave = () => {
    const updated = getExpense();
    if (!updated) return;
    onSave(updated);
    onOpenChange(false);
  };

  const handleMoveToGoal = () => {
    const updated = getExpense();
    if (!updated) return;
    onMoveToGoal(updated);
    onOpenChange(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit expense</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-red-500 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="min-w-0 space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              What for
            </Label>
            <Input
              placeholder="e.g. groceries"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-10 w-full min-w-0 text-base sm:min-h-9 sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0 space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                Date
              </Label>
              <ResponsivePicker
                open={dateOpen}
                onOpenChange={setDateOpen}
                sheetTitle="Expense date"
                popoverContentClassName="w-auto p-0"
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'h-11 min-h-11 w-full justify-start text-left font-normal text-base sm:h-9 sm:min-h-9 sm:text-sm',
                      !date && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {date && isValid(date)
                      ? format(date, 'MMM d, yyyy')
                      : 'Select date'}
                  </Button>
                }
              >
                {(close) => (
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      if (d) close();
                    }}
                    disabled={(d) => d < minDate || d > maxDate}
                    defaultMonth={date}
                    className="mx-auto w-full max-w-[100vw] rounded-lg"
                  />
                )}
              </ResponsivePicker>
            </div>

            <div className="min-w-0 space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                Amount ($)
              </Label>
              <div className="relative">
                <Input
                  ref={amountRef}
                  type="number"
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full min-w-0 pr-9 font-mono sm:pr-7"
                />
                <div className="absolute inset-y-0 right-0 flex w-9 flex-col border-input border-l sm:w-7">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => stepAmount(1)}
                    className="flex min-h-[1.375rem] flex-1 cursor-pointer items-center justify-center rounded-tr-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:min-h-0"
                  >
                    <ChevronUp className="size-4 sm:size-3" />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => stepAmount(-1)}
                    className="flex min-h-[1.375rem] flex-1 cursor-pointer items-center justify-center rounded-br-md border-input border-t text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:min-h-0"
                  >
                    <ChevronDown className="size-4 sm:size-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleMoveToGoal}>
            <ArrowRightLeft className="h-4 w-4" />
            Move to savings
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="muted" onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
