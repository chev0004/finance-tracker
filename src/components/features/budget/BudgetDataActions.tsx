'use client';

import { Check, ClipboardPaste, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { BudgetState } from '@/types';

type BudgetDataActionsProps = {
  state: BudgetState;
  onImport: (state: BudgetState) => void;
  orientation?: 'row' | 'column';
  onImportDialogOpen?: () => void;
  buttonClassName?: string;
};

export function BudgetDataActions({
  state,
  onImport,
  orientation = 'row',
  onImportDialogOpen,
  buttonClassName,
}: BudgetDataActionsProps) {
  const [copied, setCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
