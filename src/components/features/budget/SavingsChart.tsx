'use client';

import {
  type MutableRefObject,
  memo,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useChartMaxTicks } from '@/hooks/useChartMaxTicks';
import { cn } from '@/lib/utils';
import type { PaydayEditRow, SavingsPoint, SavingsPointEvent } from '@/types';

interface SavingsChartProps {
  data: SavingsPoint[];
  today: string;
  getPaydayEditRowsForDate: (rawDate: string) => PaydayEditRow[];
  onApplyPaydayIncomeAmounts: (
    rawDate: string,
    amounts: { sourceId: string; amount: number }[],
  ) => void;
  onSkipRecurringInstance?: (
    recurringExpenseId: string,
    occurrenceDate: string,
    note: string,
    amount?: number,
  ) => { success: boolean; error?: string };
  onRestoreRecurringInstance?: (
    recurringExpenseId: string,
    occurrenceDate: string,
  ) => void;
  onBranchFromPoint?: (rawDate: string, savingsBalance: number) => void;
}

const GREEN = '#10b981';
const RED = '#ef4444';
const ORANGE = '#f59e0b';
const GRAY = '#6b7280';
const BLUE = '#3b82f6';

const DOT_HIT_Z = 2500;

function getSavingsColor(
  type: SavingsPoint['type'],
  events: SavingsPoint['events'],
): string {
  if (type === 'start') return GRAY;
  const hasGain = events.some((e) => e.delta > 0);
  const hasLoss = events.some((e) => e.delta < 0);
  if (hasGain && hasLoss) return ORANGE;
  if (hasGain) return GREEN;
  return RED;
}

function getSavingsRadius(type: SavingsPoint['type']): number {
  if (type === 'goal') return 8;
  if (type === 'payday-recurring') return 6;
  if (type === 'recurring') return 5;
  return 4;
}

interface ChartDataPoint {
  date: string;
  rawDate: string;
  balance: number;
  pastBalance: number | null;
  futureBalance: number | null;
  isFuture: boolean;
  label: string;
  type: SavingsPoint['type'];
  color: string;
  radius: number;
  events: SavingsPointEvent[];
  canEditPayday: boolean;
  canSkipRecurring: boolean;
  canBranchFromHere: boolean;
}

interface SavingsDotTarget {
  id: string;
  x: number;
  y: number;
  hitRadius: number;
  point: ChartDataPoint;
}

function eventName(label: string): string {
  return label.replace(/\s*\$[\d,.]+$/, '');
}

function formatDelta(delta: number): string {
  const abs = Math.abs(delta).toLocaleString();
  return delta >= 0 ? `+$${abs}` : `-$${abs}`;
}

function deltaColor(delta: number): string {
  return delta >= 0 ? GREEN : RED;
}

const SavingsTooltipBody = memo(function SavingsTooltipBody({
  point,
}: {
  point: ChartDataPoint;
}) {
  const evs = point.events;
  const net = evs.reduce((s, e) => s + e.delta, 0);

  return (
    <div className="glass-card p-3">
      <div className="mb-2 text-muted-foreground text-xs">{point.date}</div>
      {evs.length > 0 ? (
        <div className="space-y-1">
          {evs.map((ev, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4">
              <span className="text-sm">{eventName(ev.label)}</span>
              <span
                className="font-mono text-sm"
                style={{ color: deltaColor(ev.delta) }}
              >
                {formatDelta(ev.delta)}
              </span>
            </div>
          ))}
          {evs.length > 1 && (
            <div className="flex items-baseline justify-between gap-4 border-border/50 border-t pt-1">
              <span className="text-muted-foreground text-xs">Net</span>
              <span
                className="font-mono text-xs"
                style={{ color: deltaColor(net) }}
              >
                {formatDelta(net)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="font-medium text-sm">{point.label}</div>
      )}
      <div className="mt-2 flex items-baseline justify-between gap-4 border-border/50 border-t pt-1">
        <span className="text-muted-foreground text-xs">Balance</span>
        <span className="font-mono text-sm">
          {point.balance < 0
            ? `-$${Math.abs(point.balance).toLocaleString()}`
            : `$${point.balance.toLocaleString()}`}
        </span>
      </div>
    </div>
  );
});

interface SavingsChartPlotProps {
  chartData: ChartDataPoint[];
  todayLineLabel: string | null;
  tickInterval: number;
  dotTargetsRef: MutableRefObject<Map<string, SavingsDotTarget>>;
}

const SavingsChartPlot = memo(function SavingsChartPlot({
  chartData,
  todayLineLabel,
  tickInterval,
  dotTargetsRef,
}: SavingsChartPlotProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 10, right: 8, left: 4, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="date"
          tick={{
            fill: '#6b7280',
            fontSize: 10,
            fontFamily: 'var(--font-dm-sans)',
          }}
          axisLine={{ stroke: 'transparent' }}
          tickLine={false}
          interval={tickInterval}
          angle={-35}
          textAnchor="end"
          height={50}
        />
        <YAxis
          width={48}
          tick={{
            fill: '#6b7280',
            fontSize: 9,
            fontFamily: 'var(--font-space-mono)',
          }}
          axisLine={{ stroke: 'transparent' }}
          tickLine={false}
          tickCount={10}
          tickMargin={4}
          minTickGap={0}
          tickFormatter={(value) =>
            value < 0
              ? `-$${Math.abs(value).toLocaleString()}`
              : `$${value.toLocaleString()}`
          }
          domain={[0, 'auto']}
        />
        <Line
          type="stepAfter"
          dataKey="pastBalance"
          stroke={BLUE}
          strokeWidth={2}
          dot={false}
          activeDot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="stepAfter"
          dataKey="futureBalance"
          stroke={BLUE}
          strokeOpacity={0.45}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          activeDot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        {todayLineLabel && (
          <ReferenceLine
            x={todayLineLabel}
            stroke="#9ca3af"
            strokeDasharray="2 4"
            strokeWidth={1}
            label={{
              value: 'today',
              position: 'insideTopRight',
              fill: '#9ca3af',
              fontSize: 10,
              fontFamily: 'var(--font-space-mono)',
            }}
          />
        )}
        {chartData.map((point, index) => {
          const dotId = `savings-${index}`;
          return (
            <ReferenceDot
              key={index}
              x={point.date}
              y={point.balance}
              r={0}
              zIndex={DOT_HIT_Z}
              fill="transparent"
              stroke="none"
              shape={(props: { cx?: number; cy?: number }) => {
                const { cx, cy } = props;
                if (cx == null || cy == null) return <g />;
                dotTargetsRef.current.set(dotId, {
                  id: dotId,
                  x: cx,
                  y: cy,
                  hitRadius: point.radius,
                  point,
                });
                return (
                  <g
                    className="chart-marker-layer"
                    transform={`translate(${cx},${cy})`}
                  >
                    <g
                      className={cn(
                        'chart-marker-scale-wrap',
                        (point.canEditPayday ||
                          point.canSkipRecurring ||
                          point.canBranchFromHere) &&
                          'chart-marker-scale-wrap--strong',
                      )}
                    >
                      <ellipse
                        className="chart-marker-mask"
                        cx={0}
                        cy={0}
                        rx={point.radius}
                        ry={point.radius}
                        fill="var(--card)"
                      />
                      <circle
                        className={cn(
                          'chart-marker-dot',
                          (point.canEditPayday ||
                            point.canSkipRecurring ||
                            point.canBranchFromHere) &&
                            'chart-marker-dot--interactive',
                        )}
                        cx={0}
                        cy={0}
                        r={point.radius}
                        fill={point.color}
                        fillOpacity={point.isFuture ? 0.45 : 1}
                      />
                    </g>
                  </g>
                );
              }}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
});

export function SavingsChart({
  data,
  today,
  getPaydayEditRowsForDate,
  onApplyPaydayIncomeAmounts,
  onSkipRecurringInstance,
  onRestoreRecurringInstance,
  onBranchFromPoint,
}: SavingsChartProps) {
  const maxVisibleTicks = useChartMaxTicks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRawDate, setDialogRawDate] = useState('');
  const [dialogRows, setDialogRows] = useState<PaydayEditRow[]>([]);
  const [draftBySource, setDraftBySource] = useState<Record<string, string>>(
    {},
  );
  const [skipTarget, setSkipTarget] = useState<{
    date: string;
    event: SavingsPointEvent & { recurringExpenseId: string };
  } | null>(null);
  const [skipNote, setSkipNote] = useState('');
  const [skipAmount, setSkipAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [chartActionMenu, setChartActionMenu] = useState<{
    x: number;
    y: number;
    point: ChartDataPoint;
  } | null>(null);
  const chartActionMenuRef = useRef<HTMLDivElement>(null);
  const [chartActionMenuStyle, setChartActionMenuStyle] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [activeActionGroup, setActiveActionGroup] = useState<
    'recurring' | null
  >(null);
  const [actionSubmenuSide, setActionSubmenuSide] = useState<'left' | 'right'>(
    'right',
  );
  const [actionSubmenuTop, setActionSubmenuTop] = useState(0);
  const [actionSubmenuAnchor, setActionSubmenuAnchor] = useState<{
    top: number;
    bottom: number;
  } | null>(null);
  const actionSubmenuRef = useRef<HTMLDivElement>(null);
  const [hoverTooltip, setHoverTooltip] = useState<SavingsDotTarget | null>(
    null,
  );
  const [freezeChartTooltip, setFreezeChartTooltip] = useState(false);
  const dotTargetsRef = useRef<Map<string, SavingsDotTarget>>(new Map());
  const hoverTooltipRef = useRef<SavingsDotTarget | null>(null);
  const cursorLineRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    let lastPastIdx = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i].rawDate <= today) lastPastIdx = i;
    }
    const lastPastBalance = lastPastIdx >= 0 ? data[lastPastIdx].balance : null;

    return data.map((point, i) => {
      const canEditPayday =
        point.label !== '…' &&
        point.type !== 'start' &&
        point.events.some((e) => e.type === 'payday');
      const canSkipRecurring =
        point.label !== '…' &&
        point.events.some(
          (e) => e.type === 'recurring' && e.recurringExpenseId,
        );
      const canBranchFromHere =
        Boolean(onBranchFromPoint) &&
        point.label !== '…' &&
        point.type !== 'start' &&
        point.events.length > 0;
      const isFuture = point.rawDate > today;
      const isBridge = lastPastIdx >= 0 && i === lastPastIdx + 1;
      return {
        date: point.date,
        rawDate: point.rawDate,
        balance: point.balance,
        pastBalance: !isFuture
          ? point.balance
          : isBridge
            ? lastPastBalance
            : null,
        futureBalance: isFuture ? point.balance : null,
        isFuture,
        label: point.label,
        type: point.type,
        color: getSavingsColor(point.type, point.events),
        radius: getSavingsRadius(point.type),
        events: point.events,
        canEditPayday,
        canSkipRecurring,
        canBranchFromHere,
      };
    });
  }, [data, onBranchFromPoint, today]);

  const todayLineLabel = useMemo(() => {
    let lastPastIdx = -1;
    for (let i = 0; i < chartData.length; i++) {
      if (chartData[i].rawDate <= today) lastPastIdx = i;
    }
    return lastPastIdx >= 0 ? chartData[lastPastIdx].date : null;
  }, [chartData, today]);

  const tickInterval =
    chartData.length > maxVisibleTicks
      ? Math.floor(chartData.length / maxVisibleTicks)
      : 0;

  const visibleDotIds = useMemo(
    () => new Set(chartData.map((_, index) => `savings-${index}`)),
    [chartData],
  );

  const pickDotUnderPointer = (px: number, py: number) => {
    let best: SavingsDotTarget | null = null;
    let bestD2 = Number.POSITIVE_INFINITY;

    for (const target of dotTargetsRef.current.values()) {
      if (!visibleDotIds.has(target.id)) continue;
      const dx = target.x - px;
      const dy = target.y - py;
      const d2 = dx * dx + dy * dy;
      const r = target.hitRadius;
      if (d2 <= r * r && d2 < bestD2) {
        bestD2 = d2;
        best = target;
      }
    }

    return best;
  };

  const pickNearestByX = (px: number) => {
    let nearest: SavingsDotTarget | null = null;
    let best = Number.POSITIVE_INFINITY;

    for (const target of dotTargetsRef.current.values()) {
      if (!visibleDotIds.has(target.id)) continue;
      const d = Math.abs(target.x - px);
      if (d < best) {
        best = d;
        nearest = target;
      }
    }

    return nearest;
  };

  const commitHoverTooltip = (next: SavingsDotTarget | null) => {
    const prevId = hoverTooltipRef.current?.id ?? null;
    const nextId = next?.id ?? null;
    hoverTooltipRef.current = next;
    if (prevId !== nextId) {
      startTransition(() => {
        setHoverTooltip(next);
      });
    }
  };

  const openPaydayDialog = (point: ChartDataPoint) => {
    if (!point.canEditPayday) return;
    const rows = getPaydayEditRowsForDate(point.rawDate);
    if (rows.length === 0) return;
    setDialogRawDate(point.rawDate);
    setDialogRows(rows);
    const draft: Record<string, string> = {};
    for (const r of rows) {
      draft[r.sourceId] = String(r.currentAmount);
    }
    setDraftBySource(draft);
    setDialogOpen(true);
  };

  const updateHoverCursor = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const xRaw = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const hit = pickDotUnderPointer(xRaw, y);
    const actionable =
      hit &&
      (hit.point.canEditPayday ||
        hit.point.canSkipRecurring ||
        hit.point.canBranchFromHere);
    el.style.cursor = actionable ? 'pointer' : 'default';
    let minDotX = Number.POSITIVE_INFINITY;
    let maxDotX = Number.NEGATIVE_INFINITY;
    for (const target of dotTargetsRef.current.values()) {
      if (!visibleDotIds.has(target.id)) continue;
      minDotX = Math.min(minDotX, target.x);
      maxDotX = Math.max(maxDotX, target.x);
    }
    const xHighlight =
      minDotX <= maxDotX ? Math.max(minDotX, Math.min(maxDotX, xRaw)) : xRaw;
    const line = cursorLineRef.current;
    if (line) {
      line.style.opacity = '1';
      line.style.left = `${xHighlight}px`;
    }
    const tip = tooltipRef.current;
    if (tip) {
      tip.style.transform = `translate3d(${xHighlight + 14}px, ${Math.max(8, y - 88)}px, 0)`;
    }
    if (!chartActionMenu && !freezeChartTooltip) {
      commitHoverTooltip(pickNearestByX(xHighlight));
    }
  };

  const clearHoverTarget = () => {
    const area = chartAreaRef.current;
    if (area) {
      area.style.cursor = '';
    }
    if (cursorLineRef.current) {
      cursorLineRef.current.style.opacity = '0';
    }
    commitHoverTooltip(null);
  };

  const handleChartClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const target = pickDotUnderPointer(x, y);
    if (
      !target?.point.canEditPayday &&
      !target?.point.canSkipRecurring &&
      !target?.point.canBranchFromHere
    ) {
      return;
    }
    openChartActionMenu(event.clientX, event.clientY, target.point);
  };

  const handleChartContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (chartActionMenu || freezeChartTooltip) return;
    const t = hoverTooltipRef.current;
    if (!t) return;
    const p = t.point;
    if (!p.canEditPayday && !p.canSkipRecurring && !p.canBranchFromHere) {
      return;
    }
    event.preventDefault();
    openChartActionMenu(event.clientX, event.clientY, p);
  };

  const openChartActionMenu = (
    clientX: number,
    clientY: number,
    point: ChartDataPoint,
  ) => {
    commitHoverTooltip(null);
    setFreezeChartTooltip(false);
    setChartActionMenu({ x: clientX, y: clientY, point });
    setChartActionMenuStyle({ left: clientX + 10, top: clientY });
  };

  const closeChartActionMenu = useCallback(() => {
    setChartActionMenu(null);
    setChartActionMenuStyle(null);
    setActiveActionGroup(null);
    setActionSubmenuAnchor(null);
    setFreezeChartTooltip(true);
  }, []);

  useLayoutEffect(() => {
    if (!chartActionMenu) return;
    const el = chartActionMenuRef.current;
    if (!el) return;
    const pad = 12;
    const gap = 10;
    let left = chartActionMenu.x + gap;
    const top = chartActionMenu.y;
    const rect = el.getBoundingClientRect();
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, chartActionMenu.x - rect.width - gap);
    }
    setChartActionMenuStyle((prev) => {
      if (prev?.left === left && prev?.top === top) return prev;
      return { left, top };
    });
  }, [chartActionMenu]);

  useLayoutEffect(() => {
    if (activeActionGroup !== 'recurring' || !actionSubmenuAnchor) return;
    const menuEl = chartActionMenuRef.current;
    const submenuEl = actionSubmenuRef.current;
    if (!menuEl || !submenuEl) return;

    const pad = 12;
    const gap = 4;
    const menuRect = menuEl.getBoundingClientRect();
    const submenuRect = submenuEl.getBoundingClientRect();
    const roomRight = window.innerWidth - pad - menuRect.right;
    const roomLeft = menuRect.left - pad;
    const nextSide =
      roomRight >= submenuRect.width + gap || roomRight >= roomLeft
        ? 'right'
        : 'left';

    const triggerTop = actionSubmenuAnchor.top - menuRect.top;
    const triggerBottom = actionSubmenuAnchor.bottom - menuRect.top;
    const opensDown =
      window.innerHeight - pad - actionSubmenuAnchor.top >= submenuRect.height;
    const idealTop = opensDown
      ? triggerTop
      : triggerBottom - submenuRect.height;
    const minTop = pad - menuRect.top;
    const maxTop = window.innerHeight - pad - menuRect.top - submenuRect.height;
    const nextTop = Math.max(minTop, Math.min(idealTop, maxTop));

    setActionSubmenuSide(nextSide);
    setActionSubmenuTop(nextTop);
  }, [activeActionGroup, actionSubmenuAnchor]);

  useEffect(() => {
    if (!chartActionMenu) return;
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target as Node;
      if (chartActionMenuRef.current?.contains(t)) return;
      closeChartActionMenu();
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeChartActionMenu();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [chartActionMenu, closeChartActionMenu]);

  useEffect(() => {
    if (!chartActionMenu) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [chartActionMenu]);

  useEffect(() => {
    if (!freezeChartTooltip) return;
    const unfreeze = () => {
      setFreezeChartTooltip(false);
    };
    window.addEventListener('pointermove', unfreeze, { passive: true });
    return () => window.removeEventListener('pointermove', unfreeze);
  }, [freezeChartTooltip]);

  const handleSaveDialog = () => {
    const amounts = dialogRows.map((r) => ({
      sourceId: r.sourceId,
      amount: Number.parseFloat(draftBySource[r.sourceId] ?? '') || 0,
    }));
    onApplyPaydayIncomeAmounts(dialogRawDate, amounts);
    setDialogOpen(false);
  };

  const openEditRecurringDialog = (
    point: ChartDataPoint,
    event: SavingsPointEvent & { recurringExpenseId: string },
  ) => {
    setSkipTarget({ date: point.rawDate, event });
    setSkipNote('');
    setSkipAmount(String(Math.abs(event.delta)));
    setErrorMsg(null);
  };

  const handleSkipRecurring = (forcedAmount?: number) => {
    if (!skipTarget || !onSkipRecurringInstance) return;
    const amount =
      forcedAmount ?? Math.max(0, Number.parseFloat(skipAmount) || 0);
    const result = onSkipRecurringInstance(
      skipTarget.event.recurringExpenseId,
      skipTarget.date,
      skipNote,
      amount,
    );
    if (result.success) {
      setSkipTarget(null);
      setSkipNote('');
      setSkipAmount('');
      setErrorMsg(null);
    } else {
      setErrorMsg(result.error || 'Could not skip recurring expense.');
    }
  };

  const handleRestoreRecurring = () => {
    if (!skipTarget || !onRestoreRecurringInstance) return;
    onRestoreRecurringInstance(
      skipTarget.event.recurringExpenseId,
      skipTarget.date,
    );
    setSkipTarget(null);
    setSkipNote('');
    setSkipAmount('');
    setErrorMsg(null);
  };

  const chartMenuRecurringEvents =
    chartActionMenu?.point.events.filter(
      (
        ev,
      ): ev is SavingsPointEvent & {
        recurringExpenseId: string;
      } => ev.type === 'recurring' && Boolean(ev.recurringExpenseId),
    ) ?? [];
  const chartMenuHasEditActions = Boolean(
    chartActionMenu?.point.canEditPayday || chartMenuRecurringEvents.length > 0,
  );

  const openRecurringActionGroup = (triggerEl: HTMLElement) => {
    const triggerRect = triggerEl.getBoundingClientRect();
    setActionSubmenuAnchor({
      top: triggerRect.top,
      bottom: triggerRect.bottom,
    });
    setActiveActionGroup('recurring');
  };

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-500 text-sm">
          {errorMsg}
        </div>
      )}

      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: chart uses pointer capture for smooth overlay */}
      <div
        ref={chartAreaRef}
        className="budget-chart relative h-[280px] w-full sm:h-[320px]"
        onPointerMoveCapture={updateHoverCursor}
        onPointerLeave={clearHoverTarget}
        onClick={handleChartClick}
        onContextMenu={handleChartContextMenu}
      >
        <SavingsChartPlot
          chartData={chartData}
          todayLineLabel={todayLineLabel}
          tickInterval={tickInterval}
          dotTargetsRef={dotTargetsRef}
        />
        <div
          ref={cursorLineRef}
          aria-hidden="true"
          className="chart-hover-cursor-overlay"
        />
        <div
          ref={tooltipRef}
          aria-hidden={Boolean(
            !hoverTooltip || chartActionMenu || freezeChartTooltip,
          )}
          className={cn(
            'chart-floating-tooltip',
            hoverTooltip &&
              !chartActionMenu &&
              !freezeChartTooltip &&
              'is-visible',
          )}
        >
          {hoverTooltip && <SavingsTooltipBody point={hoverTooltip.point} />}
        </div>
      </div>

      {chartActionMenu &&
        chartActionMenuStyle &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={chartActionMenuRef}
            className="fixed z-[100] select-none"
            style={{
              left: chartActionMenuStyle.left,
              top: chartActionMenuStyle.top,
              transform: 'translateY(-50%)',
            }}
            role="menu"
            aria-label="Chart actions"
          >
            <div className="glass-card w-64 overflow-visible">
              <div className="border-border/40 border-b px-3.5 py-2.5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  {chartActionMenu.point.date}
                </p>
                <p className="mt-1 font-mono text-foreground text-xs tabular-nums">
                  {chartActionMenu.point.rawDate}
                </p>
              </div>

              {chartActionMenu.point.canBranchFromHere && (
                <div className="p-1.5">
                  <div className="px-2 pt-1 pb-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Projection
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className={cn(
                      'flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm transition-colors',
                      'text-foreground/95 hover:bg-muted/60 active:bg-muted',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                    onClick={() => {
                      const p = chartActionMenu.point;
                      closeChartActionMenu();
                      onBranchFromPoint?.(p.rawDate, p.balance);
                    }}
                  >
                    <span className="min-w-0 flex-1">Branch From Here</span>
                  </button>
                </div>
              )}

              {chartMenuHasEditActions && (
                <div className="border-border/40 border-t">
                  <div className="px-3.5 pt-2 pb-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Edit Event
                  </div>
                  <div className="p-1.5 pt-0">
                    {chartActionMenu.point.canEditPayday && (
                      <button
                        type="button"
                        role="menuitem"
                        className={cn(
                          'flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm transition-colors',
                          'text-foreground/95 hover:bg-muted/60 active:bg-muted',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                        onClick={() => {
                          const p = chartActionMenu.point;
                          closeChartActionMenu();
                          openPaydayDialog(p);
                        }}
                      >
                        <span className="min-w-0 flex-1">Income</span>
                      </button>
                    )}
                    {chartMenuRecurringEvents.length > 0 && (
                      <button
                        type="button"
                        role="menuitem"
                        aria-haspopup="menu"
                        aria-expanded={activeActionGroup === 'recurring'}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                          'text-foreground/95 hover:bg-muted/60 active:bg-muted',
                          activeActionGroup === 'recurring' && 'bg-muted/60',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                        onFocus={(event) =>
                          openRecurringActionGroup(event.currentTarget)
                        }
                        onPointerEnter={(event) =>
                          openRecurringActionGroup(event.currentTarget)
                        }
                      >
                        <span className="min-w-0 flex-1">
                          Recurring expenses
                        </span>
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                          {chartMenuRecurringEvents.length}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {activeActionGroup === 'recurring' &&
              chartMenuRecurringEvents.length > 0 && (
                <div
                  ref={actionSubmenuRef}
                  className={cn(
                    'glass-card absolute w-64 overflow-hidden p-1.5',
                    actionSubmenuSide === 'right'
                      ? 'left-full ml-1'
                      : 'right-full mr-1',
                  )}
                  style={{ top: actionSubmenuTop }}
                  role="menu"
                  aria-label="Recurring expense actions"
                  onFocus={() => setActiveActionGroup('recurring')}
                  onPointerEnter={() => setActiveActionGroup('recurring')}
                >
                  <div className="border-border/40 border-b px-2 py-2">
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                      Recurring Expenses
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {chartMenuRecurringEvents.map((ev) => (
                      <button
                        key={`${ev.recurringExpenseId}-${ev.label}`}
                        type="button"
                        role="menuitem"
                        className={cn(
                          'flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm transition-colors',
                          'text-foreground/95 hover:bg-muted/60 active:bg-muted',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                        onClick={() => {
                          const p = chartActionMenu.point;
                          closeChartActionMenu();
                          openEditRecurringDialog(p, ev);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {eventName(ev.label)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>,
          document.body,
        )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Income for this date only</DialogTitle>
            <DialogDescription>
              Adjust what you were paid on{' '}
              <span className="font-mono text-foreground">{dialogRawDate}</span>
              . This does not change your income source rate or future paydays.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {dialogRows.map((row) => (
              <div key={row.sourceId} className="min-w-0 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                    {row.name}
                  </Label>
                  <span className="font-mono text-[10px] text-muted-foreground/70 uppercase tabular-nums tracking-wider">
                    scheduled ${row.scheduledAmount}
                  </span>
                </div>
                <CurrencyInput
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={draftBySource[row.sourceId] ?? ''}
                  onChange={(e) =>
                    setDraftBySource((prev) => ({
                      ...prev,
                      [row.sourceId]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" variant="muted" onClick={handleSaveDialog}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={skipTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSkipTarget(null);
            setSkipNote('');
            setSkipAmount('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {skipTarget
                ? `Edit ${eventName(skipTarget.event.label)}`
                : 'Edit'}
            </DialogTitle>
            <DialogDescription>
              {skipTarget ? (
                <>
                  One-time adjustment on{' '}
                  <span className="font-mono text-foreground">
                    {skipTarget.date}
                  </span>
                  . Other occurrences are unaffected.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="min-w-0 space-y-2">
              <Label
                htmlFor="recurring-adjustment-amount"
                className="text-muted-foreground text-xs uppercase tracking-wider"
              >
                Amount
              </Label>
              <CurrencyInput
                id="recurring-adjustment-amount"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={skipAmount}
                onChange={(e) => setSkipAmount(e.target.value)}
              />
            </div>

            <div className="min-w-0 space-y-2">
              <Label
                htmlFor="recurring-skip-note"
                className="text-muted-foreground text-xs uppercase tracking-wider"
              >
                Note (optional)
              </Label>
              <textarea
                id="recurring-skip-note"
                rows={3}
                value={skipNote}
                onChange={(e) => setSkipNote(e.target.value)}
                placeholder="e.g. waived, paid elsewhere"
                className={cn(
                  'min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground hover:border-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
                )}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => handleSkipRecurring(0)}
                className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              >
                Skip occurrence
              </button>
              <button
                type="button"
                onClick={handleRestoreRecurring}
                className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              >
                Restore scheduled
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSkipTarget(null);
                setSkipNote('');
                setSkipAmount('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="muted"
              onClick={() => handleSkipRecurring()}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
