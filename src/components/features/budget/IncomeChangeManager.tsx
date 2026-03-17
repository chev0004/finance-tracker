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
import { cn } from '@/lib/utils';
import type { IncomeChange } from '@/types';

interface IncomeChangeManagerProps {
  changes: IncomeChange[];
  baseIncome: number;
  onAdd: (change: Omit<IncomeChange, 'id'>) => void;
  onUpdate: (change: IncomeChange) => void;
  onRemove: (id: string) => void;
}

export function IncomeChangeManager({
  changes,
  baseIncome,
  onAdd,
  onUpdate,
  onRemove,
}: IncomeChangeManagerProps) {
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [income, setIncome] = useState('');

  const sorted = [...changes].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate),
  );

  const resetForm = () => {
    setEffectiveDate('');
    setIncome('');
    setFormMode(null);
    setEditingId(null);
  };

  const startAdd = () => {
    resetForm();
    setFormMode('add');
  };

  const startEdit = (change: IncomeChange) => {
    setEditingId(change.id);
    setFormMode('edit');
    setEffectiveDate(change.effectiveDate);
    setIncome(String(change.incomePerPeriod));
  };

  const handleSave = () => {
    const numIncome = Number.parseFloat(income) || 0;
    if (!effectiveDate || numIncome <= 0) return;

    if (formMode === 'edit' && editingId) {
      onUpdate({
        id: editingId,
        effectiveDate,
        incomePerPeriod: numIncome,
      });
    } else {
      onAdd({
        effectiveDate,
        incomePerPeriod: numIncome,
      });
    }
    resetForm();
  };

  const fmtDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, 'MMM d, yyyy') : dateStr;
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
            New Income / Period
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              className="pl-7 font-mono"
            />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          {formMode === 'edit' ? 'Save' : 'Add'}
        </Button>
        <Button size="sm" variant="ghost" onClick={resetForm}>
          Cancel
        </Button>
      </div>
    </div>
  );

  const diffLabel = (amount: number) => {
    const diff = amount - baseIncome;
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

  return (
    <div className="space-y-3">
      {sorted.length > 0 && (
        <div className="space-y-1">
          {sorted.map((change) =>
            formMode === 'edit' && editingId === change.id ? (
              <div key={change.id}>{formUI}</div>
            ) : (
              <div
                key={change.id}
                className="group flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="text-muted-foreground text-xs">
                    {fmtDate(change.effectiveDate)}
                  </span>
                  <span className="font-mono text-xs">
                    ${change.incomePerPeriod}
                  </span>
                  {diffLabel(change.incomePerPeriod)}
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
                    onClick={() => onRemove(change.id)}
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
          <Plus className="mr-1 h-3 w-3" /> Add Rate Change
        </Button>
      ) : null}
    </div>
  );
}
