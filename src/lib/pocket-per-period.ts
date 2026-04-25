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

export function getPocketAmountForPayday(
  settings: Pick<
    BudgetSettings,
    'pocketPerPeriod' | 'pocketPerPeriodChanges' | 'pocketAmountOverrides'
  >,
  payday: string,
): number {
  const override = settings.pocketAmountOverrides?.find(
    (o) => o.date === payday,
  );
  if (override) return override.amount;
  return getPocketPerPeriodForDate(settings, payday);
}
