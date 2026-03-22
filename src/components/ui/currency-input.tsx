import * as React from 'react';

import { cn } from '@/lib/utils';

type CurrencyInputProps = Omit<React.ComponentProps<'input'>, 'className'> & {
  className?: string;
  inputClassName?: string;
  prefixClassName?: string;
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    { className, inputClassName, prefixClassName, disabled, ...props },
    ref,
  ) {
    return (
      <div
        data-slot="currency-input"
        className={cn(
          'flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-3.5 shadow-xs transition-[color,box-shadow,border-color]',
          'focus-within:border-ring hover:border-ring/50',
          'has-[input[aria-invalid]]:border-destructive has-[input[aria-invalid]]:ring-destructive/20',
          'md:h-9 md:min-h-9 md:px-3',
          'dark:bg-input/30 dark:has-[input[aria-invalid]]:ring-destructive/40',
          className,
        )}
      >
        <span
          className={cn(
            'shrink-0 text-base text-muted-foreground md:text-sm',
            prefixClassName,
          )}
          aria-hidden
        >
          $
        </span>
        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            'min-h-0 min-w-0 flex-1 border-0 bg-transparent py-2.5 font-mono text-base outline-none',
            'selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-invalid:border-0 aria-invalid:ring-0',
            'md:py-1 md:text-sm',
            inputClassName,
          )}
          {...props}
        />
      </div>
    );
  },
);

export { CurrencyInput };
