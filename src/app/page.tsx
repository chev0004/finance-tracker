'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { ExpenseForm } from '@/components/features/budget/ExpenseForm';
import { ExpenseList } from '@/components/features/budget/ExpenseList';
import { GoalCard } from '@/components/features/budget/GoalCard';
import { GoalForm } from '@/components/features/budget/GoalForm';
import { PocketChart } from '@/components/features/budget/PocketChart';
import { RecurringExpenseManager } from '@/components/features/budget/RecurringExpenseManager';
import { SavingsChart } from '@/components/features/budget/SavingsChart';
import { SettingsPanel } from '@/components/features/budget/SettingsPanel';
import { StatsCard } from '@/components/features/budget/StatsCard';
import { ValidationAlert } from '@/components/features/budget/ValidationAlert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBudget } from '@/hooks/useBudget';

export default function Home() {
  const {
    isLoaded,
    expenses,
    settings,
    savedPerPeriod,
    savingsTimeline,
    pocketTimeline,
    goalStats,
    stats,
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
    addIncomeChange,
    updateIncomeChange,
    removeIncomeChange,
  } = useBudget();

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [showAddGoal, setShowAddGoal] = useState(false);

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

  const freqLabel = settings.payFrequency === 'biweekly' ? '/2wk' : '/wk';
  const eoyVariant =
    stats.eoy < 0 ? 'danger' : stats.eoy < 500 ? 'warning' : 'success';

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

        <div className="grid grid-cols-3 gap-3">
          <StatsCard label="Current Balance" value={settings.startingBalance} />
          <StatsCard
            label={`Savings ${freqLabel}`}
            value={savedPerPeriod}
            variant="success"
            prefix="+"
          />
          <StatsCard
            label="End of Year"
            value={stats.eoy}
            variant={eoyVariant}
          />
        </div>

        <SettingsPanel
          settings={settings}
          savedPerPeriod={savedPerPeriod}
          onUpdate={updateSettings}
          onAddIncomeChange={addIncomeChange}
          onUpdateIncomeChange={updateIncomeChange}
          onRemoveIncomeChange={removeIncomeChange}
        />

        {/* --- Savings --- */}
        <Card className="border-border/50 bg-card/50 hover:border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Savings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ValidationAlert
              errors={validation.errors}
              isCritical={validation.isCritical}
            />
            <SavingsChart data={savingsTimeline} />
            <p className="text-muted-foreground/70 text-xs leading-relaxed">
              ${savedPerPeriod} saved{' '}
              {settings.payFrequency === 'biweekly'
                ? 'every two weeks'
                : 'each week'}{' '}
              (${settings.incomePerPeriod} income minus $
              {settings.pocketPerPeriod} pocket money).
              {settings.recurringExpenses.length > 0 && (
                <>
                  {' '}
                  {settings.recurringExpenses
                    .map(
                      (e) => `${e.label} $${e.amount} on the ${e.dayOfMonth}th`,
                    )
                    .join(', ')}
                  .
                </>
              )}
            </p>
          </CardContent>
        </Card>

        {/* --- Goals --- */}
        <Card className="border-border/50 bg-card/50 hover:border-border/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Savings Goals
            </CardTitle>
            {!showAddGoal && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs hover:text-foreground"
                onClick={() => setShowAddGoal(true)}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Goal
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {settings.goals.length === 0 && !showAddGoal && (
              <p className="py-4 text-muted-foreground/60 text-sm">
                No goals yet. Add one to start tracking.
              </p>
            )}

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

            {showAddGoal && (
              <GoalForm
                recurringExpenses={settings.recurringExpenses}
                onSave={(goal) => {
                  addGoal(goal);
                  setShowAddGoal(false);
                }}
                onCancel={() => setShowAddGoal(false)}
              />
            )}
          </CardContent>
        </Card>

        {/* --- Recurring Expenses --- */}
        <Card className="border-border/50 bg-card/50 hover:border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Recurring Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecurringExpenseManager
              expenses={settings.recurringExpenses}
              onAdd={addRecurringExpense}
              onUpdate={updateRecurringExpense}
              onRemove={removeRecurringExpense}
            />
          </CardContent>
        </Card>

        {/* --- Pocket Money --- */}
        <Card className="border-border/50 bg-card/50 hover:border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              {settings.payFrequency === 'biweekly' ? 'Biweekly' : 'Weekly'}{' '}
              Pocket Money
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground/70 text-xs leading-relaxed">
              ${settings.pocketPerPeriod} allocated every{' '}
              {settings.payFrequency === 'biweekly' ? 'two weeks' : 'week'}.
              Click any dot to edit what you actually spent. Unspent balance
              carries over.
            </p>
            <PocketChart
              data={pocketTimeline}
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
                payFrequency={settings.payFrequency}
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
