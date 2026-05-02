export interface Expense {
  id: string;
  date: string;
  label: string;
  amount: number;
  weekIdx?: number;
}

export interface GoalLineItem {
  id: string;
  label: string;
  amount: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  lineItems: GoalLineItem[];
  pauseIncome: boolean;
  incomeResumeDate?: string;
  pausePocket: boolean;
  pausedExpenseIds: string[];
  hidden?: boolean;
}

export interface RecurringExpense {
  id: string;
  label: string;
  amount: number;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  deductFromPocket: boolean;
  deductIncomeSourceId?: string;
  hidden?: boolean;
}

export interface RecurringExpenseSkip {
  id: string;
  recurringExpenseId: string;
  date: string;
  amount: number;
  note: string;
}

export type PayFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';

export interface IncomeRateChange {
  id: string;
  effectiveDate: string;
  amount: number;
}

export interface PocketPerPeriodChange {
  id: string;
  effectiveDate: string;
  amount: number;
}

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  payFrequency: PayFrequency;
  firstPayday: string;
  payInterval?: number;
  rateChanges: IncomeRateChange[];
  hidden?: boolean;
  endsOn?: string;
  endsOnIgnored?: boolean;
}

export interface OneTimeIncome {
  id: string;
  date: string;
  label: string;
  amount: number;
  hidden?: boolean;
}

export interface PaydayIncomeOverride {
  id: string;
  date: string;
  sourceId: string;
  amount: number;
}

export interface PocketAmountOverride {
  id: string;
  date: string;
  amount: number;
}

export interface PaydayEditRow {
  sourceId: string;
  name: string;
  scheduledAmount: number;
  currentAmount: number;
}

export interface BudgetSettings {
  startingBalance: number;
  startDate: string;
  pocketPerPeriod: number;
  pocketPerPeriodChanges: PocketPerPeriodChange[];
  pocketFrequency: PayFrequency;
  pocketFirstPayday: string;
  pocketInterval?: number;
  pocketIncomeSourceId?: string;
  goals: SavingsGoal[];
  recurringExpenses: RecurringExpense[];
  recurringExpenseSkips: RecurringExpenseSkip[];
  incomeSources: IncomeSource[];
  oneTimeIncome: OneTimeIncome[];
  paydayIncomeOverrides: PaydayIncomeOverride[];
  pocketAmountOverrides: PocketAmountOverride[];
}

export interface FixedEvent {
  date: string;
  label: string;
  delta: number;
  type:
    | 'payday'
    | 'pocket'
    | 'recurring'
    | 'goal'
    | 'start'
    | 'user-expense'
    | 'payday-recurring'
    | 'one-time';
  sourceId?: string;
  recurringExpenseId?: string;
}

export interface SavingsPointEvent {
  label: string;
  delta: number;
  type: FixedEvent['type'];
  sourceId?: string;
  recurringExpenseId?: string;
}

export interface SavingsPoint {
  date: string;
  rawDate: string;
  balance: number;
  label: string;
  type: FixedEvent['type'];
  events: SavingsPointEvent[];
}

export interface PocketExpenseItem {
  label: string;
  amount: number;
  date?: string;
  recurringExpenseId?: string;
}

export interface PocketPoint {
  date: string;
  rawDate: string;
  weekStart: string;
  weekEnd: string;
  balance: number;
  available: number;
  spent: number;
  overage: number;
  type: 'surplus' | 'over' | 'flat';
  idx: number;
  expenseCount: number;
  pocketAllocated: number;
  scheduledPocket: number;
  expenseItems: PocketExpenseItem[];
}

export interface GoalStat {
  goalId: string;
  totalCost: number;
  preBalance: number;
  postBalance: number;
  isFeasible: boolean;
  isWarning: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface BudgetState {
  expenses: Expense[];
  spentPerPeriod: number[];
  settings: BudgetSettings;
}
