'use client';

import { BudgetDataActions } from '@/components/features/budget/BudgetDataActions';
import type { BudgetState } from '@/types';

interface ExportMenuProps {
  state: BudgetState;
  onImport: (state: BudgetState) => void;
}

export function ExportMenu({ state, onImport }: ExportMenuProps) {
  return <BudgetDataActions state={state} onImport={onImport} />;
}
