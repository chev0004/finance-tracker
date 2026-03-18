'use client';

import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  cn,
  normalizeNumInputBlur,
  normalizeNumInputLeading,
} from '@/lib/utils';
import type { IncomeRateChange, IncomeSource, PayFrequency } from '@/types';

const PAY_FREQUENCY_OPTIONS: { value: PayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

interface IncomeSourceManagerProps {
  sources: IncomeSource[];
  onAdd: (source: Omit<IncomeSource, 'id'>) => void;
  onUpdate: (source: IncomeSource) => void;
  onRemove: (id: string) => void;
  startOpen?: boolean;
  onCancel?: () => void;
}

function RateChangeList({
  source,
  onUpdate,
}: {
  source: IncomeSource;
  onUpdate: (source: IncomeSource) => void;
}) {
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [amount, setAmount] = useState('');

  const sorted = [...source.rateChanges].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate),
  );

  const resetForm = () => {
    setEffectiveDate('');
    setAmount('');
    setFormMode(null);
    setEditingId(null);
  };

  const startAdd = () => {
    resetForm();
    setFormMode('add');
  };

  const startEdit = (change: IncomeRateChange) => {
    setEditingId(change.id);
    setFormMode('edit');
    setEffectiveDate(change.effectiveDate);
    setAmount(String(change.amount));
  };

  const handleSave = () => {
    const numAmount = Number.parseFloat(normalizeNumInputBlur(amount)) || 0;
    if (!effectiveDate || numAmount <= 0) return;

    if (formMode === 'edit' && editingId) {
      onUpdate({
        ...source,
        rateChanges: source.rateChanges.map((c) =>
          c.id === editingId ? { ...c, effectiveDate, amount: numAmount } : c,
        ),
      });
    } else {
      onUpdate({
        ...source,
        rateChanges: [
          ...source.rateChanges,
          { id: crypto.randomUUID(), effectiveDate, amount: numAmount },
        ],
      });
    }
    resetForm();
  };

  const handleRemove = (id: string) => {
    onUpdate({
      ...source,
      rateChanges: source.rateChanges.filter((c) => c.id !== id),
    });
  };

  const fmtDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, 'MMM d, yyyy') : dateStr;
  };

  const diffLabel = (changeAmount: number) => {
    const diff = changeAmount - source.amount;
    if (diff === 0) return null;
    const sign = diff > 0 ? '+' : '';
    return (
      <span
        className={cn(
          'font-mono text-xs',
          diff > 0 ? 'text-green-400' : 'text-red-400',
        )}
      >
        {sign}${diff}
      </span>
    );
  };

  const formUI = (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Effective Date
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !effectiveDate && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {effectiveDate ? fmtDate(effectiveDate) : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={effectiveDate ? parseISO(effectiveDate) : undefined}
                onSelect={(d) => {
                  if (d && isValid(d))
                    setEffectiveDate(format(d, 'yyyy-MM-dd'));
                }}
                defaultMonth={
                  effectiveDate ? parseISO(effectiveDate) : new Date()
                }
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            New Amount / Period
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={amount === '' ? '0' : amount}
              onChange={(e) =>
                setAmount(normalizeNumInputLeading(e.target.value))
              }
              className="pl-7 font-mono"
            />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} variant="muted">
          {formMode === 'edit' ? 'Save' : 'Add'}
        </Button>
        <Button size="sm" variant="ghost" onClick={resetForm}>
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-1">
      {sorted.map((change) =>
        formMode === 'edit' && editingId === change.id ? (
          <div key={change.id}>{formUI}</div>
        ) : (
          <div
            key={change.id}
            className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground text-xs">
                {fmtDate(change.effectiveDate)}
              </span>
              <span className="font-mono text-xs">${change.amount}</span>
              {diffLabel(change.amount)}
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => startEdit(change)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-red-500"
                onClick={() => handleRemove(change.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ),
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
          <Plus className="mr-1 h-3 w-3" /> Add Rate Change
        </Button>
      ) : null}
    </div>
  );
}

function SourceItem({
  source,
  canRemove,
  onUpdate,
  onRemove,
}: {
  source: IncomeSource;
  canRemove: boolean;
  onUpdate: (source: IncomeSource) => void;
  onRemove: (id: string) => void;
}) {
  const firstPaydayDate = parseISO(source.firstPayday);

  const [amountStr, setAmountStr] = useState(String(source.amount));
  const [amountFocused, setAmountFocused] = useState(false);
  const [intervalStr, setIntervalStr] = useState(
    source.payInterval === undefined ? '' : String(source.payInterval),
  );
  const [intervalFocused, setIntervalFocused] = useState(false);

  useEffect(() => {
    if (!amountFocused) setAmountStr(String(source.amount));
  }, [source.amount, amountFocused]);
  useEffect(() => {
    if (!intervalFocused)
      setIntervalStr(
        source.payInterval === undefined ? '' : String(source.payInterval),
      );
  }, [source.payInterval, intervalFocused]);

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Name
          </Label>
          <Input
            value={source.name}
            onChange={(e) => onUpdate({ ...source, name: e.target.value })}
            placeholder="e.g. Main Job"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Base Amount / Period
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              type="number"
              min={0}
              value={amountStr === '' ? '0' : amountStr}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => {
                setAmountFocused(false);
                const n = normalizeNumInputBlur(amountStr);
                setAmountStr(n);
                onUpdate({ ...source, amount: Number(n) || 0 });
              }}
              onChange={(e) =>
                setAmountStr(normalizeNumInputLeading(e.target.value))
              }
              className="pl-7 font-mono"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Frequency
          </Label>
          <Select
            value={source.payFrequency}
            onValueChange={(v: PayFrequency) =>
              onUpdate({ ...source, payFrequency: v })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAY_FREQUENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            First Payday
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !source.firstPayday && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {isValid(firstPaydayDate)
                  ? format(firstPaydayDate, 'MMM d, yyyy')
                  : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={firstPaydayDate}
                onSelect={(d) => {
                  if (d && isValid(d))
                    onUpdate({
                      ...source,
                      firstPayday: format(d, 'yyyy-MM-dd'),
                    });
                }}
                defaultMonth={firstPaydayDate}
              />
            </PopoverContent>
          </Popover>
        </div>
        {source.payFrequency === 'custom' && (
          <div className="min-w-0 flex-1 space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Days Between
            </Label>
            <Input
              type="number"
              min={1}
              placeholder="e.g. 14"
              value={intervalStr}
              onFocus={() => setIntervalFocused(true)}
              onBlur={() => {
                setIntervalFocused(false);
                const n = normalizeNumInputBlur(intervalStr);
                setIntervalStr(n);
                onUpdate({
                  ...source,
                  payInterval: n === '' ? undefined : Number(n) || undefined,
                });
              }}
              onChange={(e) =>
                setIntervalStr(normalizeNumInputLeading(e.target.value))
              }
              className="font-mono"
            />
          </div>
        )}
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-red-500"
            onClick={() => onRemove(source.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-1 border-border/30 border-t pt-3">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Rate Changes
        </Label>
        <p className="text-muted-foreground/50 text-xs">
          Overrides the base amount from the effective date onward.
        </p>
        <RateChangeList source={source} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

export function IncomeSourceManager({
  sources,
  onAdd,
  onUpdate,
  onRemove,
  startOpen = false,
  onCancel,
}: IncomeSourceManagerProps) {
  const [addingSource, setAddingSource] = useState(startOpen);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newFrequency, setNewFrequency] = useState<PayFrequency>('weekly');
  const [newFirstPayday, setNewFirstPayday] = useState(() =>
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [newPayInterval, setNewPayInterval] = useState<number | ''>('');

  const resetAddForm = () => {
    setNewName('');
    setNewAmount('');
    setNewFrequency('weekly');
    setNewFirstPayday(format(new Date(), 'yyyy-MM-dd'));
    setNewPayInterval('');
    setAddingSource(false);
  };

  const handleAddSource = () => {
    const amount = Number.parseFloat(newAmount) || 0;
    if (!newName.trim() || amount <= 0) return;
    if (!newFirstPayday) return;
    if (newFrequency === 'custom') {
      const interval = Number(newPayInterval);
      if (!interval || interval <= 0) return;
      onAdd({
        name: newName.trim(),
        amount,
        payFrequency: 'custom',
        firstPayday: newFirstPayday,
        payInterval: interval,
        rateChanges: [],
      });
    } else {
      onAdd({
        name: newName.trim(),
        amount,
        payFrequency: newFrequency,
        firstPayday: newFirstPayday,
        rateChanges: [],
      });
    }
    resetAddForm();
  };

  return (
    <div className="space-y-3">
      {sources.map((source) => (
        <SourceItem
          key={source.id}
          source={source}
          canRemove={sources.length > 1}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}

      {addingSource ? (
        <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Name
              </Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Freelance"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Amount / Period
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={newAmount === '' ? '0' : newAmount}
                  onChange={(e) =>
                    setNewAmount(normalizeNumInputLeading(e.target.value))
                  }
                  onBlur={() => setNewAmount(normalizeNumInputBlur(newAmount))}
                  className="pl-7 font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Frequency
              </Label>
              <Select
                value={newFrequency}
                onValueChange={(v: PayFrequency) => setNewFrequency(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAY_FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                First Payday
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newFirstPayday
                      ? format(parseISO(newFirstPayday), 'MMM d, yyyy')
                      : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      newFirstPayday ? parseISO(newFirstPayday) : undefined
                    }
                    onSelect={(d) => {
                      if (d && isValid(d))
                        setNewFirstPayday(format(d, 'yyyy-MM-dd'));
                    }}
                    defaultMonth={
                      newFirstPayday ? parseISO(newFirstPayday) : new Date()
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
            {newFrequency === 'custom' && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Days Between
                </Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 14"
                  value={newPayInterval === '' ? '' : String(newPayInterval)}
                  onChange={(e) => {
                    const v = normalizeNumInputLeading(e.target.value);
                    setNewPayInterval(v === '' ? '' : Number(v));
                  }}
                  onBlur={() => {
                    const v = normalizeNumInputBlur(
                      newPayInterval === '' ? '' : String(newPayInterval),
                    );
                    setNewPayInterval(v === '' ? '' : Number(v));
                  }}
                  className="font-mono"
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddSource} variant="muted">
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (onCancel ? onCancel() : resetAddForm())}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-xs hover:text-foreground"
          onClick={() => setAddingSource(true)}
        >
          <Plus className="mr-1 h-3 w-3" /> Add Income Source
        </Button>
      )}
    </div>
  );
}
