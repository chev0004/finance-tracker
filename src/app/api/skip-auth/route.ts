import { NextResponse } from 'next/server';
import { LOCAL_ONLY_COOKIE } from '@/lib/auth-constants';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCAL_ONLY_COOKIE, '1', {
    path: '/',
    maxAge: 31536000,
  });
  return response;
}
