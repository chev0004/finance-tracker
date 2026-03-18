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
  monthlyIncome: number;
  monthlySavings: number;
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
    monthlyIncome,
    monthlySavings,
    savingsTimeline,
    pocketTimeline,
    goalStats,
    eoyBalance,
    validationErrors,
  } = payload;
  const pocketFreq =
    settings.pocketFrequency === 'custom' && settings.pocketInterval
      ? `every ${settings.pocketInterval} days`
      : settings.pocketFrequency;

  const summary = [
    `Current balance: $${settings.startingBalance.toLocaleString()}`,
    `Savings per month: $${Math.round(monthlySavings).toLocaleString()}`,
    `Projected end of year: $${eoyBalance.toLocaleString()}`,
  ];

  const settingsLines = [
    `Pocket period: ${pocketFreq}`,
    `Pocket start: ${settings.pocketFirstPayday}`,
    `Monthly income: $${Math.round(monthlyIncome).toLocaleString()}`,
    `Pocket per period: $${settings.pocketPerPeriod.toLocaleString()}`,
    `Starting balance: $${settings.startingBalance.toLocaleString()}`,
    `Start date: ${settings.startDate}`,
  ];

  const recurringLines =
    settings.recurringExpenses.length > 0
      ? settings.recurringExpenses.map(
          (e) =>
            `${e.label}: $${e.amount.toLocaleString()} on ${e.dayOfMonth === 0 ? 'last day' : `day ${e.dayOfMonth}`} (${e.startMonth} to ${e.endMonth})`,
        )
      : ['None'];

  const incomeSourceLines =
    settings.incomeSources.length > 0
      ? settings.incomeSources.flatMap((source) => {
          const freq =
            source.payFrequency === 'custom' && source.payInterval
              ? `every ${source.payInterval} days`
              : source.payFrequency;
          const header = `${source.name}: $${source.amount.toLocaleString()} ${freq} (first: ${source.firstPayday})`;
          if (source.rateChanges.length === 0) return [header];
          const changes = source.rateChanges
            .slice()
            .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
            .map(
              (c) =>
                `  From ${c.effectiveDate}: $${c.amount.toLocaleString()} per period`,
            );
          return [header, ...changes];
        })
      : ['None'];

  const oneTimeIncomeLines =
    settings.oneTimeIncome?.length > 0
      ? settings.oneTimeIncome
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((o) => `${o.date} | ${o.label} | +$${o.amount.toLocaleString()}`)
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
    const resume = goal.incomeResumeDate
      ? `\n  Income resumes: ${goal.incomeResumeDate}`
      : '';
    return `${goal.name} (${goal.startDate} to ${goal.endDate}): $${total.toLocaleString()}\n${items}\n  Pause income: ${pause}${paused}${resume}`;
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
    section('Income sources', incomeSourceLines),
    section('One-time income', oneTimeIncomeLines),
    section('Savings goals', goalLines.length ? goalLines : ['None']),
    section('Goal feasibility', goalStatLines),
    section('Logged expenses', expenseLines),
    section('Savings timeline', timelineLines),
    section('Pocket money by period', pocketLines),
    section('Validation', validationLines),
  ];

  return parts.join('\n');
}
