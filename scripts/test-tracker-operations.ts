import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import type { BudgetSettings, BudgetState, BudgetWorkspace } from '@/types';

const testDirectory = await mkdtemp(join(tmpdir(), 'finance-tracker-test-'));
process.env.DATABASE_URL = `file:${join(testDirectory, 'tracker.db')}`;

const client = createClient({ url: process.env.DATABASE_URL });
await client.execute(`CREATE TABLE user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_verified INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);
await client.execute(`CREATE TABLE budget (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`);

const settings = (): BudgetSettings => ({
  startingBalance: 0,
  startDate: '2026-01-01',
  pocketPerPeriod: 100,
  pocketPerPeriodChanges: [],
  pocketFrequency: 'weekly',
  pocketFirstPayday: '2026-01-01',
  goals: [],
  recurringExpenses: [],
  recurringExpenseSkips: [],
  incomeSources: [],
  oneTimeIncome: [],
  paydayIncomeOverrides: [],
  pocketAmountOverrides: [],
});

const state = (): BudgetState => ({
  expenses: [],
  spentPerPeriod: [],
  settings: settings(),
});

const workspace = (): BudgetWorkspace => ({
  activeBranchId: 'active',
  branches: [
    {
      id: 'active',
      name: 'Active',
      state: state(),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'other',
      name: 'Other',
      state: state(),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
});

const firstWorkspace = workspace();
const secondWorkspace = workspace();
for (const [userId, data] of [
  ['user-a', firstWorkspace],
  ['user-b', secondWorkspace],
] as const) {
  await client.execute({
    sql: 'INSERT INTO budget (user_id, data, updated_at) VALUES (?, ?, ?)',
    args: [userId, JSON.stringify(data), Date.now()],
  });
}

const {
  addOneTimeIncome,
  addPocketExpenses,
  addRecurringExpense,
  addSavingsGoal,
  setRecurringExpenseAmounts,
} = await import('@/lib/tracker-operations');

await addPocketExpenses('user-a', [
  { date: '2026-08-22', label: 'Rice', amount: 28.49 },
]);
const recurring = await addRecurringExpense('user-a', {
  label: 'Internet',
  amount: 75,
  dayOfMonth: 5,
  startDate: '2026-09-05',
  endMonth: null,
  occurrenceOverrides: [],
  deductFromPocket: false,
});
await addSavingsGoal('user-a', {
  name: 'Trip',
  startDate: '2026-10-01',
  endDate: '2026-10-10',
  lineItems: [{ label: 'Hotel', amount: 500 }],
  pauseIncome: false,
  pausePocket: false,
  pausedExpenseIds: [],
});
await addOneTimeIncome('user-a', {
  date: '2026-09-01',
  label: 'Bonus',
  amount: 250,
});
await setRecurringExpenseAmounts('user-a', recurring.value.id, [
  { scheduledDate: '2026-10-05', amount: 80 },
]);

const firstRow = await client.execute({
  sql: 'SELECT data FROM budget WHERE user_id = ?',
  args: ['user-a'],
});
const secondRow = await client.execute({
  sql: 'SELECT data FROM budget WHERE user_id = ?',
  args: ['user-b'],
});
const updated = JSON.parse(String(firstRow.rows[0].data)) as BudgetWorkspace;
const untouched = JSON.parse(String(secondRow.rows[0].data)) as BudgetWorkspace;
const active = updated.branches.find(({ id }) => id === 'active')?.state;
assert.equal(active?.expenses.length, 1);
assert.equal(active?.settings.recurringExpenses.length, 1);
assert.equal(
  active?.settings.recurringExpenses[0].occurrenceOverrides?.[0].amount,
  80,
);
assert.equal(active?.settings.goals.length, 1);
assert.equal(active?.settings.oneTimeIncome.length, 1);
assert.deepEqual(
  updated.branches.find(({ id }) => id === 'other')?.state,
  firstWorkspace.branches[1].state,
);
assert.deepEqual(untouched, secondWorkspace);

client.close();
