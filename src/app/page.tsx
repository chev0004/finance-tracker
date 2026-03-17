'use client';

import { ExpenseForm } from '@/components/features/budget/ExpenseForm';
import { ExpenseList } from '@/components/features/budget/ExpenseList';
import { PocketChart } from '@/components/features/budget/PocketChart';
import { SavingsChart } from '@/components/features/budget/SavingsChart';
import { StatsCard } from '@/components/features/budget/StatsCard';
import { TripMonthSelector } from '@/components/features/budget/TripMonthSelector';
import { ValidationAlert } from '@/components/features/budget/ValidationAlert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBudget } from '@/hooks/useBudget';

export default function Home() {
  const {
    isLoaded,
    expenses,
    settings,
    savingsTimeline,
    pocketTimeline,
    stats,
    validation,
    addExpense,
    removeExpense,
    updateSpentForWeek,
    updateTripMonth,
  } = useBudget();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  const postTripVariant =
    stats.post < 0 ? 'danger' : stats.post < 500 ? 'warning' : 'success';

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="mb-6">
          <h1 className="font-mono text-muted-foreground text-sm uppercase tracking-wider">
            chev.dev / budget tracker
          </h1>
          <p className="mt-1 text-muted-foreground/60 text-xs">
            2026 full-year projection
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatsCard
            label="Current Balance"
            value={settings.startingBalance}
            variant="default"
          />
          <StatsCard
            label="Weekly Income (Saved)"
            value={settings.weeklySave}
            variant="success"
            prefix="+"
          />
          <StatsCard label="End of Year" value={stats.eoy} variant="success" />
          <StatsCard
            label="Pre-Trip Balance"
            value={stats.pre}
            variant="success"
          />
          <StatsCard
            label="After trip"
            value={stats.post}
            variant={postTripVariant}
          />
        </div>

        <Card className="border-border/50 bg-card/50 hover:border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Savings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TripMonthSelector
              value={settings.tripMonth}
              onChange={updateTripMonth}
            />

            <ValidationAlert
              errors={validation.errors}
              isCritical={validation.isCritical}
            />

            <SavingsChart data={savingsTimeline} />

            <p className="text-muted-foreground/70 text-xs leading-relaxed">
              ${settings.weeklySave} saved each Friday ($
              {settings.weeklySave + settings.weeklyPocket} income minus $
              {settings.weeklyPocket} pocket money). Rent $65 on the 15th.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 hover:border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Weekly Pocket Money
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground/70 text-xs leading-relaxed">
              ${settings.weeklyPocket} allocated every Friday. Click any dot to
              edit what you actually spent. Unspent balance carries over to the
              next week.
            </p>

            <PocketChart
              data={pocketTimeline}
              onUpdateSpent={updateSpentForWeek}
            />
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 hover:border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Log an Expense
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ExpenseForm onAdd={addExpense} />
            <div className="border-border/50 border-t pt-4">
              <ExpenseList expenses={expenses} onRemove={removeExpense} />
            </div>
          </CardContent>
        </Card>

        <footer className="pt-4 text-center text-muted-foreground/50 text-xs">
          Budget Tracker v1.0 - Data stored locally in your browser
        </footer>
      </div>
    </div>
  );
}
