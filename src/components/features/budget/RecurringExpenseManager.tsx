'use client';

import { Pencil, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveSelect,
  type ResponsiveSelectOption,
} from '@/components/ui/responsive-select';
import { cn } from '@/lib/utils';
import type { IncomeSource, RecurringExpense } from '@/types';

const DEDUCT_ANCHOR_CALENDAR = 'calendar';

interface RecurringExpenseManagerProps {
  expenses: RecurringExpense[];
  incomeSources: IncomeSource[];
  onAdd: (expense: Omit<RecurringExpense, 'id'>) => void;
  onUpdate: (expense: RecurringExpense) => void;
  onRemove: (id: string) => void;
  projectionStartDate?: string;
  startOpen?: boolean;
  onCancel?: () => void;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function buildMonthOptions(
  projectionStartDate: string,
): { value: string; label: string }[] {
  const startYear = new Date(
    `${projectionStartDate.slice(0, 7)}-01T00:00:00`,
  ).getFullYear();
  const out: { value: string; label: string }[] = [];
  for (let y = startYear; y <= startYear + 4; y++) {
    for (let m = 1; m <= 12; m++) {
      const value = `${y}-${m < 10 ? '0' : ''}${m}`;
      out.push({ value, label: `${MONTH_NAMES[m - 1]} ${y}` });
    }
  }
  return out;
}

function monthLabel(value: string): string {
  const [y, m] = value.split('-').map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

type DayPreset = '1' | '15' | 'end' | 'custom';

function presetForDay(d: number): DayPreset {
  if (d === 1) return '1';
  if (d === 15) return '15';
  if (d === 0) return 'end';
  return 'custom';
}

const DEFAULT_START = '2026-01-01';

export function RecurringExpenseManager({
  expenses,
  incomeSources,
  onAdd,
  onUpdate,
  onRemove,
  projectionStartDate = DEFAULT_START,
  startOpen = false,
  onCancel,
}: RecurringExpenseManagerProps) {
  const monthOptions = useMemo(
    () => buildMonthOptions(projectionStartDate),
    [projectionStartDate],
  );
  const projectionEndMonth = useMemo(() => {
    const y = new Date(
      `${projectionStartDate.slice(0, 7)}-01T00:00:00`,
    ).getFullYear();
    return `${y + 4}-12`;
  }, [projectionStartDate]);
  const projectionStartMonth = projectionStartDate.slice(0, 7);

  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(
    startOpen ? 'add' : null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [dayPreset, setDayPreset] = useState<DayPreset>('1');
  const [customDay, setCustomDay] = useState('');
  const [startMonth, setStartMonth] = useState(projectionStartMonth);
  const [endMonth, setEndMonth] = useState(projectionEndMonth);
  const [endOngoing, setEndOngoing] = useState(true);
  const [deductFromPocket, setDeductFromPocket] = useState(false);
  const [deductIncomeSourceId, setDeductIncomeSourceId] = useState('');

  const incomeSourceMatchOptions = useMemo((): ResponsiveSelectOption[] => {
    const rows: ResponsiveSelectOption[] = [
      { value: DEDUCT_ANCHOR_CALENDAR, label: 'None' },
    ];
    for (const s of incomeSources) {
      rows.push({ value: s.id, label: s.name });
    }
    return rows;
  }, [incomeSources]);

  const endMonthOptions = useMemo(
    () => monthOptions.filter((m) => m.value >= startMonth),
    [monthOptions, startMonth],
  );

  const resolvedDay =
    dayPreset === 'end'
      ? 0
      : dayPreset === 'custom'
        ? Number.parseInt(customDay, 10) || 1
        : Number.parseInt(dayPreset, 10);

  const sorted = [...expenses].sort((a, b) => {
    const sm = a.startMonth.localeCompare(b.startMonth);
    if (sm !== 0) return sm;
    const aM = Boolean(a.deductIncomeSourceId);
    const bM = Boolean(b.deductIncomeSourceId);
    if (aM && bM) return a.label.localeCompare(b.label);
    if (aM) return 1;
    if (bM) return -1;
    const aDay = a.dayOfMonth === 0 ? 32 : a.dayOfMonth;
    const bDay = b.dayOfMonth === 0 ? 32 : b.dayOfMonth;
    return aDay - bDay;
  });

  const resetForm = () => {
    setLabel('');
    setAmount('');
    setDayPreset('1');
    setCustomDay('');
    setStartMonth(projectionStartMonth);
    setEndMonth(projectionEndMonth);
    setEndOngoing(true);
    setDeductFromPocket(false);
    setDeductIncomeSourceId('');
    setFormMode(null);
    setEditingId(null);
  };

  const startAdd = () => {
    resetForm();
    setFormMode('add');
  };

  const startEdit = (exp: RecurringExpense) => {
    setEditingId(exp.id);
    setFormMode('edit');
    setLabel(exp.label);
    setAmount(String(exp.amount));
    const p = presetForDay(exp.dayOfMonth);
    setDayPreset(p);
    setCustomDay(p === 'custom' ? String(exp.dayOfMonth) : '');
    setStartMonth(exp.startMonth);
    setEndOngoing(exp.endMonth == null);
    setEndMonth(exp.endMonth ?? projectionEndMonth);
    setDeductFromPocket(exp.deductFromPocket ?? false);
    setDeductIncomeSourceId(exp.deductIncomeSourceId ?? '');
  };

  const handleSave = () => {
    const numAmount = Number.parseFloat(amount) || 0;
    if (!label.trim() || numAmount <= 0) return;
    const resolvedDeductSource = deductIncomeSourceId.trim() || undefined;
    const day = resolvedDeductSource
      ? 1
      : resolvedDay === 0
        ? 0
        : Math.min(31, Math.max(1, resolvedDay));
    const resolvedEndMonth = endOngoing ? null : endMonth;

    if (formMode === 'edit' && editingId) {
      onUpdate({
        id: editingId,
        label: label.trim(),
        amount: numAmount,
        dayOfMonth: day,
        startMonth,
        endMonth: resolvedEndMonth,
        deductFromPocket,
        deductIncomeSourceId: resolvedDeductSource,
      });
    } else {
      onAdd({
        label: label.trim(),
        amount: numAmount,
        dayOfMonth: day,
        startMonth,
        endMonth: resolvedEndMonth,
        deductFromPocket,
        deductIncomeSourceId: resolvedDeductSource,
      });
    }
    resetForm();
  };

  const presetBtn = (value: DayPreset, text: string) => (
    <button
      type="button"
      className={cn(
        'flex-1 rounded-md px-2 py-1.5 text-xs transition-all',
        dayPreset === value
          ? 'bg-background text-foreground shadow-sm'
          : 'cursor-pointer text-muted-foreground hover:text-foreground',
      )}
      onClick={() => setDayPreset(value)}
    >
      {text}
    </button>
  );

  const formUI = (
    <div className="min-w-0 space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-w-0 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Label
          </Label>
          <Input
            placeholder="e.g. Rent"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Amount
          </Label>
          <CurrencyInput
            type="number"
            min={0}
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {incomeSources.length > 0 && (
          <div className="min-w-0 space-y-1 sm:col-span-2">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Matched source
            </Label>
            <ResponsiveSelect
              value={
                deductIncomeSourceId
                  ? deductIncomeSourceId
                  : DEDUCT_ANCHOR_CALENDAR
              }
              onValueChange={(v) => {
                if (v === DEDUCT_ANCHOR_CALENDAR) {
                  setDeductIncomeSourceId('');
                } else {
                  setDeductIncomeSourceId(v);
                }
              }}
              options={incomeSourceMatchOptions}
              sheetTitle="Match income source"
              triggerClassName="w-full"
            />
          </div>
        )}
        {!deductIncomeSourceId && (
          <div className="min-w-0 space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Day
            </Label>
            <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
              {presetBtn('1', '1st')}
              {presetBtn('15', 'Mid')}
              {presetBtn('end', 'End')}
              {presetBtn('custom', '#')}
            </div>
            {dayPreset === 'custom' && (
              <Input
                type="number"
                min={1}
                max={31}
                placeholder="1-31"
                value={customDay}
                onChange={(e) => setCustomDay(e.target.value)}
                className="mt-1 font-mono"
              />
            )}
          </div>
        )}
        <div
          className={cn(
            'min-w-0 space-y-1 sm:col-span-2',
            deductIncomeSourceId && incomeSources.length > 0 && 'sm:col-span-4',
          )}
        >
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Months
          </Label>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ResponsiveSelect
              value={startMonth}
              onValueChange={setStartMonth}
              options={monthOptions}
              placeholder="Start"
              sheetTitle="Start month"
              triggerClassName="min-h-11 min-w-0 flex-1 sm:max-w-[140px]"
            />
            <span className="shrink-0 text-muted-foreground text-xs">-</span>
            {endOngoing ? (
              <span className="text-muted-foreground text-xs">ongoing</span>
            ) : (
              <ResponsiveSelect
                value={endMonth}
                onValueChange={setEndMonth}
                options={endMonthOptions}
                placeholder="End"
                sheetTitle="End month"
                triggerClassName="min-h-11 min-w-0 flex-1 sm:max-w-[140px]"
              />
            )}
            <div className="flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
              <Checkbox
                id="end-ongoing"
                variant="muted"
                checked={endOngoing}
                onCheckedChange={(v) => setEndOngoing(v === true)}
              />
              <Label
                htmlFor="end-ongoing"
                className="cursor-pointer text-muted-foreground text-xs"
              >
                Ongoing
              </Label>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 cursor-pointer items-center gap-2 sm:col-span-4">
          <Checkbox
            id="recurring-use-pocket"
            variant="muted"
            checked={deductFromPocket}
            onCheckedChange={(v) => setDeductFromPocket(v === true)}
          />
          <Label
            htmlFor="recurring-use-pocket"
            className="cursor-pointer text-muted-foreground text-xs leading-snug"
          >
            Use pocket balance
          </Label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} variant="muted">
          {formMode === 'edit' ? 'Save' : 'Add'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => (onCancel ? onCancel() : resetForm())}
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {sorted.length > 0 && (
        <div className="space-y-1">
          {sorted.map((exp) =>
            formMode === 'edit' && editingId === exp.id ? (
              <div key={exp.id}>{formUI}</div>
            ) : (
              <div
                key={exp.id}
                className="group flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span>{exp.label}</span>
                  <span className="font-mono text-red-400 text-xs">
                    -${exp.amount}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {exp.deductIncomeSourceId ? (
                      <>each payday &middot; </>
                    ) : (
                      <>
                        {exp.dayOfMonth === 0
                          ? 'Last'
                          : ordinal(exp.dayOfMonth)}{' '}
                        &middot;{' '}
                      </>
                    )}
                    {monthLabel(exp.startMonth)}-
                    {exp.endMonth == null
                      ? 'ongoing'
                      : monthLabel(exp.endMonth)}
                    {exp.deductIncomeSourceId && (
                      <>
                        {' '}
                        &middot;{' '}
                        {incomeSources.find(
                          (s) => s.id === exp.deductIncomeSourceId,
                        )?.name ?? 'source'}
                      </>
                    )}
                    {exp.deductFromPocket && (
                      <>
                        {' '}
                        &middot; <span className="text-foreground">pocket</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => startEdit(exp)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-red-500"
                    onClick={() => onRemove(exp.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {formMode === 'add' ? (
        formUI
      ) : formMode !== 'edit' ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-xs hover:text-foreground"
          onClick={startAdd}
        >
          <Plus className="mr-1 h-3 w-3" /> Add Recurring Expense
        </Button>
      ) : null}
    </div>
  );
}
