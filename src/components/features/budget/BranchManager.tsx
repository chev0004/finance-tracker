'use client';

import { GitBranch, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { BudgetBranch } from '@/types';

type BranchManagerProps = {
  branches: BudgetBranch[];
  activeBranchId: string;
  onSwitchBranch: (id: string) => void;
  onCreateBranch: (name: string) => void;
  onRenameBranch: (id: string, name: string) => void;
  onDeleteBranch: (id: string) => void;
};

export function BranchManager({
  branches,
  activeBranchId,
  onSwitchBranch,
  onCreateBranch,
  onRenameBranch,
  onDeleteBranch,
}: BranchManagerProps) {
  const activeBranch = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId),
    [activeBranchId, branches],
  );
  const [dialogMode, setDialogMode] = useState<'create' | 'rename' | null>(
    null,
  );
  const [name, setName] = useState('');
  const [navigationMode, setNavigationMode] = useState<'keyboard' | 'pointer'>(
    'pointer',
  );

  useEffect(() => {
    if (dialogMode === 'rename') setName(activeBranch?.name ?? '');
    if (dialogMode === 'create') setName('');
  }, [activeBranch?.name, dialogMode]);

  useEffect(() => {
    const handlePointerInput = () => setNavigationMode('pointer');
    const handleKeyboardInput = () => setNavigationMode('keyboard');

    window.addEventListener('pointerdown', handlePointerInput, true);
    window.addEventListener('keydown', handleKeyboardInput, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerInput, true);
      window.removeEventListener('keydown', handleKeyboardInput, true);
    };
  }, []);

  const closeDialog = () => {
    setDialogMode(null);
    setName('');
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (dialogMode === 'create') onCreateBranch(trimmed);
    if (dialogMode === 'rename' && activeBranch) {
      onRenameBranch(activeBranch.id, trimmed);
    }
    closeDialog();
  };

  if (branches.length === 0 || !activeBranch) return null;

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Select value={activeBranchId} onValueChange={onSwitchBranch}>
          <SelectTrigger
            size="sm"
            className="branch-select-trigger h-9 min-h-9 max-w-[13rem] border-border/60 bg-card/40 focus-visible:border-border/60 focus-visible:ring-0 data-[state=open]:border-border/60"
            data-navigation-mode={navigationMode}
            aria-label="Projection branch"
            onPointerDown={() => setNavigationMode('pointer')}
            onKeyDown={(event) => {
              if (
                event.key === 'ArrowDown' ||
                event.key === 'ArrowUp' ||
                event.key === 'Enter' ||
                event.key === ' '
              ) {
                setNavigationMode('keyboard');
              }
            }}
          >
            <GitBranch className="size-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="end"
            className="branch-select-content"
            data-navigation-mode={navigationMode}
            position="popper"
            side="bottom"
            sideOffset={6}
            onPointerMove={() => setNavigationMode('pointer')}
            onKeyDown={() => setNavigationMode('keyboard')}
          >
            {branches.map((branch) => (
              <SelectItem
                key={branch.id}
                value={branch.id}
                className={cn(
                  'outline-none ring-0 focus-visible:outline-none focus-visible:ring-0',
                  navigationMode === 'keyboard'
                    ? 'focus:bg-accent/40 focus:text-foreground data-[highlighted]:bg-accent/40 data-[highlighted]:text-foreground'
                    : 'focus:bg-transparent focus:text-foreground data-[highlighted]:bg-transparent data-[highlighted]:text-foreground',
                )}
                style={{ outline: 'none', boxShadow: 'none' }}
              >
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Create branch"
          onClick={() => setDialogMode('create')}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Rename branch"
          onClick={() => setDialogMode('rename')}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete branch"
          disabled={branches.length <= 1}
          onClick={() => {
            if (window.confirm(`Delete "${activeBranch.name}"?`)) {
              onDeleteBranch(activeBranch.id);
            }
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'New Branch' : 'Rename Branch'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="branch-name">Name</Label>
            <Input
              id="branch-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSubmit();
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!name.trim()}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
