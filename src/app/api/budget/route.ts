import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { budget } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { BudgetState } from '@/types';

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(budget)
    .where(eq(budget.userId, session.user.id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return NextResponse.json(null);
  }
  const data = JSON.parse(row.data) as BudgetState;
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await request.json()) as BudgetState;
  const data = JSON.stringify(body);
  await db
    .insert(budget)
    .values({
      userId: session.user.id,
      data,
    })
    .onConflictDoUpdate({
      target: budget.userId,
      set: { data, updatedAt: new Date() },
    });
  return NextResponse.json({ ok: true });
}
