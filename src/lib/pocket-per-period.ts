import type { BudgetSettings } from '@/types';

export function getPocketPerPeriodForDate(
  settings: Pick<BudgetSettings, 'pocketPerPeriod' | 'pocketPerPeriodChanges'>,
  date: string,
): number {
  const sorted = [...settings.pocketPerPeriodChanges].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate),
  );
  let amount = settings.pocketPerPeriod;
  for (const change of sorted) {
    if (change.effectiveDate <= date) amount = change.amount;
    else break;
  }
  return amount;
}
