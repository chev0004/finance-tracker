import type {
  BudgetSettings,
  Expense,
  GoalStat,
  PocketPoint,
  SavingsPoint,
  ValidationError,
} from '@/types';

export interface ExportPayload {
  settings: BudgetSettings;
  expenses: Expense[];
  savedPerPeriod: number;
  savingsTimeline: SavingsPoint[];
  pocketTimeline: PocketPoint[];
  goalStats: GoalStat[];
  eoyBalance: number;
  validationErrors: ValidationError[];
}

function section(title: string, lines: string[]): string {
  return `## ${title}\n${lines.join('\n')}\n`;
}

export function buildExportText(payload: ExportPayload): string {
  const {
    settings,
    expenses,
    savedPerPeriod,
    savingsTimeline,
    pocketTimeline,
    goalStats,
    eoyBalance,
    validationErrors,
  } = payload;
  const freq = settings.payFrequency === 'biweekly' ? 'biweekly' : 'weekly';
  const freqLabel =
    settings.payFrequency === 'biweekly' ? 'every 2 weeks' : 'weekly';

  const summary = [
    `Current balance: $${settings.startingBalance.toLocaleString()}`,
    `Savings ${freqLabel}: $${savedPerPeriod.toLocaleString()}`,
    `Projected end of year: $${eoyBalance.toLocaleString()}`,
  ];

  const settingsLines = [
    `Pay frequency: ${freq}`,
    `First payday: ${settings.firstPayday}`,
    `Income per period: $${settings.incomePerPeriod.toLocaleString()}`,
    `Pocket per period: $${settings.pocketPerPeriod.toLocaleString()}`,
    `Starting balance: $${settings.startingBalance.toLocaleString()}`,
    `Start date: ${settings.startDate}`,
  ];

  const recurringLines =
    settings.recurringExpenses.length > 0
      ? settings.recurringExpenses.map(
          (e) =>
            `${e.label}: $${e.amount.toLocaleString()} on day ${e.dayOfMonth} (${e.startMonth} to ${e.endMonth})`,
        )
      : ['None'];

  const incomeChangeLines =
    settings.incomeChanges.length > 0
      ? settings.incomeChanges
          .slice()
          .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
          .map(
            (c) =>
              `From ${c.effectiveDate}: $${c.incomePerPeriod.toLocaleString()} per period`,
          )
      : ['None'];

  const goalLines = settings.goals.map((goal) => {
    const total = goal.lineItems.reduce((s, i) => s + i.amount, 0);
    const items = goal.lineItems
      .map((i) => `  - ${i.label}: $${i.amount.toLocaleString()}`)
      .join('\n');
    const pause = goal.pauseIncome ? 'Yes' : 'No';
    const paused = goal.pausedExpenseIds.length
      ? ` (paused: ${goal.pausedExpenseIds.join(', ')})`
      : '';
    return `${goal.name} (${goal.startDate} to ${goal.endDate}): $${total.toLocaleString()}\n${items}\n  Pause income: ${pause}${paused}`;
  });

  const expenseLines =
    expenses.length > 0
      ? expenses
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((e) => `${e.date} | ${e.label} | $${e.amount.toLocaleString()}`)
      : ['None'];

  const timelineLines = savingsTimeline.map(
    (p) =>
      `${p.date} (${p.rawDate}): $${p.balance.toLocaleString()} - ${p.label}`,
  );

  const pocketLines = pocketTimeline.map(
    (p) =>
      `${p.date}: spent $${p.spent.toLocaleString()}, available $${p.available.toLocaleString()}, carryover $${p.balance.toLocaleString()} (${p.type})`,
  );

  const goalStatLines = goalStats.map((s) => {
    const goal = settings.goals.find((g) => g.id === s.goalId);
    const name = goal?.name ?? s.goalId;
    return `${name}: pre $${s.preBalance.toLocaleString()}, post $${s.postBalance.toLocaleString()}, feasible ${s.isFeasible}`;
  });

  const validationLines =
    validationErrors.length > 0
      ? validationErrors.map((e) => `- ${e.message}`)
      : ['No issues'];

  const parts = [
    '# Budget snapshot (2026 full-year projection)\n',
    section('Summary', summary),
    section('Settings', settingsLines),
    section('Recurring expenses', recurringLines),
    section('Income changes', incomeChangeLines),
    section('Savings goals', goalLines.length ? goalLines : ['None']),
    section('Goal feasibility', goalStatLines),
    section('Logged expenses', expenseLines),
    section('Savings timeline', timelineLines),
    section('Pocket money by period', pocketLines),
    section('Validation', validationLines),
  ];

  return parts.join('\n');
}
