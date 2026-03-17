import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: string | number;
  prefix?: string;
  variant?: 'default' | 'success' | 'danger' | 'warning';
  isCurrency?: boolean;
}

export function StatsCard({
  label,
  value,
  prefix = '',
  variant = 'default',
  isCurrency = true,
}: StatsCardProps) {
  const displayValue = isCurrency
    ? `$${Number(value).toLocaleString()}`
    : value;

  const colorClass = {
    default: 'text-foreground',
    success: 'text-emerald-500',
    danger: 'text-red-500',
    warning: 'text-amber-500',
  }[variant];

  return (
    <Card className="border-border/50 bg-card/50 hover:border-border hover:shadow-md">
      <CardContent className="p-4">
        <div className="mb-1 text-muted-foreground text-xs uppercase tracking-wider">
          {label}
        </div>
        <div className={cn('font-bold font-mono text-xl', colorClass)}>
          {prefix}
          {displayValue}
        </div>
      </CardContent>
    </Card>
  );
}
