'use client';

import { Briefcase, ChevronLeft, Gift } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { IncomeSource, OneTimeIncome } from '@/types';
import { IncomeSourceManager } from './IncomeSourceManager';
import { OneTimeIncomeManager } from './OneTimeIncomeManager';

export type MobileAddIncomeView = 'picker' | 'recurring' | 'one-time';

interface MobileAddIncomeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: MobileAddIncomeView;
  onAddIncomeSource: (source: Omit<IncomeSource, 'id'>) => void;
  onUpdateIncomeSource: (source: IncomeSource) => void;
  onRemoveIncomeSource: (id: string) => void;
  onToggleIncomeSourceHidden: (id: string) => void;
  onAddOneTimeIncome: (item: Omit<OneTimeIncome, 'id'>) => void;
  onUpdateOneTimeIncome: (item: OneTimeIncome) => void;
  onRemoveOneTimeIncome: (id: string) => void;
  incomeSources: IncomeSource[];
  oneTimeIncome: OneTimeIncome[];
}

export function MobileAddIncomeSheet({
  open,
  onOpenChange,
  initialView = 'picker',
  onAddIncomeSource,
  onUpdateIncomeSource,
  onRemoveIncomeSource,
  onToggleIncomeSourceHidden,
  onAddOneTimeIncome,
  onUpdateOneTimeIncome,
  onRemoveOneTimeIncome,
  incomeSources,
  oneTimeIncome,
}: MobileAddIncomeSheetProps) {
  const [view, setView] = useState<MobileAddIncomeView>(initialView);

  useEffect(() => {
    if (open) {
      setView(initialView);
    }
  }, [open, initialView]);

  const closeAndReset = () => {
    onOpenChange(false);
    setView('picker');
  };

  const handleAddSource = (source: Omit<IncomeSource, 'id'>) => {
    onAddIncomeSource(source);
    closeAndReset();
  };

  const handleAddOneTime = (item: Omit<OneTimeIncome, 'id'>) => {
    onAddOneTimeIncome(item);
    closeAndReset();
  };

  const titles: Record<MobileAddIncomeView, string> = {
    picker: 'Add income',
    recurring: 'Recurring income',
    'one-time': 'One-time income',
  };

  const canGoBack = view !== 'picker';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[85dvh] max-h-[85dvh] flex-col sm:hidden"
      >
        <SheetHeader className="shrink-0 flex-row items-center gap-2">
          {canGoBack && (
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 h-9 w-9 shrink-0"
              onClick={() => setView('picker')}
              aria-label="Back"
            >
              <ChevronLeft className="size-5" />
            </Button>
          )}
          <SheetTitle className="flex-1">{titles[view]}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pt-4">
          {view === 'picker' && (
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setView('recurring')}
                className="glass-card flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors active:bg-muted/50"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <Briefcase className="size-6 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    Recurring income
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Job, freelance, or regular paycheck
                  </p>
                </div>
                <ChevronLeft className="size-5 shrink-0 -rotate-180 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => setView('one-time')}
                className="glass-card flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors active:bg-muted/50"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                  <Gift className="size-6 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">One-time income</p>
                  <p className="text-muted-foreground text-sm">
                    Gift, refund, or bonus
                  </p>
                </div>
                <ChevronLeft className="size-5 shrink-0 -rotate-180 text-muted-foreground" />
              </button>
            </div>
          )}
          {view === 'recurring' && (
            <IncomeSourceManager
              sources={incomeSources}
              onAdd={handleAddSource}
              onUpdate={onUpdateIncomeSource}
              onRemove={onRemoveIncomeSource}
              onToggleHidden={onToggleIncomeSourceHidden}
              startOpen
              onCancel={() => setView('picker')}
            />
          )}
          {view === 'one-time' && (
            <OneTimeIncomeManager
              items={oneTimeIncome}
              onAdd={handleAddOneTime}
              onUpdate={onUpdateOneTimeIncome}
              onRemove={onRemoveOneTimeIncome}
              startOpen
              onCancel={() => setView('picker')}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
