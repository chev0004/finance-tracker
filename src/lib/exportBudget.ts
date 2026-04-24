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
  spentPerPeriod: number[];
  today: string;
  currentSavings: number;
  currentPocketBalance: number;
  combinedBalance: number;
  monthlyIncome: number;
  monthlySavings: number;
  savingsTimeline: SavingsPoint[];
  pocketTimeline: PocketPoint[];
  goalStats: GoalStat[];
  eoyBalance: number;
  eoyCombined: number;
  validationErrors: ValidationError[];
}

function section(title: string, lines: string[]): string {
  return `## ${title}\n${lines.join('\n')}\n`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function buildExportText(payload: ExportPayload): string {
  const {
    settings,
    expenses,
    spentPerPeriod,
    currentSavings,
    currentPocketBalance,
    combinedBalance,
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
    `Current balance: $${formatCurrency(settings.startingBalance)}`,
    `Current savings (as of today): $${formatCurrency(currentSavings)}`,
    `Current pocket (as of today): $${formatCurrency(currentPocketBalance)}`,
    `Current combined (as of today): $${formatCurrency(combinedBalance)}`,
    `Savings per month: $${formatCurrency(monthlySavings)}`,
    `Projected end of year: $${formatCurrency(eoyBalance)}`,
  ];

  const pocketChangeLines =
    settings.pocketPerPeriodChanges.length > 0
      ? settings.pocketPerPeriodChanges
          .slice()
          .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
          .map(
            (c) =>
              `  From ${c.effectiveDate}: $${c.amount.toLocaleString()} per period`,
          )
      : [];

  const settingsLines = [
    `Pocket period: ${pocketFreq}`,
    `Pocket start: ${settings.pocketFirstPayday}`,
    `Monthly income: $${formatCurrency(monthlyIncome)}`,
    `Base pocket / period: $${formatCurrency(settings.pocketPerPeriod)}`,
    ...pocketChangeLines,
    `Starting balance: $${formatCurrency(settings.startingBalance)}`,
    `Start date: ${settings.startDate}`,
  ];

  const recurringLines =
    settings.recurringExpenses.length > 0
      ? settings.recurringExpenses.map((e) => {
          const matchedName =
            e.deductIncomeSourceId &&
            settings.incomeSources.find((s) => s.id === e.deductIncomeSourceId)
              ?.name;
          const parts: string[] = [];
          if (matchedName) parts.push(matchedName);
          if (e.deductFromPocket) parts.push('pocket');
          const tag = parts.length > 0 ? ` [${parts.join(', ')}]` : '';
          const when = e.deductIncomeSourceId
            ? 'each payday of matched source'
            : e.dayOfMonth === 0
              ? 'last day'
              : `day ${e.dayOfMonth}`;
          return `${e.label}: $${e.amount.toLocaleString()} on ${when} (${e.startMonth} to ${e.endMonth})${tag}`;
        })
      : ['None'];

  const paydayOverrideLines =
    settings.paydayIncomeOverrides?.length > 0
      ? settings.paydayIncomeOverrides
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(
            (o) =>
              `${o.date} | source ${o.sourceId} | $${o.amount.toLocaleString()}`,
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

  const manualSpentLines =
    spentPerPeriod.length > 0
      ? spentPerPeriod.map((amount, idx) => `Period ${idx + 1}: $${amount}`)
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
    section('One-off payday income overrides', paydayOverrideLines),
    section('Income sources', incomeSourceLines),
    section('One-time income', oneTimeIncomeLines),
    section('Savings goals', goalLines.length ? goalLines : ['None']),
    section('Goal feasibility', goalStatLines),
    section('Logged expenses', expenseLines),
    section('Manual spent per period overrides', manualSpentLines),
    section('Savings timeline', timelineLines),
    section('Pocket money by period', pocketLines),
    section('Validation', validationLines),
  ];

  return parts.join('\n');
}

export function buildLlmSnapshotMarkdown(payload: ExportPayload): string {
  const {
    settings,
    expenses,
    spentPerPeriod,
    today,
    currentSavings,
    currentPocketBalance,
    combinedBalance,
    monthlyIncome,
    monthlySavings,
    savingsTimeline,
    pocketTimeline,
    goalStats,
    eoyBalance,
    eoyCombined,
    validationErrors,
  } = payload;

  const recurringCount = settings.recurringExpenses.length;
  const goalCount = settings.goals.length;
  const incomeSourceCount = settings.incomeSources.length;
  const oneTimeIncomeCount = settings.oneTimeIncome.length;
  const paydayOverrideCount = settings.paydayIncomeOverrides.length;

  const firstSavingsPoint = savingsTimeline[0];
  const lastSavingsPoint = savingsTimeline[savingsTimeline.length - 1];
  const firstPocketPoint = pocketTimeline[0];
  const lastPocketPoint = pocketTimeline[pocketTimeline.length - 1];

  const feasibleGoals = goalStats.filter((g) => g.isFeasible).length;
  const warningGoals = goalStats.filter((g) => g.isWarning).length;

  const assumptions = [
    '- Pocket spending is driven by expense logs first. If a period has no logged expenses, `spentPerPeriod` is used for that period.',
    '- Pocket carryover is automatic each period, including negative carryover (overage).',
    '- Recurring expenses matched to an income source are applied on each payday for that source.',
    '- Savings goals and recurring expenses are projected across the configured 5-year window from `startDate`.',
  ];

  const gaps = [
    '- No special real-world event modeling beyond the configured inputs (for example: inflation, taxes, interest, market returns, or irregular emergencies) unless manually encoded by the user.',
    '- Pocket balance remains unchanged within a period unless there is logged spending or a manual `spentPerPeriod` override.',
    '- Any future events not entered (new income sources, expenses, overrides, or goals) are not projected.',
  ];

  return [
    '# Budget context for LLM analysis',
    '',
    '## Objective',
    'Use this snapshot to analyze current budget health, timeline risks, and likely future outcomes. Treat this as the full known state plus computed projections at export time.',
    '',
    '## Quick state summary',
    `- Snapshot date: ${today}`,
    `- Start date: ${settings.startDate}`,
    `- Current savings (as of today): $${formatCurrency(currentSavings)}`,
    `- Current pocket (as of today): $${formatCurrency(currentPocketBalance)}`,
    `- Current combined (as of today): $${formatCurrency(combinedBalance)}`,
    `- Monthly income (auto-calculated): $${formatCurrency(monthlyIncome)}`,
    `- Monthly savings (auto-calculated): $${formatCurrency(monthlySavings)}`,
    `- Projected end-of-year savings (auto-calculated): $${formatCurrency(eoyBalance)}`,
    `- Projected end-of-year combined (auto-calculated): $${formatCurrency(eoyCombined)}`,
    `- Inputs: ${expenses.length} logged expenses, ${recurringCount} recurring expenses, ${incomeSourceCount} income sources, ${oneTimeIncomeCount} one-time incomes, ${paydayOverrideCount} payday overrides, ${goalCount} goals`,
    '',
    '## Auto-calculated outputs',
    `- Savings timeline points: ${savingsTimeline.length}${firstSavingsPoint ? ` (${firstSavingsPoint.rawDate} to ${lastSavingsPoint?.rawDate ?? firstSavingsPoint.rawDate})` : ''}`,
    `- Pocket timeline points: ${pocketTimeline.length}${firstPocketPoint ? ` (${firstPocketPoint.rawDate} to ${lastPocketPoint?.rawDate ?? firstPocketPoint.rawDate})` : ''}`,
    `- Goal feasibility: ${feasibleGoals}/${goalStats.length} feasible, warnings: ${warningGoals}`,
    `- Validation issues: ${validationErrors.length}`,
    '',
    '## Modeling assumptions in this app',
    ...assumptions,
    '',
    '## Not auto-calculated or not modeled yet',
    ...gaps,
    '',
    '## Manual inputs that affect projection',
    '- `spentPerPeriod` values are manual overrides used when no expenses are logged in a pocket period.',
    `- \`spentPerPeriod\` entries: ${spentPerPeriod.length}`,
  ].join('\n');
}
