import type { IncomeSource } from '@/types';

export const BASE_HOURLY_RATE = 18;
export const WEEKLY_HOURS = 40;

const MARGINAL_TAKE_HOME_RATE = 1 - (122.57 - 87.61) / (720 - 576);

export function getHoursPerPayPeriod(source: IncomeSource): number {
  const weeks = {
    weekly: 1,
    biweekly: 2,
    monthly: 52 / 12,
    custom: (source.payInterval ?? 7) / 7,
  }[source.payFrequency];
  return WEEKLY_HOURS * weeks;
}

export function getHourlyNetAmount(
  source: IncomeSource,
  hourlyRate: number,
): number {
  const netDifference =
    (hourlyRate - BASE_HOURLY_RATE) *
    getHoursPerPayPeriod(source) *
    MARGINAL_TAKE_HOME_RATE;
  return Math.max(0, +(source.amount + netDifference).toFixed(2));
}
