'use client';

import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { BudgetSettings, IncomeSource, PayFrequency } from '@/types';
import { IncomeSourceManager } from './IncomeSourceManager';

const POCKET_FREQ_OPTIONS: { value: PayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

interface SettingsPanelProps {
  settings: BudgetSettings;
  monthlyIncome: number;
  monthlySavings: number;
  onUpdate: (patch: Partial<BudgetSettings>) => void;
  onAddIncomeSource: (source: Omit<IncomeSource, 'id'>) => void;
  onUpdateIncomeSource: (source: IncomeSource) => void;
  onRemoveIncomeSource: (id: string) => void;
}

export function SettingsPanel({
  settings,
  monthlyIncome,
  monthlySavings,
  onUpdate,
  onAddIncomeSource,
  onUpdateIncomeSource,
  onRemoveIncomeSource,
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

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
          Budget Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Pocket / Period
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
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
                className="pl-7 font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Pocket period mode
            </Label>
            <Select
              value={isSourceMode ? 'source' : 'calendar'}
              onValueChange={(v: 'calendar' | 'source') => {
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
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calendar">Calendar schedule</SelectItem>
                {settings.incomeSources.length > 0 && (
                  <SelectItem value="source">Match income source</SelectItem>
                )}
              </SelectContent>
            </Select>
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
              <Select
                value={settings.pocketIncomeSourceId}
                onValueChange={(v) => {
                  startModeTransition(() =>
                    onUpdate({ pocketIncomeSourceId: v }),
                  );
                }}
                disabled={isModePending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settings.incomeSources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Pocket Frequency
            </Label>
            <Select
              value={settings.pocketFrequency}
              onValueChange={(v: PayFrequency) =>
                onUpdate({ pocketFrequency: v })
              }
              disabled={isSourceMode}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POCKET_FREQ_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    pocketInterval:
                      n === '' ? undefined : Number(n) || undefined,
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
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
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
                className="pl-7 font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Balance Start
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !isValid(balanceStartDate) && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {isValid(balanceStartDate)
                    ? format(balanceStartDate, 'MMM d, yyyy')
                    : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
                    }
                  }}
                  defaultMonth={balanceStartDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          {!isSourceMode && settings.pocketFrequency === 'custom' ? (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                Pocket Start
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !settings.pocketFirstPayday && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {isValid(pocketStartDate)
                      ? format(pocketStartDate, 'MMM d, yyyy')
                      : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={pocketStartDate}
                    onSelect={(d) => {
                      if (d && isValid(d))
                        onUpdate({
                          pocketFirstPayday: format(d, 'yyyy-MM-dd'),
                        });
                    }}
                    defaultMonth={pocketStartDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : null}
        </div>

        <p className="text-muted-foreground/70 text-xs">
          Saving ~${Math.round(monthlySavings).toLocaleString()}/mo ($
          {Math.round(monthlyIncome).toLocaleString()} income minus $
          {settings.pocketPerPeriod} pocket {pocketFreqLabel})
        </p>

        <div className="space-y-2 border-border/50 border-t pt-4">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Income Sources
          </Label>
          <p className="text-muted-foreground/60 text-xs">
            Add your income sources. Each has its own frequency (weekly,
            biweekly, monthly, custom) and rate changes over time.
          </p>
          <IncomeSourceManager
            sources={settings.incomeSources}
            onAdd={onAddIncomeSource}
            onUpdate={onUpdateIncomeSource}
            onRemove={onRemoveIncomeSource}
          />
        </div>
      </CardContent>
    </Card>
  );
}
