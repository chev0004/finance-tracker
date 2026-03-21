'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useNarrowViewport } from '@/hooks/useNarrowViewport';
import { cn } from '@/lib/utils';

export type ResponsiveSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function ResponsiveSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  sheetTitle,
  triggerClassName,
}: {
  value: string | undefined;
  onValueChange: (v: string) => void;
  options: ResponsiveSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  sheetTitle: string;
  triggerClassName?: string;
}) {
  const narrow = useNarrowViewport();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? 'Select';

  if (narrow) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'flex h-11 min-h-11 w-full justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left font-normal text-base shadow-xs hover:border-ring/50 dark:bg-input/30',
            !selected && 'text-muted-foreground',
            triggerClassName,
          )}
          onClick={() => !disabled && setOpen(true)}
        >
          <span className="min-w-0 truncate">{displayLabel}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="gap-0 overflow-hidden p-0 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="shrink-0 px-4 pr-14 pb-3 text-left">
              <SheetTitle className="text-base">{sheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="max-h-[min(52dvh,24rem)] overflow-y-auto px-2 [-webkit-overflow-scrolling:touch]">
              <div className="flex flex-col gap-1 pb-2">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    className={cn(
                      'flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base transition-colors',
                      'hover:bg-accent/60 active:bg-accent',
                      value === opt.value && 'bg-accent/80',
                      opt.disabled && 'pointer-events-none opacity-50',
                    )}
                    onClick={() => {
                      if (opt.disabled) return;
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1">{opt.label}</span>
                    {value === opt.value && (
                      <Check className="size-5 shrink-0 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Select
      value={value ?? ''}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          'h-11 min-h-11 w-full text-base sm:h-9 sm:min-h-9 sm:text-sm',
          triggerClassName,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
