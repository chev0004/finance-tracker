'use client';

import {
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
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
  getPaydayEditRowsForDate: (rawDate: string) => PaydayEditRow[];
  onApplyPaydayIncomeAmounts: (
    rawDate: string,
    amounts: { sourceId: string; amount: number }[],
  ) => void;
}

const GREEN = '#10b981';
const RED = '#ef4444';
const ORANGE = '#f59e0b';
const GRAY = '#6b7280';
const BLUE = '#3b82f6';

const PAYDAY_DOT_HIT = 'data-payday-hit';

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
  label: string;
  type: SavingsPoint['type'];
  color: string;
  radius: number;
  events: SavingsPointEvent[];
  canEditPayday: boolean;
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

export function SavingsChart({
  data,
  getPaydayEditRowsForDate,
  onApplyPaydayIncomeAmounts,
}: SavingsChartProps) {
  const maxVisibleTicks = useChartMaxTicks();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRawDate, setDialogRawDate] = useState('');
  const [dialogRows, setDialogRows] = useState<PaydayEditRow[]>([]);
  const [draftBySource, setDraftBySource] = useState<Record<string, string>>(
    {},
  );
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
  const [freezeChartTooltip, setFreezeChartTooltip] = useState(false);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    return data.map((point) => {
      const canEditPayday =
        point.label !== '…' &&
        point.type !== 'start' &&
        point.events.some((e) => e.type === 'payday');
      return {
        date: point.date,
        rawDate: point.rawDate,
        balance: point.balance,
        label: point.label,
        type: point.type,
        color: getSavingsColor(point.type, point.events),
        radius: getSavingsRadius(point.type),
        events: point.events,
        canEditPayday,
      };
    });
  }, [data]);

  const tickInterval =
    chartData.length > maxVisibleTicks
      ? Math.floor(chartData.length / maxVisibleTicks)
      : 0;

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

  const openChartActionMenu = (
    clientX: number,
    clientY: number,
    point: ChartDataPoint,
  ) => {
    setFreezeChartTooltip(false);
    setChartActionMenu({ x: clientX, y: clientY, point });
    setChartActionMenuStyle({ left: clientX + 10, top: clientY });
  };

  const closeChartActionMenu = useCallback(() => {
    setFreezeChartTooltip(true);
    setChartActionMenu(null);
    setChartActionMenuStyle(null);
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

  useEffect(() => {
    if (!chartActionMenu) return;
    const onPointerDown = (ev: PointerEvent) => {
      const t = ev.target as Node;
      if (chartActionMenuRef.current?.contains(t)) return;
      const el = ev.target;
      if (el instanceof Element && el.closest(`[${PAYDAY_DOT_HIT}]`)) {
        return;
      }
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

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartDataPoint }>;
  }) => {
    if (chartActionMenu || freezeChartTooltip) return null;
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const evs = point.events;
      const net = evs.reduce((s, e) => s + e.delta, 0);

      return (
        <div className="glass-card p-3">
          <div className="mb-2 text-muted-foreground text-xs">{point.date}</div>
          {evs.length > 0 ? (
            <div className="space-y-1">
              {evs.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-4"
                >
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
    }
    return null;
  };

  return (
    <div className="h-[280px] w-full sm:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 8, left: 4, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
          />
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
          <Tooltip
            content={<CustomTooltip />}
            isAnimationActive={false}
            active={freezeChartTooltip ? false : undefined}
          />
          <Line
            type="stepAfter"
            dataKey="balance"
            stroke={BLUE}
            strokeWidth={2}
            dot={false}
            activeDot={(dotProps: {
              cx?: number;
              cy?: number;
              payload?: ChartDataPoint;
            }) => {
              const { cx, cy, payload } = dotProps;
              if (cx == null || cy == null) return <g />;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={6}
                  fill={payload?.color ?? GRAY}
                  stroke="none"
                  style={{ pointerEvents: 'none' }}
                />
              );
            }}
            fill={`${BLUE}10`}
            fillOpacity={0.1}
            isAnimationActive={false}
          />
          {chartData.map((point, index) => {
            const isHover = hoveredIndex === index;
            const innerR = isHover ? point.radius + 2 : point.radius;
            const hitR = Math.max(innerR + 10, 14);
            return (
              <ReferenceDot
                key={index}
                x={point.date}
                y={point.balance}
                r={0}
                fill="transparent"
                stroke="none"
                shape={(props: { cx?: number; cy?: number }) => {
                  const { cx, cy } = props;
                  if (cx == null || cy == null) return <g />;
                  return (
                    // biome-ignore lint/a11y/noStaticElementInteractions: chart svg hit target
                    <g
                      style={{
                        cursor: point.canEditPayday ? 'pointer' : 'default',
                      }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() =>
                        setHoveredIndex((h) => (h === index ? null : h))
                      }
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={innerR}
                        fill={point.color}
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* biome-ignore lint/a11y/noStaticElementInteractions: chart svg hit target */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={hitR}
                        fill="transparent"
                        style={{ pointerEvents: 'all' }}
                        {...(point.canEditPayday
                          ? { [PAYDAY_DOT_HIT]: 'true' }
                          : {})}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (point.canEditPayday) {
                            openChartActionMenu(e.clientX, e.clientY, point);
                          }
                        }}
                      />
                    </g>
                  );
                }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>

      {chartActionMenu &&
        chartActionMenuStyle &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={chartActionMenuRef}
            className="fixed z-[100] min-w-[13.5rem] select-none"
            style={{
              left: chartActionMenuStyle.left,
              top: chartActionMenuStyle.top,
              transform: 'translateY(-50%)',
            }}
            role="menu"
            aria-label="Chart actions"
          >
            <div className="glass-card">
              <div className="border-border/40 border-b px-3 py-2">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                  {chartActionMenu.point.date}
                </p>
                <p className="mt-0.5 font-mono text-foreground/90 text-xs tabular-nums">
                  {chartActionMenu.point.rawDate}
                </p>
              </div>
              <div className="p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  className={cn(
                    'flex w-full cursor-pointer items-center rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                    'text-foreground/95 hover:bg-muted/80 active:bg-muted',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                  onClick={() => {
                    const p = chartActionMenu.point;
                    closeChartActionMenu();
                    openPaydayDialog(p);
                  }}
                >
                  Edit Income
                </button>
              </div>
            </div>
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
          <div className="space-y-4 py-2">
            {dialogRows.map((row) => (
              <div key={row.sourceId} className="space-y-2">
                <Label className="text-muted-foreground text-xs">
                  {row.name}{' '}
                  <span className="font-normal">
                    (scheduled ${row.scheduledAmount})
                  </span>
                </Label>
                <div
                  className={cn(
                    'flex h-11 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-3.5 shadow-xs',
                    'transition-[color,box-shadow,border-color] selection:bg-primary selection:text-primary-foreground',
                    'focus-within:border-ring hover:border-ring/50 md:h-9 md:px-3',
                    'dark:bg-input/30',
                  )}
                >
                  <span
                    className="shrink-0 text-muted-foreground text-sm tabular-nums"
                    aria-hidden
                  >
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="min-h-0 min-w-0 flex-1 border-0 bg-transparent py-2.5 font-mono text-base outline-none md:py-1 md:text-sm"
                    value={draftBySource[row.sourceId] ?? ''}
                    onChange={(e) =>
                      setDraftBySource((prev) => ({
                        ...prev,
                        [row.sourceId]: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="muted" onClick={handleSaveDialog}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
