import { FunnelIcon } from '@heroicons/react/24/outline';
import { Button } from './shadcn/components/ui/button';
import React, { forwardRef } from 'react';
import { cn } from './shadcn/lib/utils';

interface FilterButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  filteredCount: number;
}

export const FilterButton = forwardRef<HTMLButtonElement, FilterButtonProps>(
  ({ filteredCount, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="outline"
        className={cn('w-32 justify-start', className)}
        {...props}
      >
        <FunnelIcon className="mr-1 h-5 w-5" />
        Filter
        <span
          className={`ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
            filteredCount > 0
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground bg-slate-100'
          }`}
        >
          {filteredCount}
        </span>
      </Button>
    );
  },
);

FilterButton.displayName = 'FilterButton';
