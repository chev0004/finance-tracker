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
  pausePocket: boolean;
  pausedExpenseIds: string[];
}

export interface RecurringExpense {
  id: string;
  label: string;
  amount: number;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string;
}

export type PayFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';

export interface IncomeRateChange {
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
}

export interface BudgetSettings {
  startingBalance: number;
  startDate: string;
  pocketPerPeriod: number;
  pocketFrequency: PayFrequency;
  pocketFirstPayday: string;
  pocketInterval?: number;
  goals: SavingsGoal[];
  recurringExpenses: RecurringExpense[];
  incomeSources: IncomeSource[];
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
    | 'payday-recurring';
}

export interface SavingsPointEvent {
  label: string;
  delta: number;
  type: FixedEvent['type'];
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
