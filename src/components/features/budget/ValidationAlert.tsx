import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ValidationAlertProps {
  errors: Array<{ field: string; message: string }>;
  isCritical: boolean;
}

export function ValidationAlert({ errors, isCritical }: ValidationAlertProps) {
  if (errors.length === 0) return null;

  const Icon = isCritical ? AlertCircle : AlertTriangle;
  const variant = isCritical ? 'destructive' : 'default';

  return (
    <Alert
      variant={variant}
      className={
        isCritical
          ? 'border-red-500/40 bg-red-500/10 text-red-500'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-500'
      }
    >
      <Icon className="h-4 w-4" />
      <AlertDescription>
        {errors.map((error, index) => (
          <div key={index}>{error.message}</div>
        ))}
      </AlertDescription>
    </Alert>
  );
}
