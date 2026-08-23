import { eq } from 'drizzle-orm';
import { budget } from '@/db/schema';
import { db } from '@/lib/db';
import { readTrackerData, TrackerDataError } from '@/lib/tracker-data';
import type {
  BudgetState,
  BudgetWorkspace,
  GoalLineItem,
  OneTimeIncome,
  RecurringExpense,
  SavingsGoal,
} from '@/types';

type ActiveBranchResult<T> = {
  activeBranchId: string | null;
  activeBranchName: string;
  value: T;
};

function isWorkspace(
  data: BudgetState | BudgetWorkspace,
): data is BudgetWorkspace {
  return 'activeBranchId' in data && Array.isArray(data.branches);
}

async function updateActiveBranch<T>(
  userId: string,
  update: (state: BudgetState) => { state: BudgetState; value: T },
): Promise<ActiveBranchResult<T>> {
  const data = await readTrackerData(userId);
  if (!isWorkspace(data)) {
    const updated = update(data);
    await db
      .update(budget)
      .set({ data: JSON.stringify(updated.state), updatedAt: new Date() })
      .where(eq(budget.userId, userId));
    return {
      activeBranchId: null,
      activeBranchName: 'Main',
      value: updated.value,
    };
  }

  const index = data.branches.findIndex(
    (branch) => branch.id === data.activeBranchId,
  );
  if (index < 0) throw new TrackerDataError('Active branch not found');
  const current = data.branches[index];
  const updated = update(current.state);
  const branches = [...data.branches];
  branches[index] = {
    ...current,
    state: updated.state,
    updatedAt: new Date().toISOString(),
  };
  await db
    .update(budget)
    .set({
      data: JSON.stringify({ ...data, branches }),
      updatedAt: new Date(),
    })
    .where(eq(budget.userId, userId));
  return {
    activeBranchId: current.id,
    activeBranchName: current.name,
    value: updated.value,
  };
}

export async function addPocketExpenses(
  userId: string,
  inputs: Array<{ date: string; label: string; amount: number }>,
) {
  return updateActiveBranch(userId, (state) => {
    const expenses = inputs.map((input) => ({
      id: crypto.randomUUID(),
      date: input.date,
      label: input.label.trim(),
      amount: input.amount,
    }));
    return {
      state: { ...state, expenses: [...state.expenses, ...expenses] },
      value: expenses,
    };
  });
}

export async function addRecurringExpense(
  userId: string,
  input: Omit<RecurringExpense, 'id' | 'startMonth'>,
) {
  return updateActiveBranch(userId, (state) => {
    const expense: RecurringExpense = {
      ...input,
      id: crypto.randomUUID(),
      label: input.label.trim(),
      startDate: input.startDate,
      startMonth: input.startDate?.slice(0, 7) ?? '',
      endMonth: input.endMonth ?? null,
      prorateFirstMonth: input.prorateFirstMonth ?? false,
      occurrenceOverrides: input.occurrenceOverrides ?? [],
      deductFromPocket: input.deductFromPocket ?? false,
    };
    return {
      state: {
        ...state,
        settings: {
          ...state.settings,
          recurringExpenses: [...state.settings.recurringExpenses, expense],
        },
      },
      value: expense,
    };
  });
}

export async function addSavingsGoal(
  userId: string,
  input: Omit<SavingsGoal, 'id' | 'lineItems'> & {
    lineItems: Array<Omit<GoalLineItem, 'id'>>;
  },
) {
  return updateActiveBranch(userId, (state) => {
    const goal: SavingsGoal = {
      ...input,
      id: crypto.randomUUID(),
      name: input.name.trim(),
      lineItems: input.lineItems.map((item) => ({
        id: crypto.randomUUID(),
        label: item.label.trim(),
        amount: item.amount,
      })),
      pauseIncome: input.pauseIncome ?? false,
      pausePocket: input.pausePocket ?? false,
      pausedExpenseIds: input.pausedExpenseIds ?? [],
    };
    return {
      state: {
        ...state,
        settings: {
          ...state.settings,
          goals: [...state.settings.goals, goal],
        },
      },
      value: goal,
    };
  });
}

export async function addOneTimeIncome(
  userId: string,
  input: Omit<OneTimeIncome, 'id'>,
) {
  return updateActiveBranch(userId, (state) => {
    const income: OneTimeIncome = {
      ...input,
      id: crypto.randomUUID(),
      label: input.label.trim(),
    };
    return {
      state: {
        ...state,
        settings: {
          ...state.settings,
          oneTimeIncome: [...state.settings.oneTimeIncome, income],
        },
      },
      value: income,
    };
  });
}

export async function setRecurringExpenseAmounts(
  userId: string,
  recurringExpenseId: string,
  amounts: Array<{ scheduledDate: string; amount: number }>,
) {
  return updateActiveBranch(userId, (state) => {
    const index = state.settings.recurringExpenses.findIndex(
      (expense) => expense.id === recurringExpenseId,
    );
    if (index < 0) throw new TrackerDataError('Recurring expense not found');
    const current = state.settings.recurringExpenses[index];
    const replacements = new Map(
      amounts.map((entry) => [entry.scheduledDate, entry.amount]),
    );
    const occurrenceOverrides = (current.occurrenceOverrides ?? []).map(
      (override) =>
        replacements.has(override.scheduledDate)
          ? {
              ...override,
              amount: replacements.get(override.scheduledDate),
            }
          : override,
    );
    for (const [scheduledDate, amount] of replacements) {
      if (
        !occurrenceOverrides.some(
          (override) => override.scheduledDate === scheduledDate,
        )
      ) {
        occurrenceOverrides.push({ scheduledDate, amount });
      }
    }
    const expense = { ...current, occurrenceOverrides };
    const recurringExpenses = [...state.settings.recurringExpenses];
    recurringExpenses[index] = expense;
    return {
      state: {
        ...state,
        settings: { ...state.settings, recurringExpenses },
      },
      value: expense,
    };
  });
}
