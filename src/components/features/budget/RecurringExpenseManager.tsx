'use client';

import { Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { RecurringExpense } from '@/types';

interface RecurringExpenseManagerProps {
  expenses: RecurringExpense[];
  onAdd: (expense: Omit<RecurringExpense, 'id'>) => void;
  onUpdate: (expense: RecurringExpense) => void;
  onRemove: (id: string) => void;
  startOpen?: boolean;
  onCancel?: () => void;
}

const MONTHS_2026 = [
  { value: '2026-01', label: 'Jan' },
  { value: '2026-02', label: 'Feb' },
  { value: '2026-03', label: 'Mar' },
  { value: '2026-04', label: 'Apr' },
  { value: '2026-05', label: 'May' },
  { value: '2026-06', label: 'Jun' },
  { value: '2026-07', label: 'Jul' },
  { value: '2026-08', label: 'Aug' },
  { value: '2026-09', label: 'Sep' },
  { value: '2026-10', label: 'Oct' },
  { value: '2026-11', label: 'Nov' },
  { value: '2026-12', label: 'Dec' },
];

function monthLabel(value: string): string {
  return MONTHS_2026.find((m) => m.value === value)?.label ?? value;
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

export function RecurringExpenseManager({
  expenses,
  onAdd,
  onUpdate,
  onRemove,
  startOpen = false,
  onCancel,
}: RecurringExpenseManagerProps) {
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(
    startOpen ? 'add' : null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [dayPreset, setDayPreset] = useState<DayPreset>('1');
  const [customDay, setCustomDay] = useState('');
  const [startMonth, setStartMonth] = useState('2026-04');
  const [endMonth, setEndMonth] = useState('2026-12');

  const resolvedDay =
    dayPreset === 'end'
      ? 0
      : dayPreset === 'custom'
        ? Number.parseInt(customDay, 10) || 1
        : Number.parseInt(dayPreset, 10);

  const sorted = [...expenses].sort((a, b) => {
    const aDay = a.dayOfMonth === 0 ? 32 : a.dayOfMonth;
    const bDay = b.dayOfMonth === 0 ? 32 : b.dayOfMonth;
    return aDay - bDay;
  });

  const resetForm = () => {
    setLabel('');
    setAmount('');
    setDayPreset('1');
    setCustomDay('');
    setStartMonth('2026-04');
    setEndMonth('2026-12');
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
    setEndMonth(exp.endMonth);
  };

  const handleSave = () => {
    const numAmount = Number.parseFloat(amount) || 0;
    if (!label.trim() || numAmount <= 0) return;
    const day = resolvedDay === 0 ? 0 : Math.min(31, Math.max(1, resolvedDay));

    if (formMode === 'edit' && editingId) {
      onUpdate({
        id: editingId,
        label: label.trim(),
        amount: numAmount,
        dayOfMonth: day,
        startMonth,
        endMonth,
      });
    } else {
      onAdd({
        label: label.trim(),
        amount: numAmount,
        dayOfMonth: day,
        startMonth,
        endMonth,
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
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-7 font-mono"
            />
          </div>
        </div>
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
        <div className="min-w-0 space-y-1 sm:col-span-2">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Months
          </Label>
          <div className="flex min-w-0 items-center gap-2">
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger className="w-full min-w-0 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS_2026.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="shrink-0 text-muted-foreground text-xs">-</span>
            <Select value={endMonth} onValueChange={setEndMonth}>
              <SelectTrigger className="w-full min-w-0 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS_2026.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                    {exp.dayOfMonth === 0 ? 'Last' : ordinal(exp.dayOfMonth)}{' '}
                    &middot; {monthLabel(exp.startMonth)}-
                    {monthLabel(exp.endMonth)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
