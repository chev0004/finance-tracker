'use client';

import { Check, ClipboardPaste, Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  buildBudgetXlsx,
  type ExportOptions,
  type ExportPayload,
  getExportDateBounds,
  getExportYears,
} from '@/lib/exportBudget';
import { cn } from '@/lib/utils';
import type { BudgetState } from '@/types';

type BudgetDataActionsProps = {
  state: BudgetState;
  analysisPayload?: ExportPayload;
  onImport: (state: BudgetState) => void;
  orientation?: 'row' | 'column';
  onImportDialogOpen?: () => void;
  buttonClassName?: string;
};

type ExportScope = 'all' | 'years' | 'months';

export function BudgetDataActions({
  state,
  analysisPayload,
  onImport,
  orientation = 'row',
  onImportDialogOpen,
  buttonClassName,
}: BudgetDataActionsProps) {
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [pasteValue, setPasteValue] = useState('');
  const [importError, setImportError] = useState('');

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(state, null, 2)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {},
    );
  }

  function handleImport() {
    setImportError('');
    try {
      const parsed = JSON.parse(pasteValue);
      if (!parsed.settings || !Array.isArray(parsed.expenses)) {
        setImportError('Invalid budget data: missing settings or expenses');
        return;
      }
      onImport(parsed as BudgetState);
      setImportOpen(false);
      setPasteValue('');
    } catch {
      setImportError('Invalid JSON');
    }
  }

  const exportYears = analysisPayload ? getExportYears(analysisPayload) : [];
  const exportBounds = analysisPayload
    ? getExportDateBounds(analysisPayload)
    : null;
  const minMonth = exportBounds?.startDate.slice(0, 7) ?? '';
  const maxMonth = exportBounds?.endDate.slice(0, 7) ?? '';
  const monthRangeInvalid =
    exportScope === 'months' &&
    (!startMonth || !endMonth || startMonth > endMonth);
  const exportDisabled =
    exporting ||
    (exportScope === 'years' && selectedYears.length === 0) ||
    monthRangeInvalid;

  function openExport() {
    if (!analysisPayload) return;
    const currentYear = Number(analysisPayload.today.slice(0, 4));
    const defaultYear = exportYears.includes(currentYear)
      ? currentYear
      : exportYears[0];
    const currentMonth = analysisPayload.today.slice(0, 7);
    const defaultMonth =
      currentMonth < minMonth
        ? minMonth
        : currentMonth > maxMonth
          ? maxMonth
          : currentMonth;

    setExportScope('all');
    setSelectedYears(defaultYear ? [defaultYear] : []);
    setStartMonth(defaultMonth);
    setEndMonth(defaultMonth);
    setExportOpen(true);
  }

  function getExportOptions(): ExportOptions | undefined {
    if (exportScope === 'years') {
      return {
        dateRanges: selectedYears
          .toSorted((a, b) => a - b)
          .map((year) => ({
            startDate: `${year}-01-01`,
            endDate: `${year}-12-31`,
          })),
      };
    }
    if (exportScope === 'months') {
      return {
        dateRanges: [
          {
            startDate: `${startMonth}-01`,
            endDate: `${endMonth}-31`,
          },
        ],
      };
    }
    return undefined;
  }

  function getExportFilename(): string {
    if (!analysisPayload) return 'budget.xlsx';
    if (exportScope === 'years') {
      return `budget-${selectedYears.toSorted((a, b) => a - b).join('-')}.xlsx`;
    }
    if (exportScope === 'months') {
      const range =
        startMonth === endMonth ? startMonth : `${startMonth}-to-${endMonth}`;
      return `budget-${range}.xlsx`;
    }
    return `budget-all-${analysisPayload.today}.xlsx`;
  }

  async function handleExportSpreadsheet() {
    if (!analysisPayload) return;
    setExporting(true);
    const buffer = await buildBudgetXlsx(analysisPayload, getExportOptions());
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExporting(false);
    setExportOpen(false);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }

  const openImport = () => {
    onImportDialogOpen?.();
    setImportOpen(true);
    setImportError('');
    setPasteValue('');
  };

  return (
    <>
      <div
        className={cn(
          orientation === 'row' &&
            'flex min-w-0 flex-wrap items-center gap-1.5',
          orientation === 'column' && 'flex w-full flex-col gap-2',
        )}
      >
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-1.5 text-muted-foreground text-xs',
            orientation === 'column' && 'h-11 w-full justify-start',
            buttonClassName,
          )}
          onClick={openExport}
          disabled={!analysisPayload}
        >
          {exported ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {exported ? 'Downloaded' : 'Export XLSX'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-1.5 text-muted-foreground text-xs',
            orientation === 'column' && 'h-11 w-full justify-start',
            buttonClassName,
          )}
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? 'Copied' : 'Copy JSON'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-1.5 text-muted-foreground text-xs',
            orientation === 'column' && 'h-11 w-full justify-start',
            buttonClassName,
          )}
          onClick={openImport}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          Import
        </Button>
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Export spreadsheet</DialogTitle>
            <DialogDescription>
              Choose which dates to include. Goal details are included in the
              ledger and on their own worksheet.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['all', 'All years'],
                ['years', 'Year(s)'],
                ['months', 'Months'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={exportScope === value ? 'secondary' : 'outline'}
                onClick={() => setExportScope(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          {exportScope === 'all' && (
            <p className="rounded-md border border-border bg-muted/30 p-3 text-muted-foreground text-sm">
              {`Includes ${exportBounds?.startDate} through ${exportBounds?.endDate}.`}
            </p>
          )}

          {exportScope === 'years' && (
            <fieldset className="space-y-3 rounded-md border border-border p-3">
              <legend className="px-1 font-medium text-sm">Select years</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {exportYears.map((year) => {
                  const id = `export-year-${year}`;
                  return (
                    <div key={year} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={selectedYears.includes(year)}
                        onCheckedChange={(checked) => {
                          setSelectedYears((current) =>
                            checked
                              ? [...current, year]
                              : current.filter((item) => item !== year),
                          );
                        }}
                      />
                      <Label htmlFor={id}>{year}</Label>
                    </div>
                  );
                })}
              </div>
              {selectedYears.length === 0 && (
                <p className="text-destructive text-xs">
                  Select at least one year.
                </p>
              )}
            </fieldset>
          )}

          {exportScope === 'months' && (
            <div className="grid gap-4 rounded-md border border-border p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="export-start-month">From month</Label>
                <Input
                  id="export-start-month"
                  type="month"
                  min={minMonth}
                  max={maxMonth}
                  value={startMonth}
                  onChange={(event) => setStartMonth(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="export-end-month">Through month</Label>
                <Input
                  id="export-end-month"
                  type="month"
                  min={minMonth}
                  max={maxMonth}
                  value={endMonth}
                  onChange={(event) => setEndMonth(event.target.value)}
                />
              </div>
              {monthRangeInvalid && (
                <p className="text-destructive text-xs sm:col-span-2">
                  Choose a valid month range.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExportOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={exportDisabled}
              onClick={handleExportSpreadsheet}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? 'Exporting...' : 'Download XLSX'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import budget data</DialogTitle>
            <DialogDescription>
              Paste previously copied JSON data to restore your budget.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="h-48 w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-base text-foreground outline-none placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 md:text-xs"
            placeholder="Paste JSON here..."
            value={pasteValue}
            onChange={(e) => {
              setPasteValue(e.target.value);
              setImportError('');
            }}
          />
          {importError && (
            <p className="text-destructive text-xs">{importError}</p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setImportOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="text-xs"
              disabled={!pasteValue.trim()}
              onClick={handleImport}
            >
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
