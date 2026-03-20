import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/features/auth/AuthForm';
import { auth } from '@/lib/auth';

export default async function SignUpPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) redirect('/');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <AuthForm mode="sign-up" />
    </div>
  );
}
