import { createAuthClient } from 'better-auth/react';
import { LOCAL_ONLY_COOKIE } from '@/lib/auth-constants';

export { LOCAL_ONLY_COOKIE };

export async function setLocalOnlyPreference(): Promise<void> {
  await fetch('/api/skip-auth', { method: 'POST' });
}

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
});
