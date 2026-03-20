import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/features/auth/AuthForm';
import { auth } from '@/lib/auth';
import { LOCAL_ONLY_COOKIE } from '@/lib/auth-constants';

export default async function SignUpPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) redirect('/');
  const cookieStore = await cookies();
  if (cookieStore.get(LOCAL_ONLY_COOKIE)) redirect('/');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <AuthForm mode="sign-up" />
    </div>
  );
}
