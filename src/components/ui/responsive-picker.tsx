'use client';

import {
  cloneElement,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useNarrowViewport } from '@/hooks/useNarrowViewport';
import { cn } from '@/lib/utils';

type TriggerProps = {
  onClick?: (e: React.MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
};

export function ResponsivePicker({
  open,
  onOpenChange,
  trigger,
  sheetTitle,
  popoverContentClassName,
  align = 'start',
  sheetContentClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement<TriggerProps>;
  sheetTitle: string;
  popoverContentClassName?: string;
  align?: 'center' | 'end' | 'start';
  sheetContentClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const narrow = useNarrowViewport();
  const close = () => onOpenChange(false);

  if (narrow) {
    const tprops = isValidElement(trigger)
      ? (trigger.props as TriggerProps)
      : null;
    const triggerWithOpen =
      isValidElement(trigger) && tprops
        ? cloneElement(trigger, {
            type: tprops.type ?? 'button',
            onClick: (e: MouseEvent) => {
              tprops.onClick?.(e);
              onOpenChange(true);
            },
          })
        : trigger;

    return (
      <>
        {triggerWithOpen}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            className={cn(
              'gap-0 overflow-hidden p-0 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]',
              sheetContentClassName,
            )}
          >
            <SheetHeader className="shrink-0 space-y-0 px-4 pr-14 pb-3 text-left">
              <SheetTitle className="text-base">{sheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 [-webkit-overflow-scrolling:touch]">
              {children(close)}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className={cn('w-auto p-0', popoverContentClassName)}
        align={align}
      >
        {children(close)}
      </PopoverContent>
    </Popover>
  );
}
