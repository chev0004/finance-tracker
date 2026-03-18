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
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        disabled={disablePrev}
        onClick={onPrev}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {children}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        disabled={disableNext}
        onClick={onNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
