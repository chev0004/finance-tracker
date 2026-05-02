'use client';

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileBalancesOverviewProps = {
  currentSavings: number;
  currentPocketBalance: number;
  combinedBalance: number;
  monthlySavings: number;
  monthlyNetSavings: number;
  monthlyIncome: number;
  eoyCombined: number;
  chartYearClamped: number;
  pocketPerPeriod: number;
  pocketFreqLabel: string;
  formatMoney: (n: number) => string;
  todayLabel: string;
};

export function MobileBalancesOverview({
  currentSavings,
  currentPocketBalance,
  combinedBalance,
  monthlySavings,
  monthlyNetSavings,
  monthlyIncome,
  eoyCombined,
  chartYearClamped,
  pocketPerPeriod,
  pocketFreqLabel,
  formatMoney,
  todayLabel,
}: MobileBalancesOverviewProps) {
  const eoyVariant =
    eoyCombined < 0 ? 'danger' : eoyCombined < 500 ? 'warning' : 'success';
  const eoyColor = {
    danger: 'text-red-500',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
  }[eoyVariant];

  const grossPrefix = monthlySavings >= 0 ? '+' : '';
  const netPrefix = monthlyNetSavings >= 0 ? '+' : '';

  const accountRows = [
    { label: 'Savings', value: formatMoney(currentSavings) },
    { label: 'Pocket', value: formatMoney(currentPocketBalance) },
  ];

  const statTiles: {
    title: string;
    value?: string;
    lines?: { micro: string; value: string; valueClassName?: string }[];
    subtitle: string;
    valueClassName?: string;
  }[] = [
    {
      title: 'Savings / mo',
      lines: [
        {
          micro: 'Gross',
          value: `${grossPrefix}${formatMoney(monthlySavings)}`,
          valueClassName:
            monthlySavings >= 0 ? 'text-emerald-400' : 'text-red-400',
        },
        {
          micro: 'Net',
          value: `${netPrefix}${formatMoney(monthlyNetSavings)}`,
          valueClassName:
            monthlyNetSavings >= 0 ? 'text-emerald-400' : 'text-red-400',
        },
      ],
      subtitle: 'Gross: income less pocket. Net: avg after deductions',
    },
    {
      title: 'Income / mo',
      value: formatMoney(monthlyIncome),
      subtitle: 'Planned recurring',
    },
    {
      title: `End of ${chartYearClamped}`,
      value: formatMoney(eoyCombined),
      subtitle: 'Projected combined',
      valueClassName: eoyColor,
    },
    {
      title: 'Pocket / period',
      value: `$${pocketPerPeriod.toLocaleString()}`,
      subtitle: pocketFreqLabel,
    },
  ];

  return (
    <section className="space-y-5 sm:hidden">
      <div>
        <h2 className="font-semibold text-2xl text-foreground tracking-tight">
          Balances
        </h2>
        <p className="mt-1 font-mono text-muted-foreground text-xs">
          {todayLabel}
        </p>
      </div>

      <div className="glass-card">
        {accountRows.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              'flex items-center justify-between gap-3 px-4 py-3.5',
              i > 0 && 'border-border/40 border-t',
            )}
          >
            <span className="text-foreground text-sm">{row.label}</span>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono font-semibold text-base text-foreground">
                {row.value}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground/70"
                aria-hidden
              />
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card border-emerald-500/25 p-5">
        <p className="text-muted-foreground text-sm">Combined</p>
        <p className="mt-1 font-bold font-mono text-3xl text-foreground tracking-tight">
          {formatMoney(combinedBalance)}
        </p>
        <p className="mt-1 text-muted-foreground/80 text-xs">
          As of {todayLabel}
        </p>
      </div>

      <h2 className="pt-1 font-semibold text-foreground text-xl tracking-tight">
        Overview
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {statTiles.map((tile) => (
          <div key={tile.title} className="glass-card min-w-0 p-4">
            <p className="text-muted-foreground text-xs">{tile.title}</p>
            {tile.lines ? (
              <div className="mt-2 space-y-2">
                {tile.lines.map((line) => (
                  <div key={line.micro}>
                    <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wider">
                      {line.micro}
                    </p>
                    <p
                      className={cn(
                        'break-words font-bold font-mono text-base text-foreground tracking-tight',
                        line.valueClassName,
                      )}
                    >
                      {line.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p
                className={cn(
                  'mt-2 break-words font-bold font-mono text-foreground text-lg tracking-tight',
                  tile.valueClassName,
                )}
              >
                {tile.value}
              </p>
            )}
            <p className="mt-1 line-clamp-3 text-[11px] text-muted-foreground/80 leading-snug">
              {tile.subtitle}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
