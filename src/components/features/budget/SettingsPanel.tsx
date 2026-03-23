'use client';

import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon, Loader2, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsivePicker } from '@/components/ui/responsive-picker';
import {
  ResponsiveSelect,
  type ResponsiveSelectOption,
} from '@/components/ui/responsive-select';
import { getPocketPerPeriodForDate } from '@/lib/pocket-per-period';
import {
  cn,
  getLocalDateString,
  normalizeNumInputBlur,
  normalizeNumInputLeading,
} from '@/lib/utils';
import type {
  BudgetSettings,
  IncomeSource,
  PayFrequency,
  PocketPerPeriodChange,
} from '@/types';
import { IncomeSourceManager } from './IncomeSourceManager';

const POCKET_FREQ_OPTIONS: { value: PayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

function PocketPerPeriodChangeList({
  settings,
  onUpdate,
}: {
  settings: BudgetSettings;
  onUpdate: (patch: Partial<BudgetSettings>) => void;
}) {
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState('');
  const [amount, setAmount] = useState('');
  const [rateDateOpen, setRateDateOpen] = useState(false);

  const changes = settings.pocketPerPeriodChanges;
  const sorted = [...changes].sort((a, b) =>
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

  const startEdit = (change: PocketPerPeriodChange) => {
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
        pocketPerPeriodChanges: changes.map((c) =>
          c.id === editingId ? { ...c, effectiveDate, amount: numAmount } : c,
        ),
      });
    } else {
      onUpdate({
        pocketPerPeriodChanges: [
          ...changes,
          { id: crypto.randomUUID(), effectiveDate, amount: numAmount },
        ],
      });
    }
    resetForm();
  };

  const handleRemove = (id: string) => {
    onUpdate({
      pocketPerPeriodChanges: changes.filter((c) => c.id !== id),
    });
  };

  const fmtDate = (dateStr: string) => {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, 'MMM d, yyyy') : dateStr;
  };

  const diffLabel = (changeAmount: number) => {
    const diff = changeAmount - settings.pocketPerPeriod;
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Effective Date
          </Label>
          <ResponsivePicker
            open={rateDateOpen}
            onOpenChange={setRateDateOpen}
            sheetTitle="Effective date"
            popoverContentClassName="w-auto p-0"
            trigger={
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-11 min-h-11 w-full justify-start text-left font-normal text-base sm:h-9 sm:min-h-9 sm:text-sm',
                  !effectiveDate && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                {effectiveDate ? fmtDate(effectiveDate) : 'Select date'}
              </Button>
            }
          >
            {(close) => (
              <Calendar
                mode="single"
                selected={effectiveDate ? parseISO(effectiveDate) : undefined}
                onSelect={(d) => {
                  if (d && isValid(d)) {
                    setEffectiveDate(format(d, 'yyyy-MM-dd'));
                    close();
                  }
                }}
                defaultMonth={
                  effectiveDate ? parseISO(effectiveDate) : new Date()
                }
                className="mx-auto w-full max-w-[100vw] rounded-lg"
              />
            )}
          </ResponsivePicker>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            New pocket / period
          </Label>
          <CurrencyInput
            type="number"
            min={0}
            placeholder="0"
            value={amount === '' ? '0' : amount}
            onChange={(e) =>
              setAmount(normalizeNumInputLeading(e.target.value))
            }
          />
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
            <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
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
          <Plus className="mr-1 h-3 w-3" /> Add pocket change
        </Button>
      ) : null}
    </div>
  );
}

interface SettingsPanelProps {
  settings: BudgetSettings;
  monthlyIncome: number;
  monthlySavings: number;
  onUpdate: (patch: Partial<BudgetSettings>) => void;
  onAddIncomeSource: (source: Omit<IncomeSource, 'id'>) => void;
  onUpdateIncomeSource: (source: IncomeSource) => void;
  onRemoveIncomeSource: (id: string) => void;
  compact?: boolean;
}

export function SettingsPanel({
  settings,
  monthlyIncome,
  monthlySavings,
  onUpdate,
  onAddIncomeSource,
  onUpdateIncomeSource,
  onRemoveIncomeSource,
  compact = false,
}: SettingsPanelProps) {
  const pocketStartDate = parseISO(settings.pocketFirstPayday);
  const balanceStartDate = parseISO(settings.startDate);
  const selectedPocketSource = useMemo(
    () =>
      settings.pocketIncomeSourceId
        ? settings.incomeSources.find(
            (s) => s.id === settings.pocketIncomeSourceId,
          )
        : undefined,
    [settings.pocketIncomeSourceId, settings.incomeSources],
  );
  const isSourceMode = Boolean(selectedPocketSource);
  const effectivePocketFrequency = isSourceMode
    ? (selectedPocketSource?.payFrequency ?? settings.pocketFrequency)
    : settings.pocketFrequency;
  const effectivePocketInterval = isSourceMode
    ? selectedPocketSource?.payInterval
    : settings.pocketInterval;

  const [pocketStr, setPocketStr] = useState(String(settings.pocketPerPeriod));
  const [pocketFocused, setPocketFocused] = useState(false);
  const [balanceStr, setBalanceStr] = useState(
    String(settings.startingBalance),
  );
  const [balanceFocused, setBalanceFocused] = useState(false);
  const [intervalStr, setIntervalStr] = useState(
    settings.pocketInterval === undefined
      ? ''
      : String(settings.pocketInterval),
  );
  const [intervalFocused, setIntervalFocused] = useState(false);
  const [isModePending, startModeTransition] = useTransition();
  const [balanceStartOpen, setBalanceStartOpen] = useState(false);
  const [pocketStartOpen, setPocketStartOpen] = useState(false);

  const pocketModeOptions = useMemo((): ResponsiveSelectOption[] => {
    const out: ResponsiveSelectOption[] = [
      { value: 'calendar', label: 'Calendar schedule' },
    ];
    if (settings.incomeSources.length > 0) {
      out.push({ value: 'source', label: 'Match income source' });
    }
    return out;
  }, [settings.incomeSources.length]);

  const matchedSourceOptions = useMemo(
    (): ResponsiveSelectOption[] =>
      settings.incomeSources.map((s) => ({
        value: s.id,
        label: s.name,
      })),
    [settings.incomeSources],
  );

  useEffect(() => {
    if (!pocketFocused) setPocketStr(String(settings.pocketPerPeriod));
  }, [settings.pocketPerPeriod, pocketFocused]);
  useEffect(() => {
    if (!balanceFocused) setBalanceStr(String(settings.startingBalance));
  }, [settings.startingBalance, balanceFocused]);
  useEffect(() => {
    if (!intervalFocused)
      setIntervalStr(
        settings.pocketInterval === undefined
          ? ''
          : String(settings.pocketInterval),
      );
  }, [settings.pocketInterval, intervalFocused]);

  const pocketFreqLabel =
    effectivePocketFrequency === 'custom' && effectivePocketInterval
      ? `every ${effectivePocketInterval} days`
      : effectivePocketFrequency === 'monthly'
        ? 'monthly'
        : effectivePocketFrequency === 'biweekly'
          ? 'every 2 weeks'
          : 'weekly';

  const pocketPerPeriodToday = useMemo(
    () => getPocketPerPeriodForDate(settings, getLocalDateString()),
    [settings],
  );

  const gridClass = compact
    ? 'flex flex-col gap-6'
    : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4';

  const fieldsAndRest = (
    <>
      <div className={gridClass}>
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Pocket / Period
          </Label>
          <CurrencyInput
            type="number"
            min={0}
            value={pocketStr === '' ? '0' : pocketStr}
            onFocus={() => setPocketFocused(true)}
            onBlur={() => {
              setPocketFocused(false);
              const n = normalizeNumInputBlur(pocketStr);
              setPocketStr(n);
              onUpdate({ pocketPerPeriod: Number(n) || 0 });
            }}
            onChange={(e) =>
              setPocketStr(normalizeNumInputLeading(e.target.value))
            }
          />
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Pocket period mode
          </Label>
          <ResponsiveSelect
            value={isSourceMode ? 'source' : 'calendar'}
            onValueChange={(v) => {
              startModeTransition(() => {
                if (v === 'source') {
                  if (settings.incomeSources.length === 0) return;
                  const fallbackId =
                    settings.pocketIncomeSourceId ??
                    settings.incomeSources[0].id;
                  onUpdate({ pocketIncomeSourceId: fallbackId });
                  return;
                }
                onUpdate({ pocketIncomeSourceId: undefined });
              });
            }}
            disabled={isModePending}
            options={pocketModeOptions}
            sheetTitle="Pocket period mode"
            triggerClassName="w-full"
          />
          {isModePending && (
            <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating period mode
            </div>
          )}
        </div>

        {isSourceMode && settings.incomeSources.length > 1 && (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Matched source
            </Label>
            <ResponsiveSelect
              value={settings.pocketIncomeSourceId ?? ''}
              onValueChange={(v) => {
                startModeTransition(() =>
                  onUpdate({ pocketIncomeSourceId: v }),
                );
              }}
              disabled={isModePending}
              options={matchedSourceOptions}
              sheetTitle="Matched income source"
              triggerClassName="w-full"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Pocket Frequency
          </Label>
          <ResponsiveSelect
            value={settings.pocketFrequency}
            onValueChange={(v) =>
              onUpdate({ pocketFrequency: v as PayFrequency })
            }
            disabled={isSourceMode}
            options={POCKET_FREQ_OPTIONS}
            sheetTitle="Pocket frequency"
            triggerClassName="w-full"
          />
        </div>

        {!isSourceMode && settings.pocketFrequency === 'custom' && (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
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
                  pocketInterval: n === '' ? undefined : Number(n) || undefined,
                });
              }}
              onChange={(e) =>
                setIntervalStr(normalizeNumInputLeading(e.target.value))
              }
              className="font-mono"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Starting Balance
          </Label>
          <CurrencyInput
            type="number"
            min={0}
            value={balanceStr === '' ? '0' : balanceStr}
            onFocus={() => setBalanceFocused(true)}
            onBlur={() => {
              setBalanceFocused(false);
              const n = normalizeNumInputBlur(balanceStr);
              setBalanceStr(n);
              onUpdate({ startingBalance: Number(n) || 0 });
            }}
            onChange={(e) =>
              setBalanceStr(normalizeNumInputLeading(e.target.value))
            }
          />
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Balance Start
          </Label>
          <ResponsivePicker
            open={balanceStartOpen}
            onOpenChange={setBalanceStartOpen}
            sheetTitle="Balance start date"
            popoverContentClassName="w-auto p-0"
            trigger={
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-11 min-h-11 w-full justify-start text-left font-normal text-base sm:h-9 sm:min-h-9 sm:text-sm',
                  !isValid(balanceStartDate) && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                {isValid(balanceStartDate)
                  ? format(balanceStartDate, 'MMM d, yyyy')
                  : 'Select date'}
              </Button>
            }
          >
            {(close) => (
              <Calendar
                mode="single"
                selected={balanceStartDate}
                onSelect={(d) => {
                  if (d && isValid(d)) {
                    const formatted = format(d, 'yyyy-MM-dd');
                    onUpdate({
                      startDate: formatted,
                      pocketFirstPayday: formatted,
                    });
                    close();
                  }
                }}
                defaultMonth={balanceStartDate}
                className="mx-auto w-full max-w-[100vw] rounded-lg"
              />
            )}
          </ResponsivePicker>
        </div>

        {!isSourceMode && settings.pocketFrequency === 'custom' ? (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Pocket Start
            </Label>
            <ResponsivePicker
              open={pocketStartOpen}
              onOpenChange={setPocketStartOpen}
              sheetTitle="Pocket period start"
              popoverContentClassName="w-auto p-0"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'h-11 min-h-11 w-full justify-start text-left font-normal text-base sm:h-9 sm:min-h-9 sm:text-sm',
                    !settings.pocketFirstPayday && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {isValid(pocketStartDate)
                    ? format(pocketStartDate, 'MMM d, yyyy')
                    : 'Select date'}
                </Button>
              }
            >
              {(close) => (
                <Calendar
                  mode="single"
                  selected={pocketStartDate}
                  onSelect={(d) => {
                    if (d && isValid(d)) {
                      onUpdate({
                        pocketFirstPayday: format(d, 'yyyy-MM-dd'),
                      });
                      close();
                    }
                  }}
                  defaultMonth={pocketStartDate}
                  className="mx-auto w-full max-w-[100vw] rounded-lg"
                />
              )}
            </ResponsivePicker>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-border/50 border-t pt-4">
        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
          Scheduled pocket / period
        </Label>
        <p className="text-muted-foreground/60 text-xs">
          From each effective date onward, pocket per period uses that amount
          until the next change (same idea as income rate changes).
        </p>
        <PocketPerPeriodChangeList settings={settings} onUpdate={onUpdate} />
      </div>

      <p className="text-muted-foreground/70 text-xs">
        Saving ~$
        {monthlySavings.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
        /mo ($
        {monthlyIncome.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}{' '}
        income minus ${pocketPerPeriodToday} pocket {pocketFreqLabel})
      </p>

      <div className="space-y-2 border-border/50 border-t pt-4">
        <Label className="text-muted-foreground text-xs uppercase tracking-wider">
          Income Sources
        </Label>
        <p className="text-muted-foreground/60 text-xs">
          Add your income sources. Each has its own frequency (weekly, biweekly,
          monthly, custom) and rate changes over time.
        </p>
        <IncomeSourceManager
          sources={settings.incomeSources}
          onAdd={onAddIncomeSource}
          onUpdate={onUpdateIncomeSource}
          onRemove={onRemoveIncomeSource}
        />
      </div>
    </>
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-4 overflow-y-auto">{fieldsAndRest}</div>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
          Budget Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{fieldsAndRest}</CardContent>
    </Card>
  );
}
