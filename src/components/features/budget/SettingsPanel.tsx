'use client';

import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsivePicker } from '@/components/ui/responsive-picker';
import {
  ResponsiveSelect,
  type ResponsiveSelectOption,
} from '@/components/ui/responsive-select';
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
