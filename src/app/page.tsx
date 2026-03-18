'use client';

import { Briefcase, Gift, Repeat, Target } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ExpenseForm } from '@/components/features/budget/ExpenseForm';
import { ExpenseList } from '@/components/features/budget/ExpenseList';
import { ExportMenu } from '@/components/features/budget/ExportMenu';
import { GoalCard } from '@/components/features/budget/GoalCard';
import { GoalForm } from '@/components/features/budget/GoalForm';
import { IncomeSourceManager } from '@/components/features/budget/IncomeSourceManager';
import { OneTimeIncomeManager } from '@/components/features/budget/OneTimeIncomeManager';
import { PocketChart } from '@/components/features/budget/PocketChart';
import { RecurringExpenseManager } from '@/components/features/budget/RecurringExpenseManager';
import { SavingsChart } from '@/components/features/budget/SavingsChart';
import { SettingsPanel } from '@/components/features/budget/SettingsPanel';
import { StatsCard } from '@/components/features/budget/StatsCard';
import { ValidationAlert } from '@/components/features/budget/ValidationAlert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NavStepper } from '@/components/ui/nav-stepper';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBudget } from '@/hooks/useBudget';

export default function Home() {
  const {
    isLoaded,
    expenses,
    settings,
    savingsTimeline,
    pocketTimeline,
    currentPocketBalance,
    goalStats,
    validation,
    paydays,
    addExpense,
    removeExpense,
    updateExpenseAmount,
    updateSpentForPeriod,
    updateSettings,
    addGoal,
    updateGoal,
    removeGoal,
    addRecurringExpense,
    updateRecurringExpense,
    removeRecurringExpense,
    monthlyIncome,
    monthlySavings,
    addIncomeSource,
    updateIncomeSource,
    removeIncomeSource,
    addOneTimeIncome,
    updateOneTimeIncome,
    removeOneTimeIncome,
  } = useBudget();

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [addPanel, setAddPanel] = useState<
    'goal' | 'recurring' | 'one-time' | 'income' | null
  >(null);

  const chartStartYear = Number(settings.startDate.slice(0, 4));
  const chartEndYear = chartStartYear + 4;
  const [chartYear, setChartYear] = useState(() => {
    const y = new Date().getFullYear();
    if (y < chartStartYear) return chartStartYear;
    if (y > chartEndYear) return chartEndYear;
    return y;
  });
  const chartYearClamped = Math.max(
    chartStartYear,
    Math.min(chartEndYear, chartYear),
  );
  const savingsChartData = useMemo(() => {
    const yearStart = `${chartYearClamped}-01-01`;
    const yearEnd = `${chartYearClamped}-12-31`;
    const inYear = savingsTimeline.filter(
      (p) => p.rawDate >= yearStart && p.rawDate <= yearEnd,
    );
    const beforeYear = savingsTimeline
      .filter((p) => p.rawDate < yearStart)
      .sort((a, b) => b.rawDate.localeCompare(a.rawDate));
    const carryOver = beforeYear[0];
    if (!carryOver) return inYear;
    return [
      { ...carryOver, date: yearStart, rawDate: yearStart, label: '…' },
      ...inYear,
    ];
  }, [savingsTimeline, chartYearClamped]);

  const pocketChartData = useMemo(() => {
    const yearStart = `${chartYearClamped}-01-01`;
    const yearEnd = `${chartYearClamped}-12-31`;
    return pocketTimeline.filter(
      (p) => p.rawDate >= yearStart && p.rawDate <= yearEnd,
    );
  }, [pocketTimeline, chartYearClamped]);

  const togglePanel = (panel: typeof addPanel) =>
    setAddPanel((prev) => (prev === panel ? null : panel));

  const eoySavings = useMemo(() => {
    const yearEnd = `${chartYearClamped}-12-31`;
    const inYear = savingsTimeline.filter((p) => p.rawDate <= yearEnd);
    const last = inYear[inYear.length - 1];
    return last ? last.balance : settings.startingBalance;
  }, [savingsTimeline, chartYearClamped, settings.startingBalance]);

  const eoyPocket = useMemo(() => {
    const yearEnd = `${chartYearClamped}-12-31`;
    const inYear = pocketTimeline.filter((p) => p.rawDate <= yearEnd);
    const last = inYear[inYear.length - 1];
    return last ? last.balance : 0;
  }, [pocketTimeline, chartYearClamped]);

  const eoyCombined = eoySavings + eoyPocket;

  const pocketFreqLabel =
    settings.pocketFrequency === 'custom' && settings.pocketInterval
      ? `every ${settings.pocketInterval} days`
      : settings.pocketFrequency === 'monthly'
        ? 'monthly'
        : settings.pocketFrequency === 'biweekly'
          ? 'every 2 weeks'
          : 'weekly';

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  const eoyVariant =
    eoyCombined < 0 ? 'danger' : eoyCombined < 500 ? 'warning' : 'success';
  const eoyColor = {
    danger: 'text-red-500',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
  }[eoyVariant];

  const today = new Date().toISOString().slice(0, 10);
  const currentSavings =
    [...savingsTimeline].filter((p) => p.rawDate <= today).pop()?.balance ??
    settings.startingBalance;
  const combinedBalance = currentSavings + currentPocketBalance;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="mb-6 flex flex-row items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-muted-foreground text-sm uppercase tracking-wider">
              chev.dev / budget tracker
            </h1>
            <p className="mt-1 text-muted-foreground/60 text-xs">
              {chartStartYear}-{chartEndYear} projection
            </p>
          </div>
          <ExportMenu
            payload={{
              settings,
              expenses,
              monthlyIncome,
              monthlySavings,
              savingsTimeline,
              pocketTimeline,
              goalStats,
              eoyBalance: eoyCombined,
              validationErrors: validation.errors,
            }}
          />
        </header>

        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border/50 bg-card/50 hover:border-border hover:shadow-md">
            <CardContent className="p-4">
              <div className="mb-2 text-muted-foreground text-xs uppercase tracking-wider">
                Balances
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-xs">Savings</span>
                  <span className="font-mono text-sm">
                    ${currentSavings.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-xs">Pocket</span>
                  <span className="font-mono text-sm">
                    ${currentPocketBalance.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-border/50 border-t pt-1.5">
                  <span className="text-muted-foreground text-xs">
                    Combined
                  </span>
                  <span className="font-bold font-mono text-xl">
                    ${combinedBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <StatsCard
            label="Savings /mo"
            value={Math.round(monthlySavings)}
            variant="success"
            prefix="+"
          />
          <Card className="border-border/50 bg-card/50 hover:border-border hover:shadow-md">
            <CardContent className="p-4">
              <div className="mb-2 text-muted-foreground text-xs uppercase tracking-wider">
                End of {chartYearClamped}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-xs">Savings</span>
                  <span className="font-mono text-sm">
                    ${eoySavings.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-xs">Pocket</span>
                  <span className="font-mono text-sm">
                    ${eoyPocket.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-border/50 border-t pt-1.5">
                  <span className="text-muted-foreground text-xs">
                    Combined
                  </span>
                  <span className={`font-bold font-mono text-xl ${eoyColor}`}>
                    ${eoyCombined.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <SettingsPanel
          settings={settings}
          monthlyIncome={monthlyIncome}
          monthlySavings={monthlySavings}
          onUpdate={updateSettings}
          onAddIncomeSource={addIncomeSource}
          onUpdateIncomeSource={updateIncomeSource}
          onRemoveIncomeSource={removeIncomeSource}
        />

        {/* --- Savings --- */}
        <Card className="border-border/50 bg-card/50 hover:border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Savings
            </CardTitle>
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'goal', icon: Target, tip: 'Add goal' },
                    {
                      id: 'recurring',
                      icon: Repeat,
                      tip: 'Add recurring expense',
                    },
                    { id: 'one-time', icon: Gift, tip: 'Add one-time income' },
                    { id: 'income', icon: Briefcase, tip: 'Add income source' },
                  ] as const
                ).map(({ id, icon: Icon, tip }) => (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={addPanel === id ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => togglePanel(id)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{tip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </CardHeader>
          <CardContent className="space-y-4">
            <ValidationAlert
              errors={validation.errors}
              isCritical={validation.isCritical}
            />
            <NavStepper
              disablePrev={chartYearClamped <= chartStartYear}
              disableNext={chartYearClamped >= chartEndYear}
              onPrev={() =>
                setChartYear((y) => Math.max(chartStartYear, y - 1))
              }
              onNext={() => setChartYear((y) => Math.min(chartEndYear, y + 1))}
            >
              <span className="min-w-16 text-center font-medium font-mono text-sm">
                {chartYearClamped}
              </span>
            </NavStepper>
            <SavingsChart data={savingsChartData} />
            <p className="text-muted-foreground/70 text-xs leading-relaxed">
              ~${Math.round(monthlySavings).toLocaleString()} saved per month ($
              {Math.round(monthlyIncome).toLocaleString()} income minus $
              {settings.pocketPerPeriod} pocket {pocketFreqLabel}).
              {settings.recurringExpenses.length > 0 && (
                <>
                  {' '}
                  {settings.recurringExpenses
                    .map(
                      (e) =>
                        `${e.label} $${e.amount} on the ${e.dayOfMonth === 0 ? 'last day' : `${e.dayOfMonth}th`}`,
                    )
                    .join(', ')}
                  .
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Dialog
          open={addPanel === 'goal'}
          onOpenChange={(open) => !open && setAddPanel(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Goal</DialogTitle>
              <DialogDescription>
                Trips, a car, a big purchase, anything. Pick one date or a date
                range for a period like a trip.
              </DialogDescription>
            </DialogHeader>
            <GoalForm
              recurringExpenses={settings.recurringExpenses}
              onSave={(goal) => {
                addGoal(goal);
                setAddPanel(null);
              }}
              onCancel={() => setAddPanel(null)}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={addPanel === 'recurring'}
          onOpenChange={(open) => !open && setAddPanel(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Recurring Expense</DialogTitle>
              <DialogDescription>
                A fixed cost that repeats monthly (rent, subscriptions, etc.).
              </DialogDescription>
            </DialogHeader>
            <RecurringExpenseManager
              expenses={[]}
              projectionStartDate={settings.startDate}
              onAdd={(e) => {
                addRecurringExpense(e);
                setAddPanel(null);
              }}
              onUpdate={updateRecurringExpense}
              onRemove={removeRecurringExpense}
              startOpen
              onCancel={() => setAddPanel(null)}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={addPanel === 'one-time'}
          onOpenChange={(open) => !open && setAddPanel(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add One-time Income</DialogTitle>
              <DialogDescription>
                Gifts, refunds, or other one-off money in.
              </DialogDescription>
            </DialogHeader>
            <OneTimeIncomeManager
              items={[]}
              onAdd={(o) => {
                addOneTimeIncome(o);
                setAddPanel(null);
              }}
              onUpdate={updateOneTimeIncome}
              onRemove={removeOneTimeIncome}
              startOpen
              onCancel={() => setAddPanel(null)}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={addPanel === 'income'}
          onOpenChange={(open) => !open && setAddPanel(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Income Source</DialogTitle>
              <DialogDescription>
                A recurring income stream with its own frequency and rate.
              </DialogDescription>
            </DialogHeader>
            <IncomeSourceManager
              sources={[]}
              onAdd={(s) => {
                addIncomeSource(s);
                setAddPanel(null);
              }}
              onUpdate={updateIncomeSource}
              onRemove={removeIncomeSource}
              startOpen
              onCancel={() => setAddPanel(null)}
            />
          </DialogContent>
        </Dialog>

        {/* --- Goals --- */}
        {settings.goals.length > 0 && (
          <Card className="border-border/50 bg-card/50 hover:border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                Savings Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.goals.map((goal) => {
                const stat = goalStats.find((s) => s.goalId === goal.id);
                if (!stat) return null;

                if (editingGoalId === goal.id) {
                  return (
                    <GoalForm
                      key={goal.id}
                      goal={goal}
                      recurringExpenses={settings.recurringExpenses}
                      onSave={(updated) => {
                        updateGoal(updated);
                        setEditingGoalId(null);
                      }}
                      onCancel={() => setEditingGoalId(null)}
                    />
                  );
                }

                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    stat={stat}
                    recurringExpenses={settings.recurringExpenses}
                    onEdit={() => setEditingGoalId(goal.id)}
                    onDelete={() => removeGoal(goal.id)}
                  />
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* --- Recurring Expenses --- */}
        {settings.recurringExpenses.length > 0 && (
          <Card className="border-border/50 bg-card/50 hover:border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                Recurring Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RecurringExpenseManager
                expenses={settings.recurringExpenses}
                projectionStartDate={settings.startDate}
                onAdd={addRecurringExpense}
                onUpdate={updateRecurringExpense}
                onRemove={removeRecurringExpense}
              />
            </CardContent>
          </Card>
        )}

        {/* --- One-time income --- */}
        {settings.oneTimeIncome.length > 0 && (
          <Card className="border-border/50 bg-card/50 hover:border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                One-time income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OneTimeIncomeManager
                items={settings.oneTimeIncome}
                onAdd={addOneTimeIncome}
                onUpdate={updateOneTimeIncome}
                onRemove={removeOneTimeIncome}
              />
            </CardContent>
          </Card>
        )}

        {/* --- Pocket Money --- */}
        <Card className="border-border/50 bg-card/50 hover:border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Pocket Money
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground/70 text-xs leading-relaxed">
              ${settings.pocketPerPeriod} allocated {pocketFreqLabel}. Click any
              dot to edit what you actually spent. Unspent balance carries over.
            </p>
            <NavStepper
              disablePrev={chartYearClamped <= chartStartYear}
              disableNext={chartYearClamped >= chartEndYear}
              onPrev={() =>
                setChartYear((y) => Math.max(chartStartYear, y - 1))
              }
              onNext={() => setChartYear((y) => Math.min(chartEndYear, y + 1))}
            >
              <span className="min-w-16 text-center font-medium font-mono text-sm">
                {chartYearClamped}
              </span>
            </NavStepper>
            <PocketChart
              data={pocketChartData}
              onUpdateSpent={updateSpentForPeriod}
            />
          </CardContent>
        </Card>

        {/* --- Expense Log --- */}
        <Card className="border-border/50 bg-card/50 hover:border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Log an Expense
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ExpenseForm onAdd={addExpense} />
            <div className="border-border/50 border-t pt-4">
              <ExpenseList
                expenses={expenses}
                paydays={paydays}
                payFrequency={settings.pocketFrequency}
                payInterval={settings.pocketInterval}
                onRemove={removeExpense}
                onUpdateAmount={updateExpenseAmount}
              />
            </div>
          </CardContent>
        </Card>

        <footer className="pt-4 text-center text-muted-foreground/50 text-xs">
          Budget Tracker v2.0 - Data stored locally in your browser
        </footer>
      </div>
    </div>
  );
}
