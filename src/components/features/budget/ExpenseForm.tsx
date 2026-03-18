'use client';

import { format, isValid } from 'date-fns';
import { CalendarIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ExpenseFormProps {
  onAdd: (date: string, label: string, amount: number) => boolean;
}

function getDefaultDate(): Date {
  const today = new Date();
  const minDate = new Date('2026-03-16');
  const maxDate = new Date('2026-12-31');

  if (today < minDate) return minDate;
  if (today > maxDate) return maxDate;
  return today;
}

export function ExpenseForm({ onAdd }: ExpenseFormProps) {
  const [date, setDate] = useState<Date | undefined>(getDefaultDate());
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

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
      setDate(getDefaultDate());
      setLabel('');
      setAmount('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !date && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date && isValid(date)
                  ? format(date, 'MMM d, yyyy')
                  : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) =>
                  d < new Date('2026-03-16') || d > new Date('2026-12-31')
                }
                defaultMonth={date}
              />
            </PopoverContent>
          </Popover>
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
              className="pr-7 font-mono"
            />
            <div className="absolute inset-y-0 right-0 flex w-7 flex-col border-input border-l">
              <button
                type="button"
                tabIndex={-1}
                onClick={() => stepAmount(1)}
                className="flex flex-1 cursor-pointer items-center justify-center rounded-tr-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronUp className="size-3" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => stepAmount(-1)}
                className="flex flex-1 cursor-pointer items-center justify-center rounded-br-md border-input border-t text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronDown className="size-3" />
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
