'use client';

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import * as React from 'react';
import {
  type DayButton,
  DayPicker,
  type DayPickerProps,
  type DropdownProps,
  dateMatchModifiers,
  getDefaultClassNames,
  useDayPicker,
} from 'react-day-picker';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        'group/calendar bg-background p-3 [--cell-size:--spacing(8)] max-sm:p-2 max-sm:[--cell-size:2.75rem]',
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString('default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn(
          'relative flex flex-col gap-4 md:flex-row',
          defaultClassNames.months,
        ),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) select-none p-0 aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) select-none p-0 aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          'relative rounded-md border border-input shadow-xs has-focus:border-ring has-focus:ring-[3px] has-focus:ring-ring/50',
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          'absolute inset-0 bg-popover opacity-0',
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          'select-none font-medium',
          captionLayout === 'label'
            ? 'text-sm'
            : 'flex h-8 items-center gap-1 rounded-md pr-1 pl-2 text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground',
          defaultClassNames.caption_label,
        ),
        table: 'w-full border-collapse',
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'flex-1 select-none rounded-md text-[0.8rem] font-normal text-muted-foreground',
          defaultClassNames.weekday,
        ),
        week: cn('mt-2 flex w-full', defaultClassNames.week),
        week_number_header: cn(
          'w-(--cell-size) select-none',
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          'select-none text-[0.8rem] text-muted-foreground',
          defaultClassNames.week_number,
        ),
        day: cn(
          'group/day relative aspect-square h-full w-full select-none p-0 text-center [&:last-child[data-selected=true]_button]:rounded-r-md',
          props.showWeekNumber
            ? '[&:nth-child(2)[data-selected=true]_button]:rounded-l-md'
            : '[&:first-child[data-selected=true]_button]:rounded-l-md',
          defaultClassNames.day,
        ),
        range_start: cn(
          'rounded-l-md bg-zinc-50 dark:bg-zinc-200',
          defaultClassNames.range_start,
        ),
        range_middle: cn('rounded-none', defaultClassNames.range_middle),
        range_end: cn(
          'rounded-r-md bg-zinc-50 dark:bg-zinc-200',
          defaultClassNames.range_end,
        ),
        today: '',
        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside,
        ),
        disabled: cn(
          'text-muted-foreground opacity-50',
          defaultClassNames.disabled,
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          );
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === 'left') {
            return (
              <ChevronLeftIcon className={cn('size-4', className)} {...props} />
            );
          }

          if (orientation === 'right') {
            return (
              <ChevronRightIcon
                className={cn('size-4', className)}
                {...props}
              />
            );
          }

          return (
            <ChevronDownIcon className={cn('size-4', className)} {...props} />
          );
        },
        Dropdown: CalendarDropdown,
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
      footer={<CalendarTodayButton />}
    />
  );
}

function CalendarTodayButton() {
  const { dayPickerProps, goToMonth, select, isSelected } =
    useDayPicker<DayPickerProps>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const disabled =
    dateMatchModifiers(today, dayPickerProps.disabled ?? false) ||
    dateMatchModifiers(today, dayPickerProps.hidden ?? false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mt-2 w-full"
      disabled={disabled}
      onClick={(event) => {
        goToMonth(today);
        const modifiers = { today: true, selected: !!isSelected?.(today) };
        if (dayPickerProps.mode === 'single' && dayPickerProps.onSelect) {
          dayPickerProps.onSelect(today, today, modifiers, event);
        } else {
          select?.(today, modifiers, event);
        }
      }}
    >
      Today
    </Button>
  );
}

function CalendarDropdown({
  value,
  onChange,
  options,
  disabled,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selected = options?.find((option) => option.value === value);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const handleSelect = (nextValue: string | number | undefined) => {
    if (nextValue == null) return;
    const event = {
      target: { value: String(nextValue) },
    } as React.ChangeEvent<HTMLSelectElement>;
    onChange?.(event);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-8 min-w-17 cursor-pointer items-center justify-between gap-1 rounded-md border border-input bg-background py-1 pr-6 pl-2 text-foreground text-sm outline-none transition-[color,box-shadow,background-color]',
          'hover:border-ring/50 hover:bg-accent/30 active:scale-[0.99] active:bg-accent/50',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          open && 'border-ring bg-accent/40',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <span>{selected?.label ?? ''}</span>
      </button>
      <ChevronDownIcon
        className={cn(
          'pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-muted-foreground transition-transform',
          open && 'rotate-180',
        )}
      />
      {open && (
        <div className="glass-card absolute top-full left-0 z-50 mt-1 min-w-full rounded-md border border-border">
          <div
            className="max-h-56 overflow-y-auto overscroll-contain p-1"
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            {options?.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  'w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-[background-color,color,box-shadow,transform]',
                  'hover:bg-accent/60 active:scale-[0.99] active:bg-accent/80',
                  'focus-visible:ring-2 focus-visible:ring-ring/50',
                  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
                  option.value === value
                    ? 'bg-accent text-accent-foreground'
                    : 'text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-start=true]:rounded-l-md data-[range-end=true]:bg-zinc-50 data-[range-middle=true]:bg-accent data-[range-start=true]:bg-zinc-50 data-[selected-single=true]:bg-muted data-[range-end=true]:text-black data-[range-middle=true]:text-accent-foreground data-[range-start=true]:text-black data-[selected-single=true]:text-foreground data-[range-end=true]:hover:text-black data-[range-middle=true]:hover:text-accent-foreground data-[range-start=true]:hover:text-black data-[selected-single=true]:hover:text-foreground group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border group-data-[focused=true]/day:border-border data-[range-end=true]:dark:bg-zinc-200 data-[range-start=true]:dark:bg-zinc-200 dark:hover:text-accent-foreground [&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
