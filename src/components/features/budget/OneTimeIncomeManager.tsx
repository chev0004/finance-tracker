'use client';

import { format, isValid, parseISO } from 'date-fns';
import {
  Archive,
  ArrowDownUp,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsivePicker } from '@/components/ui/responsive-picker';
import {
  cn,
  normalizeNumInputBlur,
  normalizeNumInputLeading,
} from '@/lib/utils';
import type { OneTimeIncome } from '@/types';

interface OneTimeIncomeManagerProps {
  items: OneTimeIncome[];
  onAdd: (item: Omit<OneTimeIncome, 'id'>) => void;
  onUpdate: (item: OneTimeIncome) => void;
  onRemove: (id: string) => void;
  onToggleHidden?: (id: string) => void;
  startOpen?: boolean;
  onCancel?: () => void;
}

export function OneTimeIncomeManager({
  items,
  onAdd,
  onUpdate,
  onRemove,
  onToggleHidden,
  startOpen = false,
  onCancel,
}: OneTimeIncomeManagerProps) {
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(
    startOpen ? 'add' : null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState(() =>
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [upcomingSort, setUpcomingSort] = useState<'soonest' | 'latest'>(
    'soonest',
  );
  const [openUpcomingMonths, setOpenUpcomingMonths] = useState<Set<string>>(
    () => new Set([format(new Date(), 'yyyy-MM')]),
  );
  const [pastOpen, setPastOpen] = useState(false);
  const [pastSort, setPastSort] = useState<'newest' | 'oldest'>('newest');
  const [openPastMonths, setOpenPastMonths] = useState<Set<string>>(
    () => new Set(),
  );

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const compareUpcomingItems = (a: OneTimeIncome, b: OneTimeIncome) => {
    const dateCompare =
      upcomingSort === 'soonest'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);

    return dateCompare || a.label.localeCompare(b.label);
  };
  const upcomingItems = sorted
    .filter((item) => item.date >= todayStr)
    .sort(compareUpcomingItems);
  const visibleUpcomingItems = upcomingItems.filter((item) => !item.hidden);
  const upcomingTotal = visibleUpcomingItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const upcomingGroups = Array.from(
    upcomingItems
      .reduce((groups, item) => {
        const monthKey = item.date.slice(0, 7);
        const groupItems = groups.get(monthKey) ?? [];
        groupItems.push(item);
        groups.set(monthKey, groupItems);
        return groups;
      }, new Map<string, OneTimeIncome[]>())
      .entries(),
  )
    .map(([monthKey, groupItems]) => {
      const visibleGroupItems = groupItems.filter((item) => !item.hidden);

      return {
        key: monthKey,
        label: format(parseISO(`${monthKey}-01`), 'MMMM yyyy'),
        items: groupItems.sort(compareUpcomingItems),
        total: visibleGroupItems.reduce((sum, item) => sum + item.amount, 0),
        visibleCount: visibleGroupItems.length,
      };
    })
    .sort((a, b) =>
      upcomingSort === 'soonest'
        ? a.key.localeCompare(b.key)
        : b.key.localeCompare(a.key),
    );
  const openUpcomingGroupCount = upcomingGroups.filter((group) =>
    openUpcomingMonths.has(group.key),
  ).length;
  const allUpcomingGroupsOpen =
    upcomingGroups.length > 0 &&
    openUpcomingGroupCount === upcomingGroups.length;
  const comparePastItems = (a: OneTimeIncome, b: OneTimeIncome) => {
    const dateCompare =
      pastSort === 'newest'
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date);

    return dateCompare || a.label.localeCompare(b.label);
  };
  const pastItems = sorted
    .filter((item) => item.date < todayStr)
    .sort(comparePastItems);
  const visiblePastItems = pastItems.filter((item) => !item.hidden);
  const pastTotal = visiblePastItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const pastGroups = Array.from(
    pastItems
      .reduce((groups, item) => {
        const monthKey = item.date.slice(0, 7);
        const groupItems = groups.get(monthKey) ?? [];
        groupItems.push(item);
        groups.set(monthKey, groupItems);
        return groups;
      }, new Map<string, OneTimeIncome[]>())
      .entries(),
  )
    .map(([monthKey, groupItems]) => {
      const visibleGroupItems = groupItems.filter((item) => !item.hidden);

      return {
        key: monthKey,
        label: format(parseISO(`${monthKey}-01`), 'MMMM yyyy'),
        items: groupItems.sort(comparePastItems),
        total: visibleGroupItems.reduce((sum, item) => sum + item.amount, 0),
        visibleCount: visibleGroupItems.length,
      };
    })
    .sort((a, b) =>
      pastSort === 'newest'
        ? b.key.localeCompare(a.key)
        : a.key.localeCompare(b.key),
    );
  const openPastGroupCount = pastGroups.filter((group) =>
    openPastMonths.has(group.key),
  ).length;
  const allPastGroupsOpen =
    pastGroups.length > 0 && openPastGroupCount === pastGroups.length;
  const openUpcomingMonthForDate = (date: string) => {
    setUpcomingOpen(true);
    const monthKey = date.slice(0, 7);
    setOpenUpcomingMonths((current) => {
      if (current.has(monthKey)) return current;
      const next = new Set(current);
      next.add(monthKey);
      return next;
    });
  };

  const openPastMonthForDate = (date: string) => {
    setPastOpen(true);
    const monthKey = date.slice(0, 7);
    setOpenPastMonths((current) => {
      if (current.has(monthKey)) return current;
      const next = new Set(current);
      next.add(monthKey);
      return next;
    });
  };

  const toggleUpcomingMonth = (monthKey: string) => {
    setOpenUpcomingMonths((current) => {
      const next = new Set(current);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  const togglePastMonth = (monthKey: string) => {
    setOpenPastMonths((current) => {
      const next = new Set(current);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  const toggleAllUpcomingMonths = () => {
    setOpenUpcomingMonths(
      allUpcomingGroupsOpen
        ? new Set()
        : new Set(upcomingGroups.map((g) => g.key)),
    );
  };

  const toggleAllPastMonths = () => {
    setOpenPastMonths(
      allPastGroupsOpen ? new Set() : new Set(pastGroups.map((g) => g.key)),
    );
  };

  const expandAllOneTimeIncome = () => {
    setUpcomingOpen(upcomingItems.length > 0);
    setPastOpen(pastItems.length > 0);
    setOpenUpcomingMonths(new Set(upcomingGroups.map((g) => g.key)));
    setOpenPastMonths(new Set(pastGroups.map((g) => g.key)));
  };

  const collapseAllOneTimeIncome = () => {
    setUpcomingOpen(false);
    setPastOpen(false);
    setOpenUpcomingMonths(new Set());
    setOpenPastMonths(new Set());
  };

  const resetForm = () => {
    setDateStr(format(new Date(), 'yyyy-MM-dd'));
    setLabel('');
    setAmount('');
    setFormMode(null);
    setEditingId(null);
  };

  const startAdd = () => {
    resetForm();
    setFormMode('add');
  };

  const startEdit = (item: OneTimeIncome) => {
    setEditingId(item.id);
    setFormMode('edit');
    setDateStr(item.date);
    setLabel(item.label);
    setAmount(String(item.amount));
  };

  const handleSave = () => {
    const numAmount = Number.parseFloat(normalizeNumInputBlur(amount)) || 0;
    if (!dateStr || !label.trim() || numAmount <= 0) return;

    if (formMode === 'edit' && editingId) {
      const currentItem = items.find((item) => item.id === editingId);
      onUpdate({
        id: editingId,
        date: dateStr,
        label: label.trim(),
        amount: numAmount,
        hidden: currentItem?.hidden,
      });
    } else {
      onAdd({ date: dateStr, label: label.trim(), amount: numAmount });
    }
    resetForm();
  };

  const dateObj = parseISO(dateStr);
  const dateValid = isValid(dateObj);

  const renderIncomeRow = (item: OneTimeIncome, compact = false) =>
    formMode === 'edit' && editingId === item.id ? (
      <div key={item.id}>{formUI}</div>
    ) : (
      <div
        key={item.id}
        className={cn(
          'group flex min-w-0 items-center justify-between rounded-lg transition-colors hover:bg-muted/50',
          compact ? 'px-2 py-1' : 'px-2 py-1.5',
          item.hidden && 'opacity-50',
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="text-muted-foreground text-xs">
            {format(parseISO(item.date), compact ? 'MMM d' : 'MMM d, yyyy')}
          </span>
          <span
            className={cn(
              'max-w-full truncate',
              compact && 'text-xs',
              item.hidden && 'line-through',
            )}
          >
            {item.label}
          </span>
          <span className="font-mono text-green-400 text-xs">
            +${item.amount.toLocaleString()}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          {onToggleHidden && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onToggleHidden(item.id)}
              title={
                item.hidden ? 'Show in calculations' : 'Hide from calculations'
              }
            >
              {item.hidden ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (item.date < todayStr) {
                openPastMonthForDate(item.date);
              } else {
                openUpcomingMonthForDate(item.date);
              }
              startEdit(item);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-red-500"
            onClick={() => onRemove(item.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );

  const formUI = (
    <div className="w-full min-w-0 space-y-3 rounded-lg border border-border/50 bg-muted/30 p-3">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Date
          </Label>
          <ResponsivePicker
            open={dateOpen}
            onOpenChange={setDateOpen}
            sheetTitle="One-time income date"
            popoverContentClassName="w-auto p-0"
            trigger={
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-11 min-h-11 w-full justify-start text-left font-normal text-base sm:h-9 sm:min-h-9 sm:text-sm',
                  !dateValid && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                {dateValid ? format(dateObj, 'MMM d, yyyy') : 'Select date'}
              </Button>
            }
          >
            {(close) => (
              <Calendar
                mode="single"
                selected={dateValid ? dateObj : undefined}
                onSelect={(d) => {
                  if (d && isValid(d)) {
                    setDateStr(format(d, 'yyyy-MM-dd'));
                    close();
                  }
                }}
                defaultMonth={dateValid ? dateObj : new Date()}
                className="mx-auto w-full max-w-[100vw] rounded-lg"
              />
            )}
          </ResponsivePicker>
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Label
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Gift from family"
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Amount
          </Label>
          <CurrencyInput
            type="number"
            min={0}
            placeholder="0"
            value={amount === '' ? '0' : amount}
            onChange={(e) =>
              setAmount(normalizeNumInputLeading(e.target.value))
            }
            onBlur={() => setAmount(normalizeNumInputBlur(amount))}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} variant="muted">
          {formMode === 'edit' ? 'Save' : 'Add'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => (onCancel ? onCancel() : resetForm())}
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={expandAllOneTimeIncome}
            title="Expand all"
            aria-label="Expand all one-time income groups"
          >
            <ChevronsDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={collapseAllOneTimeIncome}
            title="Collapse all"
            aria-label="Collapse all one-time income groups"
          >
            <ChevronsUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {upcomingItems.length > 0 && (
        <div className="rounded-lg border border-border/40 bg-muted/20 transition-colors hover:border-border/70">
          <button
            type="button"
            className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/40 hover:text-foreground"
            onClick={() => setUpcomingOpen((open) => !open)}
            aria-expanded={upcomingOpen}
          >
            {upcomingOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-sm">
              Upcoming income
            </span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {visibleUpcomingItems.length}/{upcomingItems.length}
            </span>
            {visibleUpcomingItems.length > 0 && (
              <span className="hidden shrink-0 font-mono text-green-400 text-xs sm:inline">
                +${upcomingTotal.toLocaleString()}
              </span>
            )}
          </button>

          {upcomingOpen && (
            <div className="space-y-2 border-border/40 border-t p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  {upcomingGroups.length}{' '}
                  {upcomingGroups.length === 1 ? 'month' : 'months'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setUpcomingSort((sort) =>
                        sort === 'soonest' ? 'latest' : 'soonest',
                      )
                    }
                    title="Toggle upcoming income sort order"
                  >
                    <ArrowDownUp className="h-3 w-3" />
                    {upcomingSort === 'soonest' ? 'Soonest' : 'Latest'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={toggleAllUpcomingMonths}
                  >
                    {allUpcomingGroupsOpen ? 'Close all' : 'Open all'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                {upcomingGroups.map((group) => {
                  const groupOpen = openUpcomingMonths.has(group.key);

                  return (
                    <div
                      key={group.key}
                      className="overflow-hidden rounded-md border border-border/30 bg-background/30 transition-colors hover:border-border/60"
                    >
                      <button
                        type="button"
                        className="flex w-full min-w-0 cursor-pointer items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-muted/40 hover:text-foreground"
                        onClick={() => toggleUpcomingMonth(group.key)}
                        aria-expanded={groupOpen}
                      >
                        {groupOpen ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium text-sm">
                          {group.label}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {group.visibleCount}/{group.items.length}
                        </span>
                        {group.visibleCount > 0 && (
                          <span className="hidden shrink-0 font-mono text-green-400 text-xs sm:inline">
                            +${group.total.toLocaleString()}
                          </span>
                        )}
                      </button>

                      {groupOpen && (
                        <div className="space-y-0.5 border-border/30 border-t px-1 py-1">
                          {group.items.map((item) =>
                            renderIncomeRow(item, true),
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {pastItems.length > 0 && (
        <div className="rounded-lg border border-border/40 bg-muted/20 transition-colors hover:border-border/70">
          <button
            type="button"
            className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/40 hover:text-foreground"
            onClick={() => setPastOpen((open) => !open)}
            aria-expanded={pastOpen}
          >
            {pastOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-sm">
              Past income
            </span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {visiblePastItems.length}/{pastItems.length}
            </span>
            {visiblePastItems.length > 0 && (
              <span className="hidden shrink-0 font-mono text-green-400 text-xs sm:inline">
                +${pastTotal.toLocaleString()}
              </span>
            )}
          </button>

          {pastOpen && (
            <div className="space-y-2 border-border/40 border-t p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  {pastGroups.length}{' '}
                  {pastGroups.length === 1 ? 'month' : 'months'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setPastSort((sort) =>
                        sort === 'newest' ? 'oldest' : 'newest',
                      )
                    }
                    title="Toggle past income sort order"
                  >
                    <ArrowDownUp className="h-3 w-3" />
                    {pastSort === 'newest' ? 'Newest' : 'Oldest'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={toggleAllPastMonths}
                  >
                    {allPastGroupsOpen ? 'Close all' : 'Open all'}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                {pastGroups.map((group) => {
                  const groupOpen = openPastMonths.has(group.key);

                  return (
                    <div
                      key={group.key}
                      className="overflow-hidden rounded-md border border-border/30 bg-background/30 transition-colors hover:border-border/60"
                    >
                      <button
                        type="button"
                        className="flex w-full min-w-0 cursor-pointer items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-muted/40 hover:text-foreground"
                        onClick={() => togglePastMonth(group.key)}
                        aria-expanded={groupOpen}
                      >
                        {groupOpen ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium text-sm">
                          {group.label}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {group.visibleCount}/{group.items.length}
                        </span>
                        {group.visibleCount > 0 && (
                          <span className="hidden shrink-0 font-mono text-green-400 text-xs sm:inline">
                            +${group.total.toLocaleString()}
                          </span>
                        )}
                      </button>

                      {groupOpen && (
                        <div className="space-y-0.5 border-border/30 border-t px-1 py-1">
                          {group.items.map((item) =>
                            renderIncomeRow(item, true),
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {formMode === 'add' ? (
        formUI
      ) : formMode !== 'edit' ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-xs hover:text-foreground"
          onClick={startAdd}
        >
          <Plus className="mr-1 h-3 w-3" /> Add one-time income
        </Button>
      ) : null}
    </div>
  );
}
