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
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsivePicker } from '@/components/ui/responsive-picker';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface MobileAddExpenseSheetProps {
  balanceStartDate: string;
  onAdd: (date: string, label: string, amount: number) => boolean;
  trigger: React.ReactNode;
}

function getDefaultDate(minDate: Date, maxDate: Date): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < minDate) return minDate;
  if (today > maxDate) return maxDate;
  return today;
}

export function MobileAddExpenseSheet({
  balanceStartDate,
  onAdd,
  trigger,
}: MobileAddExpenseSheetProps) {
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    if (open) {
      setDate(getDefaultDate(minDate, maxDate));
      setLabel('');
      setAmount('');
      setError(null);
    }
  }, [open, minDate, maxDate]);

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
      setOpen(false);
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex h-[70dvh] max-h-[70dvh] flex-col sm:hidden"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>Log expense</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pt-4">
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-medium text-muted-foreground text-sm">
              Amount
            </Label>
            <div className="relative">
              <CurrencyInput
                ref={amountRef}
                type="number"
                placeholder="0.00"
                min={0}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-14 min-h-14 pr-12 md:h-14 md:min-h-14"
                inputClassName="py-3.5 font-mono text-2xl md:py-3.5 md:text-2xl"
                prefixClassName="text-xl md:text-xl"
              />
              <div className="absolute inset-y-0 right-0 flex w-12 flex-col border-input border-l">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => stepAmount(1)}
                  className="flex min-h-7 flex-1 cursor-pointer items-center justify-center rounded-tr-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronUp className="size-5" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => stepAmount(-1)}
                  className="flex min-h-7 flex-1 cursor-pointer items-center justify-center rounded-br-md border-input border-t text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronDown className="size-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-muted-foreground text-sm">
              What for
            </Label>
            <Input
              placeholder="e.g. groceries, coffee"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-muted-foreground text-sm">
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
                    'h-12 w-full justify-start text-left font-normal text-base',
                    !date && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-3 size-5" />
                  {date && isValid(date)
                    ? format(date, 'EEE, MMM d, yyyy')
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

          <Button
            variant="muted"
            size="lg"
            className="h-14 font-semibold text-base"
            onClick={handleSubmit}
          >
            Log expense
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
