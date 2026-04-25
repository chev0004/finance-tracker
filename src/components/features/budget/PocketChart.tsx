'use client';

import { format, isValid, parseISO } from 'date-fns';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  cn,
  normalizeNumInputBlur,
  normalizeNumInputLeading,
} from '@/lib/utils';
import type { PocketExpenseItem, PocketPoint } from '@/types';

interface PocketChartProps {
  data: PocketPoint[];
  onUpdateSpent: (
    weekIdx: number,
    amount: number,
  ) => { success: boolean; error?: string };
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

type SkipDialogTarget = {
  recurringExpenseId: string;
  occurrenceDate: string;
  label: string;
  amount: number;
};

export function PocketChart({
  data,
  onUpdateSpent,
  onSkipRecurringInstance,
}: PocketChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [skipTarget, setSkipTarget] = useState<SkipDialogTarget | null>(null);
  const [skipNote, setSkipNote] = useState('');

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
      setInputValue('');
    } else {
      setSelectedIdx(idx);
      setInputValue(point.spent?.toString() || '0');
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

  const openSkipDialog = (item: PocketExpenseItem) => {
    if (!item.recurringExpenseId || !item.date) return;
    setSkipNote('');
    setSkipTarget({
      recurringExpenseId: item.recurringExpenseId,
      occurrenceDate: item.date,
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
    }
    return null;
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
                    {fmtOccurrence(skipTarget.occurrenceDate)}
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

      <div className="h-[200px] w-full sm:h-[240px]">
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
            <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
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
              const baseR = point.isSelected
                ? 8
                : point.expenseCount > 0
                  ? 6
                  : 5;
              const innerR =
                hoveredIdx === point.idx && !point.isSelected
                  ? baseR + 2
                  : baseR;
              const hitR = Math.max(innerR + 10, 14);
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
                    return (
                      // biome-ignore lint/a11y/noStaticElementInteractions: chart svg hit target
                      <g
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(point.idx)}
                        onMouseLeave={() =>
                          setHoveredIdx((h) => (h === point.idx ? null : h))
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDotClick(point.idx);
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
      </div>

      {selectedPoint && (
        <Card className="glass-card p-4 transition-colors">
          <div className="mb-2 text-muted-foreground text-xs">
            Week: {selectedPoint.date}
          </div>

          {skippableRecurring.length > 0 && (
            <div className="mb-4 space-y-2 border-border/50 border-b pb-4">
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
          )}

          {selectedPoint.expenseCount === 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1 text-sm">
                <span className="text-muted-foreground">Available:</span>{' '}
                <span className="font-medium">
                  ${fmtAmount(selectedPoint.available)}
                </span>
                <span className="mx-2 text-muted-foreground">|</span>
                <span className="text-muted-foreground">Unspent:</span>{' '}
                <span className="font-medium">
                  $
                  {fmtAmount(
                    Math.max(
                      0,
                      selectedPoint.available -
                        (Number.parseFloat(inputValue) || 0),
                    ),
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
          ) : (
            <p className="text-muted-foreground text-xs">
              This period uses logged expenses for spending. You can still skip
              a recurring pocket charge above.
            </p>
          )}

          {selectedPoint.expenseCount === 0 ? (
            <div className="mt-2 text-muted-foreground text-xs">
              Enter how much you actually spent this week. Leave 0 to save
              everything.
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
