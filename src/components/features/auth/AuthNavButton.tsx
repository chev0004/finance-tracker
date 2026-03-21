'use client';

import { LogIn, LogOut } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { BUDGET_STORAGE_KEY } from '@/lib/budget-constants';
import { cn } from '@/lib/utils';

type AuthNavButtonProps = {
  className?: string;
  onMenuAction?: () => void;
} & Pick<ComponentProps<typeof Button>, 'variant' | 'size'>;

export function AuthNavButton({
  className,
  onMenuAction,
  variant = 'ghost',
  size = 'sm',
}: AuthNavButtonProps) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;
  if (session) {
    return (
      <Button
        variant={variant}
        size={size}
        className={cn('gap-1.5 text-muted-foreground text-xs', className)}
        onClick={() => {
          onMenuAction?.();
          authClient.signOut({
            fetchOptions: {
              onSuccess: () => {
                localStorage.removeItem(BUDGET_STORAGE_KEY);
                window.location.href = '/sign-in';
              },
            },
          });
        }}
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      size={size}
      className={cn('gap-1.5 text-muted-foreground text-xs', className)}
      asChild
    >
      <Link href="/sign-in" onClick={() => onMenuAction?.()}>
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </Link>
    </Button>
  );
}
