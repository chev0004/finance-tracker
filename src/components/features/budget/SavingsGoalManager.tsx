'use client';

import { format, parseISO } from 'date-fns';
import {
  Archive,
  ArrowDownUp,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { GoalStat, RecurringExpense, SavingsGoal } from '@/types';
import { GoalCard } from './GoalCard';
import { GoalForm } from './GoalForm';

type GoalSortMode = 'deadline' | 'name' | 'cost';
type GoalSectionKey = 'active' | 'upcoming' | 'finished';

interface GoalGroup {
  key: string;
  label: string;
  goals: SavingsGoal[];
  total: number;
  visibleCount: number;
  order: number;
}

interface GoalSectionView {
  key: GoalSectionKey;
  label: string;
  goals: SavingsGoal[];
  groups: GoalGroup[];
  open: boolean;
  onToggle: () => void;
}

interface SavingsGoalManagerProps {
  goals: SavingsGoal[];
  goalStats: GoalStat[];
  recurringExpenses: RecurringExpense[];
  editingGoalId: string | null;
  onEditingGoalChange: (id: string | null) => void;
  onUpdate: (goal: SavingsGoal) => void;
  onRemove: (id: string) => void;
  onToggleHidden: (id: string) => void;
}

function todayValue(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function monthLabel(value: string): string {
  return format(parseISO(`${value}-01`), 'MMMM yyyy');
}

function monthOrder(month: string): number {
  return Number.parseInt(month.replace('-', ''), 10);
}

function totalGoalCost(goal: SavingsGoal): number {
  return goal.lineItems.reduce((sum, item) => sum + item.amount, 0);
}

function visibleGoalTotal(goals: SavingsGoal[]): number {
  return goals
    .filter((goal) => !goal.hidden)
    .reduce((sum, goal) => sum + totalGoalCost(goal), 0);
}

function sectionForGoal(goal: SavingsGoal, today: string): GoalSectionKey {
  if (goal.startDate > today) return 'upcoming';
  if (goal.endDate < today) return 'finished';
  return 'active';
}

export function SavingsGoalManager({
  goals,
  goalStats,
  recurringExpenses,
  editingGoalId,
  onEditingGoalChange,
  onUpdate,
  onRemove,
  onToggleHidden,
}: SavingsGoalManagerProps) {
  const [activeOpen, setActiveOpen] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [goalSort, setGoalSort] = useState<GoalSortMode>('deadline');
  const [openGoalGroups, setOpenGoalGroups] = useState<Set<string>>(
    () => new Set(),
  );

  const today = todayValue();

  const statForGoal = (goal: SavingsGoal) =>
    goalStats.find((stat) => stat.goalId === goal.id);

  const compareGoals = (a: SavingsGoal, b: SavingsGoal) => {
    if (goalSort === 'name') {
      return a.name.localeCompare(b.name) || a.endDate.localeCompare(b.endDate);
    }

    if (goalSort === 'cost') {
      return (
        totalGoalCost(b) - totalGoalCost(a) || a.name.localeCompare(b.name)
      );
    }

    return a.endDate.localeCompare(b.endDate) || a.name.localeCompare(b.name);
  };

  const sorted = [...goals].sort(compareGoals);
  const activeGoals = sorted.filter(
    (goal) => sectionForGoal(goal, today) === 'active',
  );
  const upcomingGoals = sorted.filter(
    (goal) => sectionForGoal(goal, today) === 'upcoming',
  );
  const finishedGoals = sorted.filter(
    (goal) => sectionForGoal(goal, today) === 'finished',
  );

  const groupForGoal = (section: GoalSectionKey, goal: SavingsGoal) => {
    if (section === 'upcoming') {
      const startMonth = goal.startDate.slice(0, 7);
      return {
        key: `upcoming:${startMonth}`,
        label: `Starts ${monthLabel(startMonth)}`,
        order: monthOrder(startMonth),
      };
    }

    if (section === 'finished') {
      const endMonth = goal.endDate.slice(0, 7);
      return {
        key: `finished:${endMonth}`,
        label: `Finished ${monthLabel(endMonth)}`,
        order: -monthOrder(endMonth),
      };
    }

    const stat = statForGoal(goal);
    if (stat && !stat.isFeasible) {
      return {
        key: 'active:attention',
        label: 'Needs attention',
        order: 1,
      };
    }
    if (stat?.isWarning) {
      return {
        key: 'active:tight',
        label: 'Tight margin',
        order: 2,
      };
    }
    return {
      key: 'active:on-track',
      label: 'On track',
      order: 3,
    };
  };

  const buildGoalGroups = (
    section: GoalSectionKey,
    sectionGoals: SavingsGoal[],
  ): GoalGroup[] => {
    const groups = sectionGoals.reduce((map, goal) => {
      const group = groupForGoal(section, goal);
      const current = map.get(group.key) ?? {
        ...group,
        goals: [] as SavingsGoal[],
      };
      current.goals.push(goal);
      map.set(group.key, current);
      return map;
    }, new Map<string, Omit<GoalGroup, 'total' | 'visibleCount'>>());

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        goals: group.goals.sort(compareGoals),
        total: visibleGoalTotal(group.goals),
        visibleCount: group.goals.filter((goal) => !goal.hidden).length,
      }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  };

  const activeGroups = buildGoalGroups('active', activeGoals);
  const upcomingGroups = buildGoalGroups('upcoming', upcomingGoals);
  const finishedGroups = buildGoalGroups('finished', finishedGoals);
  const allGoalGroups = [...activeGroups, ...upcomingGroups, ...finishedGroups];
  const openGroupForGoal = (goal: SavingsGoal) => {
    const section = sectionForGoal(goal, today);
    if (section === 'active') setActiveOpen(true);
    if (section === 'upcoming') setUpcomingOpen(true);
    if (section === 'finished') setFinishedOpen(true);

    setOpenGoalGroups((current) => {
      const next = new Set(current);
      next.add(groupForGoal(section, goal).key);
      return next;
    });
  };

  const toggleGoalGroup = (groupKey: string) => {
    setOpenGoalGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const toggleAllGoalGroups = (groups: GoalGroup[]) => {
    const allOpen =
      groups.length > 0 &&
      groups.every((group) => openGoalGroups.has(group.key));

    setOpenGoalGroups((current) => {
      const next = new Set(current);
      for (const group of groups) {
        if (allOpen) {
          next.delete(group.key);
        } else {
          next.add(group.key);
        }
      }
      return next;
    });
  };

  const expandAllGoals = () => {
    setActiveOpen(activeGoals.length > 0);
    setUpcomingOpen(upcomingGoals.length > 0);
    setFinishedOpen(finishedGoals.length > 0);
    setOpenGoalGroups(new Set(allGoalGroups.map((group) => group.key)));
  };

  const collapseAllGoals = () => {
    setActiveOpen(false);
    setUpcomingOpen(false);
    setFinishedOpen(false);
    setOpenGoalGroups(new Set());
  };

  const sortLabel =
    goalSort === 'deadline'
      ? 'Deadline'
      : goalSort === 'name'
        ? 'Name'
        : 'Cost';

  const cycleGoalSort = () => {
    setGoalSort((sort) =>
      sort === 'deadline' ? 'name' : sort === 'name' ? 'cost' : 'deadline',
    );
  };

  const renderGoal = (goal: SavingsGoal) => {
    const stat = statForGoal(goal);
    if (!stat) return null;

    if (editingGoalId === goal.id) {
      return (
        <GoalForm
          key={goal.id}
          goal={goal}
          recurringExpenses={recurringExpenses}
          onSave={(updated) => {
            onUpdate({ ...updated, hidden: goal.hidden });
            onEditingGoalChange(null);
          }}
          onCancel={() => onEditingGoalChange(null)}
        />
      );
    }

    return (
      <GoalCard
        key={goal.id}
        goal={goal}
        stat={stat}
        recurringExpenses={recurringExpenses}
        onEdit={() => {
          openGroupForGoal(goal);
          onEditingGoalChange(goal.id);
        }}
        onDelete={() => onRemove(goal.id)}
        onToggleHidden={() => onToggleHidden(goal.id)}
      />
    );
  };

  const renderGoalSection = ({
    key,
    label,
    goals: sectionGoals,
    groups,
    open,
    onToggle,
  }: GoalSectionView) => {
    if (sectionGoals.length === 0) return null;

    const visibleCount = sectionGoals.filter((goal) => !goal.hidden).length;
    const total = visibleGoalTotal(sectionGoals);
    const amountClassName =
      key === 'finished' ? 'text-red-400' : 'text-foreground';
    const amountPrefix = key === 'finished' ? '-' : '';
    const allGroupsOpen =
      groups.length > 0 &&
      groups.every((group) => openGoalGroups.has(group.key));

    return (
      <div className="rounded-lg border border-border/40 bg-muted/20 transition-colors hover:border-border/70">
        <button
          type="button"
          className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/40 hover:text-foreground"
          onClick={onToggle}
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {key === 'finished' ? (
            <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : key === 'upcoming' ? (
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate font-medium text-sm">
            {label}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {visibleCount}/{sectionGoals.length}
          </span>
          {visibleCount > 0 && (
            <span
              className={`hidden shrink-0 font-mono text-xs sm:inline ${amountClassName}`}
            >
              {amountPrefix}${total.toLocaleString()}
            </span>
          )}
        </button>

        {open && (
          <div className="space-y-2 border-border/40 border-t p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                {groups.length} {groups.length === 1 ? 'group' : 'groups'}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={cycleGoalSort}
                  title="Toggle savings goal sort"
                >
                  <ArrowDownUp className="h-3 w-3" />
                  {sortLabel}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => toggleAllGoalGroups(groups)}
                >
                  {allGroupsOpen ? 'Close all' : 'Open all'}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              {groups.map((group) => {
                const groupOpen = openGoalGroups.has(group.key);

                return (
                  <div
                    key={group.key}
                    className="overflow-hidden rounded-md border border-border/30 bg-background/30 transition-colors hover:border-border/60"
                  >
                    <button
                      type="button"
                      className="flex w-full min-w-0 cursor-pointer items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-muted/40 hover:text-foreground"
                      onClick={() => toggleGoalGroup(group.key)}
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
                        {group.visibleCount}/{group.goals.length}
                      </span>
                      {group.visibleCount > 0 && (
                        <span
                          className={`hidden shrink-0 font-mono text-xs sm:inline ${amountClassName}`}
                        >
                          {amountPrefix}${group.total.toLocaleString()}
                        </span>
                      )}
                    </button>

                    {groupOpen && (
                      <div className="space-y-2 border-border/30 border-t p-1">
                        {group.goals.map((goal) => renderGoal(goal))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {goals.length > 0 && (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={expandAllGoals}
            title="Expand all"
            aria-label="Expand all savings goal groups"
          >
            <ChevronsDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={collapseAllGoals}
            title="Collapse all"
            aria-label="Collapse all savings goal groups"
          >
            <ChevronsUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {renderGoalSection({
        key: 'active',
        label: 'Active goals',
        goals: activeGoals,
        groups: activeGroups,
        open: activeOpen,
        onToggle: () => setActiveOpen((open) => !open),
      })}

      {renderGoalSection({
        key: 'upcoming',
        label: 'Starts later',
        goals: upcomingGoals,
        groups: upcomingGroups,
        open: upcomingOpen,
        onToggle: () => setUpcomingOpen((open) => !open),
      })}

      {renderGoalSection({
        key: 'finished',
        label: 'Finished goals',
        goals: finishedGoals,
        groups: finishedGroups,
        open: finishedOpen,
        onToggle: () => setFinishedOpen((open) => !open),
      })}
    </div>
  );
}
