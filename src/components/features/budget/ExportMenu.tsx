'use client';

import { BudgetDataActions } from '@/components/features/budget/BudgetDataActions';
import type { ExportPayload } from '@/lib/exportBudget';
import type { BudgetState } from '@/types';

interface ExportMenuProps {
  state: BudgetState;
  analysisPayload: ExportPayload;
  onImport: (state: BudgetState) => void;
}

export function ExportMenu({
  state,
  analysisPayload,
  onImport,
}: ExportMenuProps) {
  return (
    <BudgetDataActions
      state={state}
      analysisPayload={analysisPayload}
      onImport={onImport}
    />
  );
}
