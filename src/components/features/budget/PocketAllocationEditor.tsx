'use client';

import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeNumInputBlur, normalizeNumInputLeading } from '@/lib/utils';
import type { PocketPoint } from '@/types';

interface PocketAllocationEditorProps {
  point: PocketPoint;
  onApply: (
    date: string,
    amount: number,
  ) => { success: boolean; error?: string };
  onReset: (date: string) => void;
}

function fmtAmount(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PocketAllocationEditor({
  point,
  onApply,
  onReset,
}: PocketAllocationEditorProps) {
  const [value, setValue] = useState(String(point.pocketAllocated));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setValue(String(point.pocketAllocated));
    setErrorMsg(null);
  }, [point.pocketAllocated]);

  const hasOverride =
    Math.abs(point.pocketAllocated - point.scheduledPocket) > 0.005;

  const handleSave = () => {
    const amount = Math.max(0, Number.parseFloat(value) || 0);
    const result = onApply(point.rawDate, amount);
    if (result.success) {
      setErrorMsg(null);
    } else {
      setErrorMsg(result.error || 'Could not update pocket allocation');
    }
  };

  const handleReset = () => {
    onReset(point.rawDate);
    setValue(String(point.scheduledPocket));
    setErrorMsg(null);
  };

  return (
    <div className="space-y-2">
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-500 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {errorMsg}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          <span className="text-muted-foreground">Pocket for </span>
          <span className="font-medium">{point.date}</span>
          {hasOverride && (
            <span className="ml-2 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wider">
              scheduled ${fmtAmount(point.scheduledPocket)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label
            htmlFor="pocket-allocated"
            className="whitespace-nowrap text-muted-foreground text-xs"
          >
            Amount:
          </Label>
          <Input
            id="pocket-allocated"
            type="number"
            min={0}
            value={value === '' ? '0' : value}
            onChange={(e) => setValue(normalizeNumInputLeading(e.target.value))}
            onBlur={() => setValue(normalizeNumInputBlur(value))}
            className="w-24 text-center font-mono"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} variant="muted">
            Save
          </Button>
          {hasOverride && (
            <Button size="sm" variant="ghost" onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
