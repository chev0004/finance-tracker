'use client';

import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
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
    settings.pocketFrequency === 'custom' && settings.pocketInterval
      ? `every ${settings.pocketInterval} days`
      : settings.pocketFrequency === 'monthly'
        ? 'monthly'
        : settings.pocketFrequency === 'biweekly'
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
              Pocket Frequency
            </Label>
            <Select
              value={settings.pocketFrequency}
              onValueChange={(v: PayFrequency) =>
                onUpdate({ pocketFrequency: v })
              }
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

          {settings.pocketFrequency === 'custom' && (
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
