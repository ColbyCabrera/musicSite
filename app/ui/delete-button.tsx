'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './shadcn/lib/utils';
import { Button } from '@/app/ui/shadcn/components/ui/button';

export default function DeleteButton({
  entity,
  deleteFunction,
  displayString,
  className,
}: {
  entity: string;
  deleteFunction(): Promise<void>;
  displayString?: string;
  className?: string;
}) {
  const [deleting, setDeleting] = useState(false);

  async function clicked() {
    setDeleting(true);
    try {
      await deleteFunction();
    } catch (error) {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="destructive"
      type="button"
      className={cn(
        'min-w-fit max-w-fit flex-1 border-red-400 focus-visible:ring-transparent',
        className,
      )}
      onClick={clicked}
      disabled={deleting}
    >
      {deleting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Deleting...
        </>
      ) : displayString ? (
        displayString
      ) : (
        `Delete ${entity}`
      )}
    </Button>
  );
}
