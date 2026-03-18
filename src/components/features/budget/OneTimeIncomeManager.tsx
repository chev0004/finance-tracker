'use client';

import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
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
  cn,
  normalizeNumInputBlur,
  normalizeNumInputLeading,
} from '@/lib/utils';
import type { OneTimeIncome } from '@/types';

interface OneTimeIncomeManagerProps {
  items: OneTimeIncome[];
  onAdd: (item: Omit<OneTimeIncome, 'id'>) => void;
  onUpdate: (item: OneTimeIncome) => void;
  onRemove: (id: string) => void;
  startOpen?: boolean;
  onCancel?: () => void;
}

export function OneTimeIncomeManager({
  items,
  onAdd,
  onUpdate,
  onRemove,
  startOpen = false,
  onCancel,
}: OneTimeIncomeManagerProps) {
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(
    startOpen ? 'add' : null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState(() =>
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  const resetForm = () => {
    setDateStr(format(new Date(), 'yyyy-MM-dd'));
    setLabel('');
    setAmount('');
    setFormMode(null);
    setEditingId(null);
  };

  const startAdd = () => {
    resetForm();
    setFormMode('add');
  };

  const startEdit = (item: OneTimeIncome) => {
    setEditingId(item.id);
    setFormMode('edit');
    setDateStr(item.date);
    setLabel(item.label);
    setAmount(String(item.amount));
  };

  const handleSave = () => {
    const numAmount = Number.parseFloat(normalizeNumInputBlur(amount)) || 0;
    if (!dateStr || !label.trim() || numAmount <= 0) return;

    if (formMode === 'edit' && editingId) {
      onUpdate({
        id: editingId,
        date: dateStr,
        label: label.trim(),
        amount: numAmount,
      });
    } else {
      onAdd({ date: dateStr, label: label.trim(), amount: numAmount });
    }
    resetForm();
  };

  const dateObj = parseISO(dateStr);
  const dateValid = isValid(dateObj);

  const formUI = (
    <div className="w-full min-w-0 space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-w-0 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Date
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dateValid && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateValid ? format(dateObj, 'MMM d, yyyy') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateValid ? dateObj : undefined}
                onSelect={(d) => {
                  if (d && isValid(d)) setDateStr(format(d, 'yyyy-MM-dd'));
                }}
                defaultMonth={dateValid ? dateObj : new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Label
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Gift from family"
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
              value={amount === '' ? '0' : amount}
              onChange={(e) =>
                setAmount(normalizeNumInputLeading(e.target.value))
              }
              onBlur={() => setAmount(normalizeNumInputBlur(amount))}
              className="pl-7 font-mono"
            />
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
      {sorted.map((item) =>
        formMode === 'edit' && editingId === item.id ? (
          <div key={item.id}>{formUI}</div>
        ) : (
          <div
            key={item.id}
            className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground text-xs">
                {format(parseISO(item.date), 'MMM d, yyyy')}
              </span>
              <span className="truncate">{item.label}</span>
              <span className="font-mono text-green-400 text-xs">
                +${item.amount.toLocaleString()}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => startEdit(item)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-red-500"
                onClick={() => onRemove(item.id)}
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
          <Plus className="mr-1 h-3 w-3" /> Add one-time income
        </Button>
      ) : null}
    </div>
  );
}
