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
import type { SavingsPoint } from '@/types';

interface SavingsChartProps {
  data: SavingsPoint[];
}

const GREEN = '#10b981';
const RED = '#ef4444';
const ORANGE = '#f59e0b';
const GRAY = '#6b7280';
const BLUE = '#3b82f6';

function getSavingsColor(type: SavingsPoint['type']): string {
  if (type === 'payday') return GREEN;
  if (type === 'payday-recurring') return ORANGE;
  if (type === 'start') return GRAY;
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
}

export function SavingsChart({ data }: SavingsChartProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return data.map((point) => ({
      date: point.date,
      rawDate: point.rawDate,
      balance: point.balance,
      label: point.label,
      type: point.type,
      color: getSavingsColor(point.type),
      radius: getSavingsRadius(point.type),
    }));
  }, [data]);

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartDataPoint }>;
  }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
          <div className="mb-1 text-muted-foreground text-xs">{point.date}</div>
          <div className="font-medium text-sm">{point.label}</div>
          <div
            className="mt-1 font-mono text-sm"
            style={{ color: point.color }}
          >
            ${point.balance.toLocaleString()}
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
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis
            tick={{
              fill: '#6b7280',
              fontSize: 10,
              fontFamily: 'var(--font-space-mono)',
            }}
            axisLine={{ stroke: 'transparent' }}
            tickLine={false}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
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
