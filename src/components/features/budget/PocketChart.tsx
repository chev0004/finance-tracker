'use client';

import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeNumInputBlur, normalizeNumInputLeading } from '@/lib/utils';
import type { PocketExpenseItem, PocketPoint } from '@/types';

interface PocketChartProps {
  data: PocketPoint[];
  onUpdateSpent: (
    weekIdx: number,
    amount: number,
  ) => { success: boolean; error?: string };
}

const GREEN = '#10b981';
const RED = '#ef4444';
const ORANGE = '#f59e0b';
const GRAY = '#6b7280';
const BLUE = '#3b82f6';

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

export function PocketChart({ data, onUpdateSpent }: PocketChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const chartData = useMemo<ChartDataPoint[]>(() => {
    return data.map((point) => ({
      date: point.date,
      rawDate: point.rawDate,
      balance: point.balance,
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
    }));
  }, [data, selectedIdx]);

  const tickInterval =
    chartData.length > 80 ? Math.floor(chartData.length / 80) : 0;

  const selectedPoint = selectedIdx !== null ? data[selectedIdx] : null;

  const handleDotClick = (idx: number) => {
    setErrorMsg(null);
    const point = data[idx];

    if (point && point.expenseCount > 0) {
      setErrorMsg(
        `Expenses are logged for ${point.date}. Edit through the expense log.`,
      );
      setSelectedIdx(null);
      setInputValue('');
      return;
    }

    if (selectedIdx === idx) {
      setSelectedIdx(null);
      setInputValue('');
    } else {
      setSelectedIdx(idx);
      setInputValue(data[idx]?.spent?.toString() || '0');
    }
  };

  const handleSave = () => {
    if (selectedIdx === null) return;
    const amount = Number.parseInt(inputValue, 10) || 0;
    const result = onUpdateSpent(selectedIdx, amount);
    if (result.success) {
      setSelectedIdx(null);
      setInputValue('');
      setErrorMsg(null);
    } else {
      setErrorMsg(result.error || 'Failed to update');
    }
  };

  const handleCancel = () => {
    setSelectedIdx(null);
    setInputValue('');
    setErrorMsg(null);
  };

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
          <div className="mb-2 text-muted-foreground text-xs">{point.date}</div>
          {point.expenseItems.length > 0 ? (
            <div className="mb-1 space-y-0.5">
              {point.expenseItems.map((item, i) => (
                <div key={i} className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-mono text-foreground text-sm">
                    -${item.amount}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            point.spent > 0 && (
              <div className="mb-1 flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Spent</span>
                <span className="font-mono text-foreground">
                  -${point.spent}
                </span>
              </div>
            )
          )}
          {point.balance > 0 && (
            <div className="mt-1 font-mono text-green-400 text-sm">
              ${point.balance} unspent
            </div>
          )}
          {point.overage > 0 && (
            <div className="mt-1 font-mono text-red-400 text-sm">
              ${point.overage} over budget
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="h-[200px] w-full sm:h-[240px]">
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
                r={point.isSelected ? 8 : point.expenseCount > 0 ? 6 : 5}
                fill={point.color}
                stroke="none"
                onClick={() => handleDotClick(point.idx)}
                className="cursor-pointer"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {selectedPoint && (
        <Card className="border-border/50 bg-muted/50 p-4 transition-colors">
          <div className="mb-2 text-muted-foreground text-xs">
            Week: {selectedPoint.date}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 text-sm">
              <span className="text-muted-foreground">Available:</span>{' '}
              <span className="font-medium">${selectedPoint.available}</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span className="text-muted-foreground">Unspent:</span>{' '}
              <span className="font-medium">
                $
                {Math.max(
                  0,
                  selectedPoint.available -
                    (Number.parseInt(inputValue, 10) || 0),
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="pocket-spent"
                className="whitespace-nowrap text-muted-foreground text-xs"
              >
                Spent:
              </Label>
              <div className="relative">
                <Input
                  id="pocket-spent"
                  type="number"
                  min={0}
                  max={selectedPoint.available}
                  value={inputValue === '' ? '0' : inputValue}
                  onChange={(e) =>
                    setInputValue(normalizeNumInputLeading(e.target.value))
                  }
                  onBlur={() =>
                    setInputValue(normalizeNumInputBlur(inputValue))
                  }
                  className="w-24 pr-7 text-center font-mono"
                />
                <div className="absolute inset-y-0 right-0 flex w-7 flex-col border-input border-l">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() =>
                      setInputValue(
                        String(
                          Math.min(
                            (Number.parseInt(inputValue, 10) || 0) + 1,
                            selectedPoint.available,
                          ),
                        ),
                      )
                    }
                    className="flex flex-1 cursor-pointer items-center justify-center rounded-tr-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ChevronUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() =>
                      setInputValue(
                        String(
                          Math.max(
                            (Number.parseInt(inputValue, 10) || 0) - 1,
                            0,
                          ),
                        ),
                      )
                    }
                    className="flex flex-1 cursor-pointer items-center justify-center rounded-br-md border-input border-t text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ChevronDown className="size-3" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} variant="muted">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
          <div className="mt-2 text-muted-foreground text-xs">
            Enter how much you actually spent this week. Leave 0 to save
            everything.
          </div>
        </Card>
      )}
    </div>
  );
}
