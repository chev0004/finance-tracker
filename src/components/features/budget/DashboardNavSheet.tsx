'use client';

import { ChevronLeft, Menu, Settings } from 'lucide-react';
import { useState } from 'react';
import { AuthNavButton } from '@/components/features/auth/AuthNavButton';
import { BudgetDataActions } from '@/components/features/budget/BudgetDataActions';
import { SettingsPanel } from '@/components/features/budget/SettingsPanel';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { ExportPayload } from '@/lib/exportBudget';
import type { BudgetSettings, BudgetState, IncomeSource } from '@/types';

type DashboardNavSheetProps = {
  exportState: BudgetState;
  exportAnalysisPayload: ExportPayload;
  onImport: (state: BudgetState) => void;
  settings: BudgetSettings;
  monthlyIncome: number;
  monthlySavings: number;
  onUpdateSettings: (patch: Partial<BudgetSettings>) => void;
  onAddIncomeSource: (source: Omit<IncomeSource, 'id'>) => void;
  onUpdateIncomeSource: (source: IncomeSource) => void;
  onRemoveIncomeSource: (id: string) => void;
};

export function DashboardNavSheet({
  exportState,
  exportAnalysisPayload,
  onImport,
  settings,
  monthlyIncome,
  monthlySavings,
  onUpdateSettings,
  onAddIncomeSource,
  onUpdateIncomeSource,
  onRemoveIncomeSource,
}: DashboardNavSheetProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'settings'>('menu');

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setView('menu');
  };

  return (
    <div className="sm:hidden">
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="flex flex-col">
          {view === 'menu' ? (
            <>
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-1 flex-col gap-6 overflow-y-auto pt-2">
                <div className="space-y-2">
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Account
                  </p>
                  <AuthNavButton
                    variant="outline"
                    size="default"
                    className="h-11 w-full justify-start gap-2 text-foreground"
                    onMenuAction={() => setOpen(false)}
                  />
                </div>
                <hr className="shrink-0 border-0 border-border border-t bg-transparent" />
                <div className="space-y-2">
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Budget data
                  </p>
                  <BudgetDataActions
                    state={exportState}
                    analysisPayload={exportAnalysisPayload}
                    onImport={onImport}
                    orientation="column"
                    onImportDialogOpen={() => setOpen(false)}
                  />
                </div>
                <hr className="shrink-0 border-0 border-border border-t bg-transparent" />
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="default"
                    className="h-11 w-full justify-start gap-2 text-foreground"
                    onClick={() => setView('settings')}
                  >
                    <Settings className="size-5" />
                    Settings
                  </Button>
                </div>
              </nav>
            </>
          ) : (
            <>
              <SheetHeader className="shrink-0 flex-row items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-2 h-9 w-9 shrink-0"
                  onClick={() => setView('menu')}
                  aria-label="Back"
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <SheetTitle className="flex-1">Budget Settings</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto pt-2 pb-4">
                <SettingsPanel
                  settings={settings}
                  monthlyIncome={monthlyIncome}
                  monthlySavings={monthlySavings}
                  onUpdate={onUpdateSettings}
                  onAddIncomeSource={onAddIncomeSource}
                  onUpdateIncomeSource={onUpdateIncomeSource}
                  onRemoveIncomeSource={onRemoveIncomeSource}
                  compact
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
