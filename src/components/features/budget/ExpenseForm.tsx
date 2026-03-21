'use client';

import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon, ChevronDown, ChevronUp } from 'lucide-react';
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsivePicker } from '@/components/ui/responsive-picker';
import { cn } from '@/lib/utils';

interface ExpenseFormProps {
  balanceStartDate: string;
  onAdd: (date: string, label: string, amount: number) => boolean;
}

function getDefaultDate(minDate: Date, maxDate: Date): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < minDate) return minDate;
  if (today > maxDate) return maxDate;
  return today;
}

export function ExpenseForm({ balanceStartDate, onAdd }: ExpenseFormProps) {
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

  const [date, setDate] = useState<Date | undefined>(() =>
    getDefaultDate(minDate, maxDate),
  );
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!date || !isValid(date) || date < minDate || date > maxDate) {
      setDate(getDefaultDate(minDate, maxDate));
    }
  }, [date, minDate, maxDate]);

  const stepAmount = (dir: 1 | -1) => {
    const current = Number.parseFloat(amount) || 0;
    const next = Math.max(0, +(current + dir).toFixed(2));
    setAmount(next === 0 ? '' : String(next));
    amountRef.current?.focus();
  };

  const handleSubmit = () => {
    setError(null);

    if (!date || !isValid(date)) {
      setError('Please select a valid date');
      return;
    }
    if (!label.trim()) {
      setError('Please enter a description');
      return;
    }
    const numAmount = Number.parseFloat(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const success = onAdd(dateStr, label.trim(), numAmount);

    if (success) {
      setDate(getDefaultDate(minDate, maxDate));
      setLabel('');
      setAmount('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-red-500 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
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

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            What for
          </Label>
          <Input
            placeholder="e.g. groceries"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="space-y-2">
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
              className="pr-9 font-mono sm:pr-7"
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

        <Button onClick={handleSubmit} variant="muted">
          + Add Expense
        </Button>
      </div>
    </div>
  );
}
