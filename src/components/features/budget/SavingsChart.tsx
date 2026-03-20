'use client';

import { useMemo } from 'react';
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
import type { SavingsPoint, SavingsPointEvent } from '@/types';

interface SavingsChartProps {
  data: SavingsPoint[];
}

const GREEN = '#10b981';
const RED = '#ef4444';
const ORANGE = '#f59e0b';
const GRAY = '#6b7280';
const BLUE = '#3b82f6';

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

const MAX_VISIBLE_TICKS = 70;

export function SavingsChart({ data }: SavingsChartProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return data.map((point) => ({
      date: point.date,
      rawDate: point.rawDate,
      balance: point.balance,
      label: point.label,
      type: point.type,
      color: getSavingsColor(point.type, point.events),
      radius: getSavingsRadius(point.type),
      events: point.events,
    }));
  }, [data]);

  const tickInterval =
    chartData.length > MAX_VISIBLE_TICKS
      ? Math.floor(chartData.length / MAX_VISIBLE_TICKS)
      : 0;

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartDataPoint }>;
  }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const evs = point.events;
      const net = evs.reduce((s, e) => s + e.delta, 0);

      return (
        <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
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
          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
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
            tick={{
              fill: '#6b7280',
              fontSize: 9,
              fontFamily: 'var(--font-space-mono)',
            }}
            axisLine={{ stroke: 'transparent' }}
            tickLine={false}
            tickCount={10}
            tickMargin={0}
            minTickGap={0}
            tickFormatter={(value) =>
              value < 0
                ? `-$${Math.abs(value).toLocaleString()}`
                : `$${value.toLocaleString()}`
            }
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="stepAfter"
            dataKey="balance"
            stroke={BLUE}
            strokeWidth={2}
            dot={false}
            fill={`${BLUE}10`}
            fillOpacity={0.1}
            isAnimationActive={false}
          />
          {chartData.map((point, index) => (
            <ReferenceDot
              key={index}
              x={point.date}
              y={point.balance}
              r={point.radius}
              fill={point.color}
              stroke="none"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
