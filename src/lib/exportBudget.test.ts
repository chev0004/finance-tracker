import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import ExcelJS from 'exceljs';

import { buildBudgetXlsx, type ExportPayload } from '@/lib/exportBudget';

const payload: ExportPayload = {
  settings: {
    startingBalance: 1000,
    startDate: '2026-07-01',
    pocketPerPeriod: 100,
    pocketPerPeriodChanges: [],
    pocketFrequency: 'weekly',
    pocketFirstPayday: '2026-07-24',
    pocketIncomeSourceId: 'apple',
    goals: [],
    recurringExpenses: [],
    recurringExpenseSkips: [],
    incomeSources: [
      {
        id: 'apple',
        name: 'Apple, Inc.',
        amount: 540,
        payFrequency: 'weekly',
        firstPayday: '2026-07-24',
        rateChanges: [],
      },
    ],
    oneTimeIncome: [],
    paydayIncomeOverrides: [],
    pocketAmountOverrides: [],
  },
  expenses: [],
  spentPerPeriod: [],
  today: '2026-07-26',
  currentSavings: 1440,
  currentPocketBalance: 100,
  combinedBalance: 1540,
  monthlyIncome: 2340,
  monthlySavings: 1906.67,
  savingsTimeline: [
    {
      date: 'Jul 1',
      rawDate: '2026-07-01',
      balance: 1000,
      label: 'start',
      type: 'start',
      events: [],
    },
    {
      date: 'Jul 24',
      rawDate: '2026-07-24',
      balance: 1440,
      label: 'Apple, Inc. $440.00',
      type: 'payday',
      events: [
        {
          label: 'Apple, Inc. $440.00',
          delta: 440,
          type: 'payday',
          sourceId: 'apple',
        },
      ],
    },
    {
      date: 'Jul 31',
      rawDate: '2026-07-31',
      balance: 1880,
      label: 'Apple, Inc. $440.00',
      type: 'payday',
      events: [
        {
          label: 'Apple, Inc. $440.00',
          delta: 440,
          type: 'payday',
          sourceId: 'apple',
        },
      ],
    },
  ],
  pocketTimeline: [
    {
      date: 'Jul 24 - Jul 30',
      rawDate: '2026-07-24',
      weekStart: '2026-07-24',
      weekEnd: '2026-07-30',
      balance: 100,
      available: 100,
      spent: 0,
      overage: 0,
      type: 'surplus',
      idx: 0,
      expenseCount: 0,
      pocketAllocated: 100,
      scheduledPocket: 100,
      expenseItems: [],
    },
    {
      date: 'Jul 31 - Aug 6',
      rawDate: '2026-07-31',
      weekStart: '2026-07-31',
      weekEnd: '2026-08-06',
      balance: 200,
      available: 200,
      spent: 0,
      overage: 0,
      type: 'surplus',
      idx: 1,
      expenseCount: 0,
      pocketAllocated: 100,
      scheduledPocket: 100,
      expenseItems: [],
    },
  ],
  goalStats: [],
  eoyBalance: 1880,
  eoyCombined: 2080,
  validationErrors: [],
};

async function loadExport(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await buildBudgetXlsx(payload));
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  return workbook;
}

describe('budget XLSX export', () => {
  test('explains and groups paycheck splits', async () => {
    const workbook = await loadExport();
    const guide = workbook.getWorksheet('Guide');
    const ledger = workbook.getWorksheet('Budget Ledger');

    assert.ok(guide);
    assert.ok(ledger);
    assert.equal(workbook.worksheets[0]?.name, 'Guide');
    assert.equal(guide.getCell('B3').value, payload.today);
    assert.match(String(guide.getCell('B10').value), /unknown, not zero/);

    assert.equal(ledger.getCell('I1').value, 'Inflow');
    assert.equal(ledger.getCell('J1').value, 'Outflow');

    const splitRows =
      ledger
        .getRows(2, ledger.rowCount - 1)
        ?.filter(
          (row) =>
            row.getCell(1).value === '2026-07-24' &&
            row.getCell(4).value === 'Paycheck Split',
        ) ?? [];

    assert.equal(splitRows.length, 2);
    assert.deepEqual(
      splitRows.map((row) => row.getCell(5).value),
      [
        'Pocket share of Apple, Inc. paycheck',
        'Savings share of Apple, Inc. paycheck',
      ],
    );
    assert.deepEqual(
      new Set(splitRows.map((row) => row.getCell(6).value)),
      new Set(['Apple, Inc.']),
    );
    assert.equal(new Set(splitRows.map((row) => row.getCell(8).value)).size, 1);
    assert.deepEqual(
      splitRows.map((row) => row.getCell(9).value),
      [100, 440],
    );
  });

  test('does not report unknown projected pocket balances', async () => {
    const workbook = await loadExport();
    const ledger = workbook.getWorksheet('Budget Ledger');
    assert.ok(ledger);
    const projectedRows =
      ledger
        .getRows(2, ledger.rowCount - 1)
        ?.filter((row) => row.getCell(1).value === '2026-07-31') ?? [];

    assert.equal(projectedRows.length, 2);
    for (const row of projectedRows) {
      assert.equal(row.getCell(2).value, 'Projected');
      assert.equal(row.getCell(12).value, null);
      assert.equal(row.getCell(13).value, null);
    }
    assert.equal(projectedRows.at(-1)?.getCell(11).value, 1880);
  });
});
