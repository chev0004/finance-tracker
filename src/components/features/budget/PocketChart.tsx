'use client';

import { format, isValid, parseISO } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import {
  type MutableRefObject,
  memo,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  startTransition,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { PocketExpenseItem, PocketPoint } from '@/types';

interface PocketChartProps {
  data: PocketPoint[];
  today: string;
  onSelectExpensePeriod?: (period: {
    start: string;
    end: string;
    label: string;
    index: number;
  }) => void;
  onSkipRecurringInstance?: (
    recurringExpenseId: string,
    occurrenceDate: string,
    note: string,
  ) => { success: boolean; error?: string };
}

const GREEN = '#10b981';
const RED = '#ef4444';
const ORANGE = '#f59e0b';
const GRAY = '#6b7280';
const BLUE = '#3b82f6';

const DOT_HIT_Z = 2500;

function fmtAmount(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getPocketColor(
  type: PocketPoint['type'],
  isSelected: boolean,
  spent: number,
  balance: number,
): string {
  if (isSelected) return BLUE;
  if (type === 'over') return RED;
  if (type === 'surplus' && spent > 0 && balance > 0) return ORANGE;
  if (type === 'surplus' && spent > 0) return RED;
  if (type === 'surplus') return GREEN;
  return GRAY;
}

interface ChartDataPoint {
  date: string;
  rawDate: string;
  balance: number;
  pastBalance: number | null;
  futureBalance: number | null;
  isFuture: boolean;
  available: number;
  spent: number;
  overage: number;
  type: PocketPoint['type'];
  idx: number;
  expenseCount: number;
  expenseItems: PocketExpenseItem[];
  color: string;
  isSelected: boolean;
}

interface PocketDotTarget {
  id: string;
  x: number;
  y: number;
  hitRadius: number;
  idx: number;
  point: ChartDataPoint;
}

type SkipDialogTarget = {
  recurringExpenseId: string;
  occurrenceDate: string;
  displayDate: string;
  label: string;
  amount: number;
};

const PocketTooltipBody = memo(function PocketTooltipBody({
  point,
}: {
  point: ChartDataPoint;
}) {
  return (
    <div className="glass-card p-3">
      <div className="mb-2 text-muted-foreground text-xs">{point.date}</div>
      {point.expenseItems.length > 0 ? (
        <div className="mb-1 space-y-0.5">
          {point.expenseItems.map((item, i) => (
            <div key={i} className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono text-foreground text-sm">
                -${fmtAmount(item.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        point.spent > 0 && (
          <div className="mb-1 flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Spent</span>
            <span className="font-mono text-foreground">
              -${fmtAmount(point.spent)}
            </span>
          </div>
        )
      )}
      {point.balance > 0 && (
        <div className="mt-1 font-mono text-green-400 text-sm">
          ${fmtAmount(point.balance)} unspent
        </div>
      )}
      {point.overage > 0 && (
        <div className="mt-1 font-mono text-red-400 text-sm">
          ${fmtAmount(point.overage)} over budget
        </div>
      )}
    </div>
  );
});

interface PocketChartPlotProps {
  chartData: ChartDataPoint[];
  todayLineLabel: string | null;
  tickInterval: number;
  dotTargetsRef: MutableRefObject<Map<string, PocketDotTarget>>;
}

const PocketChartPlot = memo(function PocketChartPlot({
  chartData,
  todayLineLabel,
  tickInterval,
  dotTargetsRef,
}: PocketChartPlotProps) {
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
            fontSize: 9,
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
          const baseR = point.isSelected ? 8 : point.expenseCount > 0 ? 6 : 5;
          const dotId = `pocket-${point.idx}-${index}`;
          const hitRadius = baseR;
          return (
            <ReferenceDot
              key={`${point.idx}-${index}`}
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
                  hitRadius,
                  idx: point.idx,
                  point,
                });
                return (
                  <g
                    className="chart-marker-layer"
                    transform={`translate(${cx},${cy})`}
                  >
                    <g className="chart-marker-scale-wrap chart-marker-scale-wrap--strong">
                      <ellipse
                        className="chart-marker-mask"
                        cx={0}
                        cy={0}
                        rx={baseR}
                        ry={baseR}
                        fill="var(--card)"
                      />
                      <circle
                        className="chart-marker-dot chart-marker-dot--interactive"
                        cx={0}
                        cy={0}
                        r={baseR}
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

export function PocketChart({
  data,
  today,
  onSelectExpensePeriod,
  onSkipRecurringInstance,
}: PocketChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [skipTarget, setSkipTarget] = useState<SkipDialogTarget | null>(null);
  const [skipNote, setSkipNote] = useState('');
  const [hoverTooltip, setHoverTooltip] = useState<PocketDotTarget | null>(
    null,
  );
  const dotTargetsRef = useRef<Map<string, PocketDotTarget>>(new Map());
  const hoverTooltipRef = useRef<PocketDotTarget | null>(null);
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
        available: point.available,
        spent: point.spent,
        overage: point.overage,
        type: point.type,
        idx: point.idx,
        expenseCount: point.expenseCount,
        expenseItems: point.expenseItems,
        color: getPocketColor(
          point.type,
          point.idx === selectedIdx,
          point.spent,
          point.balance,
        ),
        isSelected: point.idx === selectedIdx,
      };
    });
  }, [data, selectedIdx, today]);

  const todayLineLabel = useMemo(() => {
    let lastPastIdx = -1;
    for (let i = 0; i < chartData.length; i++) {
      if (chartData[i].rawDate <= today) lastPastIdx = i;
    }
    return lastPastIdx >= 0 ? chartData[lastPastIdx].date : null;
  }, [chartData, today]);

  const tickInterval =
    chartData.length > 80 ? Math.floor(chartData.length / 80) : 0;

  const visibleDotIds = useMemo(
    () =>
      new Set(chartData.map((point, index) => `pocket-${point.idx}-${index}`)),
    [chartData],
  );

  const pickDotUnderPointer = (px: number, py: number) => {
    let best: PocketDotTarget | null = null;
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
    let nearest: PocketDotTarget | null = null;
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

  const commitHoverTooltip = (next: PocketDotTarget | null) => {
    const prevId = hoverTooltipRef.current?.id ?? null;
    const nextId = next?.id ?? null;
    hoverTooltipRef.current = next;
    if (prevId !== nextId) {
      startTransition(() => {
        setHoverTooltip(next);
      });
    }
  };

  const selectedPoint =
    selectedIdx !== null
      ? (data.find((p) => p.idx === selectedIdx) ?? null)
      : null;

  const skippableRecurring = useMemo(() => {
    if (!selectedPoint || !onSkipRecurringInstance) return [];
    return selectedPoint.expenseItems.filter(
      (
        i,
      ): i is PocketExpenseItem & {
        recurringExpenseId: string;
        date: string;
      } => Boolean(i.recurringExpenseId && i.date),
    );
  }, [selectedPoint, onSkipRecurringInstance]);

  const handleDotClick = (idx: number) => {
    setErrorMsg(null);
    const point = data.find((p) => p.idx === idx);
    if (!point) return;

    if (selectedIdx === idx) {
      setSelectedIdx(null);
    } else {
      onSelectExpensePeriod?.({
        start: point.weekStart,
        end: point.weekEnd,
        label: point.date,
        index: point.idx,
      });
      setSelectedIdx(idx);
    }
  };

  const updateHoverCursor = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const xRaw = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    el.style.cursor = pickDotUnderPointer(xRaw, y) ? 'pointer' : 'default';
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
      tip.style.transform = `translate3d(${xHighlight + 14}px, ${Math.max(8, y - 76)}px, 0)`;
    }
    commitHoverTooltip(pickNearestByX(xHighlight));
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
    if (!target) return;
    handleDotClick(target.idx);
  };

  const handleChartContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const t = hoverTooltipRef.current;
    if (!t) return;
    event.preventDefault();
    handleDotClick(t.idx);
  };

  const openSkipDialog = (item: PocketExpenseItem) => {
    if (!item.recurringExpenseId || !item.date) return;
    setSkipNote('');
    setSkipTarget({
      recurringExpenseId: item.recurringExpenseId,
      occurrenceDate: item.recurringOccurrenceDate ?? item.date,
      displayDate: item.date,
      label: item.label,
      amount: item.amount,
    });
  };

  const handleConfirmSkip = () => {
    if (!skipTarget || !onSkipRecurringInstance) return;
    const result = onSkipRecurringInstance(
      skipTarget.recurringExpenseId,
      skipTarget.occurrenceDate,
      skipNote,
    );
    if (result.success) {
      setSkipTarget(null);
      setSkipNote('');
      setErrorMsg(null);
    } else {
      setErrorMsg(result.error || 'Could not skip');
    }
  };

  const fmtOccurrence = (dateStr: string) => {
    const d = parseISO(dateStr);
    return isValid(d) ? format(d, 'MMM d, yyyy') : dateStr;
  };

  return (
    <div className="space-y-4">
      <Dialog
        open={skipTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSkipTarget(null);
            setSkipNote('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Skip this occurrence</DialogTitle>
            <DialogDescription>
              {skipTarget ? (
                <>
                  {skipTarget.label} on{' '}
                  <span className="font-mono text-foreground">
                    {fmtOccurrence(skipTarget.displayDate)}
                  </span>
                  , -${fmtAmount(skipTarget.amount)} from pocket for this
                  period.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-2">
            <Label
              htmlFor="skip-note"
              className="text-muted-foreground text-xs uppercase tracking-wider"
            >
              Note (optional)
            </Label>
            <textarea
              id="skip-note"
              rows={3}
              value={skipNote}
              onChange={(e) => setSkipNote(e.target.value)}
              placeholder="e.g. covered elsewhere, waived fee"
              className={cn(
                'min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground hover:border-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
              )}
            />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSkipTarget(null);
                setSkipNote('');
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="muted" onClick={handleConfirmSkip}>
              Skip occurrence
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: chart uses pointer capture for smooth overlay */}
      <div
        ref={chartAreaRef}
        className="budget-chart relative h-[200px] w-full sm:h-[240px]"
        onPointerMoveCapture={updateHoverCursor}
        onPointerLeave={clearHoverTarget}
        onClick={handleChartClick}
        onContextMenu={handleChartContextMenu}
      >
        <PocketChartPlot
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
          aria-hidden={!hoverTooltip}
          className={cn('chart-floating-tooltip', hoverTooltip && 'is-visible')}
        >
          {hoverTooltip && <PocketTooltipBody point={hoverTooltip.point} />}
        </div>
      </div>

      {selectedPoint && skippableRecurring.length > 0 && (
        <Card className="glass-card p-4 transition-colors">
          <div className="mb-2 text-muted-foreground text-xs">
            Week: {selectedPoint.date}
          </div>
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs">
              Recurring pocket charges (click to skip once)
            </div>
            <ul className="space-y-1.5">
              {skippableRecurring.map((item) => (
                <li key={`${item.recurringExpenseId}-${item.date}`}>
                  <button
                    type="button"
                    onClick={() => openSkipDialog(item)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="min-w-0 text-muted-foreground">
                      <span className="text-foreground">{item.label}</span>
                      {item.date ? (
                        <span className="mt-0.5 block font-normal text-xs">
                          {fmtOccurrence(item.date)}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-xs">
                      −${fmtAmount(item.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}
