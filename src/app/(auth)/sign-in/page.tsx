import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/features/auth/AuthForm';
import { auth } from '@/lib/auth';

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const requestedCallback = (await searchParams).callbackUrl;
  const callbackUrl =
    requestedCallback?.startsWith('/') && !requestedCallback.startsWith('//')
      ? requestedCallback
      : '/';
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) redirect(callbackUrl);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <AuthForm mode="sign-in" callbackUrl={callbackUrl} />
    </div>
  );
}
