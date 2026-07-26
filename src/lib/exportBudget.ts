import ExcelJS from 'exceljs';

import type {
  BudgetSettings,
  Expense,
  FixedEvent,
  GoalStat,
  IncomeSource,
  PocketExpenseItem,
  PocketPoint,
  SavingsPoint,
  SavingsPointEvent,
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

export interface ExportDateRange {
  startDate: string;
  endDate: string;
}

export interface ExportOptions {
  dateRanges?: ExportDateRange[];
}

type AccountName = 'Savings' | 'Pocket';

interface LedgerDraft {
  date: string;
  account: AccountName;
  category: string;
  description: string;
  reference: string;
  delta: number;
  order: number;
  source?: string;
  transactionGroup?: string;
}

interface LedgerRow extends LedgerDraft {
  savingsBalance: number;
  pocketBalance: number;
  combinedBalance: number;
}

function maxIsoDate(a: string, b: string): string {
  return a > b ? a : b;
}

function getProjectionEnd(payload: ExportPayload): string {
  const startYear = new Date(
    `${payload.settings.startDate}T00:00:00`,
  ).getFullYear();
  let end = `${startYear + 4}-12-31`;

  for (const point of payload.savingsTimeline) {
    end = maxIsoDate(end, point.rawDate);
  }
  for (const point of payload.pocketTimeline) {
    end = maxIsoDate(end, point.weekEnd);
  }

  return end;
}

export function getExportDateBounds(payload: ExportPayload): ExportDateRange {
  return {
    startDate: payload.settings.startDate,
    endDate: getProjectionEnd(payload),
  };
}

export function getExportYears(payload: ExportPayload): number[] {
  const { startDate, endDate } = getExportDateBounds(payload);
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));

  return Array.from(
    { length: endYear - startYear + 1 },
    (_, index) => startYear + index,
  );
}

function isDateIncluded(date: string, options?: ExportOptions): boolean {
  if (!options?.dateRanges?.length) return true;
  return options.dateRanges.some(
    (range) => date >= range.startDate && date <= range.endDate,
  );
}

function savingsCategory(type: FixedEvent['type']): string {
  if (type === 'payday') return 'Income';
  if (type === 'one-time') return 'Income';
  if (type === 'recurring') return 'Recurring Expense';
  if (type === 'goal') return 'Savings Goal';
  if (type === 'user-expense') return 'Pocket Overage';
  if (type === 'payday-recurring') return 'Mixed Activity';
  return 'Adjustment';
}

function paycheckGroup(source: IncomeSource, date: string): string {
  return `${source.name} paycheck ${date}`;
}

function eventReference(event: SavingsPointEvent): string {
  if (event.sourceId) return event.sourceId;
  if (event.recurringExpenseId) return event.recurringExpenseId;
  return event.type;
}

function isExpenseInPeriod(
  expense: Expense,
  period: Pick<PocketPoint, 'weekStart' | 'weekEnd'>,
): boolean {
  return expense.date >= period.weekStart && expense.date <= period.weekEnd;
}

function findExpenseDate(
  item: PocketExpenseItem,
  period: PocketPoint,
  expenses: Expense[],
  usedExpenseIds: Set<string>,
): string {
  if (item.date) return item.date;

  const match = expenses.find(
    (expense) =>
      !usedExpenseIds.has(expense.id) &&
      isExpenseInPeriod(expense, period) &&
      expense.label === item.label &&
      Math.abs(expense.amount - item.amount) < 0.005,
  );
  if (!match) return period.weekEnd;

  usedExpenseIds.add(match.id);
  return match.date;
}

function buildSavingsDrafts(payload: ExportPayload): LedgerDraft[] {
  const rows: LedgerDraft[] = [];
  const sorted = [...payload.savingsTimeline].sort((a, b) =>
    a.rawDate.localeCompare(b.rawDate),
  );
  const opening =
    sorted[0]?.balance ??
    payload.currentSavings ??
    payload.settings.startingBalance;

  rows.push({
    date: payload.settings.startDate,
    account: 'Savings',
    category: 'Opening Balance',
    description: 'Starting savings balance',
    reference: 'start',
    delta: opening,
    order: 0,
  });

  for (const point of sorted) {
    if (point.rawDate <= payload.settings.startDate) continue;
    point.events.forEach((event, index) => {
      const goal =
        event.type === 'goal'
          ? payload.settings.goals.find((item) => item.id === event.sourceId)
          : undefined;
      const source = payload.settings.incomeSources.find(
        (item) => item.id === event.sourceId,
      );
      const isPaycheckSplit =
        source?.id === payload.settings.pocketIncomeSourceId &&
        payload.pocketTimeline.some(
          (period) =>
            period.rawDate === point.rawDate && period.pocketAllocated > 0,
        );

      if (goal && goal.lineItems.length > 0) {
        goal.lineItems.forEach((item, itemIndex) => {
          rows.push({
            date: point.rawDate,
            account: 'Savings',
            category: 'Savings Goal',
            description: `${goal.name}: ${item.label}`,
            reference: goal.id,
            delta: -item.amount,
            order: 100 + index + itemIndex / 100,
          });
        });
        return;
      }

      rows.push({
        date: point.rawDate,
        account: 'Savings',
        category:
          isPaycheckSplit && source
            ? 'Paycheck Split'
            : savingsCategory(event.type),
        description:
          isPaycheckSplit && source
            ? `Savings share of ${source.name} paycheck`
            : event.label,
        reference: eventReference(event),
        delta: event.delta,
        order: 100 + index,
        source: source?.name,
        transactionGroup: source
          ? paycheckGroup(source, point.rawDate)
          : undefined,
      });
    });
  }

  return rows;
}

function buildPocketDrafts(payload: ExportPayload): LedgerDraft[] {
  const rows: LedgerDraft[] = [];
  const usedExpenseIds = new Set<string>();
  const pocketSource = payload.settings.incomeSources.find(
    (source) => source.id === payload.settings.pocketIncomeSourceId,
  );
  let pocketBalance = 0;

  for (const period of [...payload.pocketTimeline].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  )) {
    if (period.pocketAllocated > 0) {
      rows.push({
        date: period.rawDate,
        account: 'Pocket',
        category: pocketSource ? 'Paycheck Split' : 'Pocket Allocation',
        description: pocketSource
          ? `Pocket share of ${pocketSource.name} paycheck`
          : 'Pocket money allocation',
        reference: period.date,
        delta: period.pocketAllocated,
        order: 50,
        source: pocketSource?.name,
        transactionGroup: pocketSource
          ? paycheckGroup(pocketSource, period.rawDate)
          : undefined,
      });
      pocketBalance += period.pocketAllocated;
    }

    const items = period.expenseItems
      .map((item) => ({
        item,
        date: findExpenseDate(item, period, payload.expenses, usedExpenseIds),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < items.length; i++) {
      const { date, item } = items[i];
      const covered = Math.min(item.amount, pocketBalance);
      if (covered <= 0) continue;

      rows.push({
        date,
        account: 'Pocket',
        category: item.recurringExpenseId ? 'Recurring Expense' : 'Expense',
        description: item.label,
        reference: item.recurringExpenseId ?? period.date,
        delta: -covered,
        order: 200 + i,
      });
      pocketBalance -= covered;
    }

    pocketBalance = period.balance;
  }

  return rows;
}

function buildLedgerRows(payload: ExportPayload): LedgerRow[] {
  const projectionEnd = getProjectionEnd(payload);
  const drafts = [
    ...buildSavingsDrafts(payload),
    ...buildPocketDrafts(payload),
    {
      date: projectionEnd,
      account: 'Savings' as const,
      category: 'Closing Balance',
      description: 'Projection end balance',
      reference: 'projection-end',
      delta: 0,
      order: 999,
    },
  ]
    .filter((row) => row.date <= projectionEnd)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.order - b.order ||
        a.account.localeCompare(b.account) ||
        a.description.localeCompare(b.description),
    );

  let savingsBalance = 0;
  let pocketBalance = 0;

  return drafts.map((row) => {
    if (row.account === 'Savings') savingsBalance += row.delta;
    if (row.account === 'Pocket') pocketBalance += row.delta;

    return {
      ...row,
      savingsBalance,
      pocketBalance,
      combinedBalance: savingsBalance + pocketBalance,
    };
  });
}

function argb(hex: string): string {
  return `FF${hex.replace('#', '')}`;
}

function accountFill(account: AccountName): ExcelJS.Fill {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: argb(account === 'Savings' ? '#ede9fe' : '#dbeafe') },
  };
}

function accountFontColor(account: AccountName): string {
  return argb(account === 'Savings' ? '#5b21b6' : '#1d4ed8');
}

interface CategoryColors {
  bg: string;
  fg: string;
}

function categoryColors(category: string): CategoryColors {
  if (category === 'Pocket Allocation' || category === 'Paycheck Split')
    return { bg: '#e0f2fe', fg: '#0369a1' };
  if (category === 'Opening Balance') return { bg: '#ede9fe', fg: '#5b21b6' };
  if (category === 'Closing Balance') return { bg: '#ddd6fe', fg: '#4c1d95' };
  if (category === 'Expense' || category === 'Recurring Expense')
    return { bg: '#fee2e2', fg: '#991b1b' };
  if (category === 'Pocket Overage') return { bg: '#ffedd5', fg: '#9a3412' };
  if (category === 'Income') return { bg: '#dcfce7', fg: '#065f46' };
  if (category === 'Savings Goal') return { bg: '#fce7f3', fg: '#9d174d' };
  if (category === 'Mixed Activity') return { bg: '#e0e7ff', fg: '#3730a3' };
  return { bg: '#e5e7eb', fg: '#374151' };
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFe2e8f0' } },
  left: { style: 'thin', color: { argb: 'FFe2e8f0' } },
  bottom: { style: 'thin', color: { argb: 'FFe2e8f0' } },
  right: { style: 'thin', color: { argb: 'FFe2e8f0' } },
};

const MONEY_FMT = '#,##0.00';

function styleHeaderRow(
  row: ExcelJS.Row,
  moneyColumns: Set<number>,
  fills: Record<number, string> = {},
): void {
  row.eachCell((cell, col) => {
    cell.font = { bold: true, size: 11, color: { argb: 'FF0f172a' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(fills[col] ?? '#f0f4f8') },
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFc8d6e0' } },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: moneyColumns.has(col) ? 'right' : 'left',
      wrapText: false,
    };
  });
  row.height = 22;
}

function addGuideSheet(
  workbook: ExcelJS.Workbook,
  payload: ExportPayload,
  options?: ExportOptions,
): void {
  const sheet = workbook.addWorksheet('Guide');
  const pocketSource = payload.settings.incomeSources.find(
    (source) => source.id === payload.settings.pocketIncomeSourceId,
  );
  const scope =
    options?.dateRanges
      ?.map((range) => `${range.startDate} through ${range.endDate}`)
      .join(', ') ?? 'All dates';

  sheet.columns = [{ width: 24 }, { width: 105 }];
  sheet.mergeCells('A1:B1');
  const title = sheet.getCell('A1');
  title.value = 'Finance Tracker Export Guide';
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  title.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0f172a' },
  };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 30;

  sheet.addRows([
    [],
    ['As of', payload.today],
    ['Export scope', scope],
    ['Current savings', payload.currentSavings],
    ['Current pocket', payload.currentPocketBalance],
    ['Current combined', payload.combinedBalance],
    [],
    [
      'Actual rows',
      `Budget Ledger rows dated through ${payload.today} reflect recorded activity and scheduled items due by the as-of date.`,
    ],
    [
      'Projected rows',
      `Rows after ${payload.today} contain scheduled income, recurring expenses, goals, and pocket allocations. Missing future discretionary expenses are unknown, not zero.`,
    ],
    [
      'Paycheck split',
      pocketSource
        ? `${pocketSource.name} paychecks are split between Savings and Pocket. Rows with the same Transaction Group are parts of one paycheck. The Pocket share is not extra income and is not funded by another Savings withdrawal.`
        : 'Pocket allocations are shown separately from external income.',
    ],
    [
      'Projected balances',
      'Savings Balance remains projected. Pocket Balance and Combined Balance are blank after the as-of date because future discretionary spending is unknown.',
    ],
    [
      'Inflow and outflow',
      'These columns show changes to the named account. Inflow does not always mean a separate external income source.',
    ],
  ]);

  for (let rowNumber = 3; rowNumber <= 13; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    row.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFf1f5f9' },
    };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFe2e8f0' } },
      };
    });
  }

  for (const rowNumber of [5, 6, 7]) {
    sheet.getRow(rowNumber).getCell(2).numFmt = MONEY_FMT;
  }

  sheet.getRow(9).height = 34;
  sheet.getRow(10).height = 46;
  sheet.getRow(11).height = 46;
  sheet.getRow(12).height = 34;
  sheet.getRow(13).height = 34;
  sheet.views = [{ showGridLines: false }];
}

function addGoalsSheet(
  workbook: ExcelJS.Workbook,
  payload: ExportPayload,
  options?: ExportOptions,
): void {
  const sheet = workbook.addWorksheet('Goals');
  sheet.columns = [
    { key: 'goal', width: 28 },
    { key: 'item', width: 34 },
    { key: 'amount', width: 14 },
    { key: 'total', width: 14 },
    { key: 'startDate', width: 13 },
    { key: 'endDate', width: 13 },
    { key: 'visibility', width: 12 },
    { key: 'status', width: 14 },
    { key: 'preBalance', width: 17 },
    { key: 'postBalance', width: 17 },
  ];

  const headerRow = sheet.addRow([
    'Goal',
    'Line Item',
    'Amount',
    'Goal Total',
    'Start Date',
    'End Date',
    'Visibility',
    'Status',
    'Balance Before',
    'Balance After',
  ]);
  styleHeaderRow(headerRow, new Set([3, 4, 9, 10]), {
    3: '#fce7f3',
    4: '#fce7f3',
    9: '#c6edd9',
    10: '#c6edd9',
  });

  const goals = [...payload.settings.goals]
    .filter((goal) => isDateIncluded(goal.startDate, options))
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name),
    );

  for (const goal of goals) {
    const stat = payload.goalStats.find((item) => item.goalId === goal.id);
    const total = goal.lineItems.reduce((sum, item) => sum + item.amount, 0);
    const lineItems = goal.lineItems.length
      ? goal.lineItems
      : [{ id: '', label: '(No line items)', amount: 0 }];
    const status = goal.hidden
      ? 'Excluded'
      : stat?.isFeasible === false
        ? 'Shortfall'
        : stat?.isWarning
          ? 'Warning'
          : 'Feasible';

    for (const item of lineItems) {
      const row = sheet.addRow({
        goal: goal.name,
        item: item.label,
        amount: item.amount,
        total,
        startDate: goal.startDate,
        endDate: goal.endDate,
        visibility: goal.hidden ? 'Hidden' : 'Included',
        status,
        preBalance: stat?.preBalance ?? null,
        postBalance: stat?.postBalance ?? null,
      });

      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = THIN_BORDER;
        cell.alignment = { vertical: 'top', horizontal: 'left' };
        if ([3, 4, 9, 10].includes(col)) {
          cell.numFmt = MONEY_FMT;
          cell.alignment = { vertical: 'top', horizontal: 'right' };
        }
        if (col === 1) cell.font = { bold: true };
        if (col === 8 && status !== 'Feasible') {
          cell.font = { color: { argb: 'FFb45309' }, bold: true };
        }
      });
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  sheet.autoFilter = 'A1:J1';
}

export async function buildBudgetXlsx(
  payload: ExportPayload,
  options?: ExportOptions,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Finance Tracker';
  workbook.created = new Date();

  addGuideSheet(workbook, payload, options);
  const sheet = workbook.addWorksheet('Budget Ledger');

  sheet.columns = [
    { key: 'date', width: 13 },
    { key: 'status', width: 12 },
    { key: 'account', width: 10 },
    { key: 'category', width: 19 },
    { key: 'description', width: 46 },
    { key: 'source', width: 20 },
    { key: 'reference', width: 28 },
    { key: 'transactionGroup', width: 32 },
    { key: 'inflow', width: 13 },
    { key: 'outflow', width: 13 },
    { key: 'savingsBalance', width: 18 },
    { key: 'pocketBalance', width: 17 },
    { key: 'combinedBalance', width: 20 },
  ];

  const headerRow = sheet.addRow([
    'Date',
    'Status',
    'Account',
    'Category',
    'Description',
    'Source',
    'Reference',
    'Transaction Group',
    'Inflow',
    'Outflow',
    'Savings Balance',
    'Pocket Balance',
    'Combined Balance',
  ]);

  const headerBg: Record<number, string> = {
    11: '#c6edd9',
    12: '#bfdbfe',
    13: '#fde68a',
  };

  styleHeaderRow(headerRow, new Set([9, 10, 11, 12, 13]), headerBg);

  const ledgerRows = buildLedgerRows(payload).filter((row) =>
    isDateIncluded(row.date, options),
  );

  for (const row of ledgerRows) {
    const status = row.date <= payload.today ? 'Actual' : 'Projected';
    const inflow = row.delta > 0 ? row.delta : null;
    const outflow = row.delta < 0 ? Math.abs(row.delta) : null;
    const cats = categoryColors(row.category);

    const excelRow = sheet.addRow({
      date: row.date,
      status,
      account: row.account,
      category: row.category,
      description: row.description,
      source: row.source ?? null,
      reference: row.reference,
      transactionGroup: row.transactionGroup ?? null,
      inflow,
      outflow,
      savingsBalance: row.savingsBalance,
      pocketBalance: status === 'Actual' ? row.pocketBalance : null,
      combinedBalance: status === 'Actual' ? row.combinedBalance : null,
    });

    excelRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };

      if (col === 2) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: status === 'Actual' ? 'FFdcfce7' : 'FFfef3c7',
          },
        };
        cell.font = {
          color: {
            argb: status === 'Actual' ? 'FF166534' : 'FF92400e',
          },
          bold: true,
          size: 10,
        };
        cell.alignment = {
          vertical: 'top',
          horizontal: 'center',
          wrapText: false,
        };
      } else if (col === 3) {
        cell.fill = accountFill(row.account);
        cell.font = {
          color: { argb: accountFontColor(row.account) },
          bold: true,
          size: 10,
        };
        cell.alignment = {
          vertical: 'top',
          horizontal: 'center',
          wrapText: false,
        };
      } else if (col === 4) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: argb(cats.bg) },
        };
        cell.font = { color: { argb: argb(cats.fg) }, bold: true, size: 10 };
        cell.alignment = {
          vertical: 'top',
          horizontal: 'center',
          wrapText: false,
        };
      } else if (col === 9) {
        cell.numFmt = MONEY_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'top' };
        if (inflow !== null) {
          cell.font = { color: { argb: 'FF047857' } };
        }
      } else if (col === 10) {
        cell.numFmt = MONEY_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'top' };
        if (outflow !== null) {
          cell.font = { color: { argb: 'FFb45309' } };
        }
      } else if (col === 11) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFe8f7ef' },
        };
        cell.numFmt = MONEY_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'top' };
        if (row.savingsBalance < 0) {
          cell.font = { color: { argb: 'FFb45309' } };
        }
      } else if (col === 12) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFdbeafe' },
        };
        cell.numFmt = MONEY_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'top' };
        if (status === 'Actual' && row.pocketBalance < 0) {
          cell.font = { color: { argb: 'FFb45309' } };
        }
      } else if (col === 13) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFfef3c7' },
        };
        cell.numFmt = MONEY_FMT;
        cell.alignment = { horizontal: 'right', vertical: 'top' };
        if (status === 'Actual') {
          cell.font = {
            bold: true,
            color: {
              argb: row.combinedBalance < 0 ? 'FFb45309' : 'FF047857',
            },
          };
        }
      }
    });
  }

  sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  sheet.autoFilter = 'A1:M1';
  addGoalsSheet(workbook, payload, options);

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
