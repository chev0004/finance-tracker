'use client';

import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { BudgetSettings } from '@/types';

interface SettingsPanelProps {
  settings: BudgetSettings;
  savedPerPeriod: number;
  onUpdate: (patch: Partial<BudgetSettings>) => void;
}

export function SettingsPanel({
  settings,
  savedPerPeriod,
  onUpdate,
}: SettingsPanelProps) {
  const firstPaydayDate = parseISO(settings.firstPayday);
  const freqLabel =
    settings.payFrequency === 'biweekly' ? 'every 2 weeks' : 'weekly';

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
          Income Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">
            Pay Frequency
          </Label>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm transition-all',
                settings.payFrequency === 'weekly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'cursor-pointer text-muted-foreground hover:text-foreground',
              )}
              onClick={() => onUpdate({ payFrequency: 'weekly' })}
            >
              Weekly
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm transition-all',
                settings.payFrequency === 'biweekly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'cursor-pointer text-muted-foreground hover:text-foreground',
              )}
              onClick={() => onUpdate({ payFrequency: 'biweekly' })}
            >
              Biweekly
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              Income / Period
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                type="number"
                min={0}
                value={settings.incomePerPeriod}
                onChange={(e) =>
                  onUpdate({
                    incomePerPeriod: Number(e.target.value) || 0,
                  })
                }
                className="pl-7 font-mono"
              />
            </div>
          </div>

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
                value={settings.pocketPerPeriod}
                onChange={(e) =>
                  onUpdate({
                    pocketPerPeriod: Number(e.target.value) || 0,
                  })
                }
                className="pl-7 font-mono"
              />
            </div>
          </div>

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
                value={settings.startingBalance}
                onChange={(e) =>
                  onUpdate({
                    startingBalance: Number(e.target.value) || 0,
                  })
                }
                className="pl-7 font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">
              First Payday
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !settings.firstPayday && 'text-muted-foreground',
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
                        firstPayday: format(d, 'yyyy-MM-dd'),
                      });
                  }}
                  defaultMonth={firstPaydayDate}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <p className="text-muted-foreground/70 text-xs">
          Saving ${savedPerPeriod} {freqLabel} ($
          {settings.incomePerPeriod} income minus ${settings.pocketPerPeriod}{' '}
          pocket)
        </p>
      </CardContent>
    </Card>
  );
}
