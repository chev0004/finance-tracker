import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface NavStepperProps {
  children: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  disablePrev?: boolean;
  disableNext?: boolean;
}

export function NavStepper({
  children,
  onPrev,
  onNext,
  disablePrev,
  disableNext,
}: NavStepperProps) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="size-10 text-muted-foreground hover:text-foreground sm:size-8"
        disabled={disablePrev}
        onClick={onPrev}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {children}
      <Button
        variant="ghost"
        size="icon"
        className="size-10 text-muted-foreground hover:text-foreground sm:size-8"
        disabled={disableNext}
        onClick={onNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
