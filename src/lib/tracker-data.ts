import { eq } from 'drizzle-orm';
import { budget } from '@/db/schema';
import { db } from '@/lib/db';
import type { BudgetState, BudgetWorkspace } from '@/types';

export class TrackerDataError extends Error {}

export async function readTrackerData(
  userId: string,
): Promise<BudgetState | BudgetWorkspace> {
  const rows = await db
    .select({ data: budget.data })
    .from(budget)
    .where(eq(budget.userId, userId))
    .limit(1);
  if (!rows[0]) throw new TrackerDataError('No cloud tracker data found');
  return JSON.parse(rows[0].data) as BudgetState | BudgetWorkspace;
}
