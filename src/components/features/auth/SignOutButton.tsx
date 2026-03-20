'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground text-xs"
      onClick={() =>
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
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
