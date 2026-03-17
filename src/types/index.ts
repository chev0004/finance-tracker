export interface Expense {
  id: string;
  date: string;
  label: string;
  amount: number;
  weekIdx?: number;
}

export interface FixedEvent {
  date: string;
  label: string;
  delta: number;
  type:
    | 'payday'
    | 'rent'
    | 'fixed-expense'
    | 'trip'
    | 'start'
    | 'user-expense'
    | 'payday-rent';
}

export interface SavingsPoint {
  date: string;
  rawDate: string;
  balance: number;
  label: string;
  type: FixedEvent['type'];
}

export interface PocketPoint {
  date: string;
  rawDate: string;
  weekStart: string;
  weekEnd: string;
  balance: number;
  available: number;
  spent: number;
  type: 'surplus' | 'over' | 'flat';
  idx: number;
  expenseCount: number;
}

export interface BudgetSettings {
  startingBalance: number;
  tripCost: number;
  weeklySave: number;
  weeklyPocket: number;
  tripMonth: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface BudgetState {
  expenses: Expense[];
  spentPerWeek: number[];
  settings: BudgetSettings;
}
