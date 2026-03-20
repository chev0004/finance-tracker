import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LOCAL_ONLY_COOKIE } from '@/lib/auth-constants';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) return <>{children}</>;
  const cookieStore = await cookies();
  if (cookieStore.get(LOCAL_ONLY_COOKIE)) return <>{children}</>;
  redirect('/sign-in');
}
