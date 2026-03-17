'use client';

import { Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { buildExportText, type ExportPayload } from '@/lib/exportBudget';

interface ExportMenuProps {
  payload: ExportPayload;
}

export function ExportMenu({ payload }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy to clipboard');

  const text = buildExportText(payload);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopyLabel('Copied');
        setTimeout(() => setCopyLabel('Copy to clipboard'), 2000);
      },
      () => setCopyLabel('Copy failed'),
    );
  }

  function handleDownload() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-snapshot-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground text-xs"
        >
          Export
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 text-xs"
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" />
            Download .txt
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 text-xs"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
            {copyLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
