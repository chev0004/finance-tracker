import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: string | number;
  prefix?: string;
  variant?: 'default' | 'success' | 'danger' | 'warning';
  isCurrency?: boolean;
  secondaryLabel?: string;
  secondaryValue?: string | number;
  secondaryPrefix?: string;
  secondaryVariant?: 'default' | 'success' | 'danger' | 'warning';
}

function formatCurrencyValue(value: string | number): string {
  const num = Number(value);
  return num < 0
    ? `-$${Math.abs(num).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : `$${num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
}

export function StatsCard({
  label,
  value,
  prefix = '',
  variant = 'default',
  isCurrency = true,
  secondaryLabel,
  secondaryValue,
  secondaryPrefix = '',
  secondaryVariant = 'default',
}: StatsCardProps) {
  const displayValue = isCurrency ? formatCurrencyValue(value) : value;

  const colorClass = {
    default: 'text-foreground',
    success: 'text-emerald-500',
    danger: 'text-red-500',
    warning: 'text-amber-500',
  }[variant];

  const secondaryDisplay =
    secondaryValue !== undefined
      ? isCurrency
        ? formatCurrencyValue(secondaryValue)
        : secondaryValue
      : null;
  const secondaryColorClass =
    secondaryDisplay !== null
      ? {
          default: 'text-foreground',
          success: 'text-emerald-500',
          danger: 'text-red-500',
          warning: 'text-amber-500',
        }[secondaryVariant]
      : '';

  return (
    <Card className="border-border/50 bg-card/50 hover:border-border hover:shadow-md">
      <CardContent className="p-4">
        <div className="mb-1 text-muted-foreground text-xs uppercase tracking-wider">
          {label}
        </div>
        {secondaryDisplay !== null && secondaryLabel ? (
          <div className="space-y-2">
            <div>
              <div className="mb-0.5 text-[10px] text-muted-foreground/80 uppercase tracking-wider">
                Gross
              </div>
              <div className={cn('font-bold font-mono text-lg', colorClass)}>
                {prefix}
                {displayValue}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[10px] text-muted-foreground/80 uppercase tracking-wider">
                {secondaryLabel}
              </div>
              <div
                className={cn(
                  'font-bold font-mono text-lg',
                  secondaryColorClass,
                )}
              >
                {secondaryPrefix}
                {secondaryDisplay}
              </div>
            </div>
          </div>
        ) : (
          <div className={cn('font-bold font-mono text-xl', colorClass)}>
            {prefix}
            {displayValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
