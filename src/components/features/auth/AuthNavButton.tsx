'use client';

import { LogIn, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { BUDGET_STORAGE_KEY } from '@/lib/budget-constants';

export function AuthNavButton() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;
  if (session) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground text-xs"
        onClick={() =>
          authClient.signOut({
            fetchOptions: {
              onSuccess: () => {
                localStorage.removeItem(BUDGET_STORAGE_KEY);
                window.location.href = '/sign-in';
              },
            },
          })
        }
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground text-xs"
      asChild
    >
      <Link href="/sign-in">
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </Link>
    </Button>
  );
}
