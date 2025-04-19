import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/app/ui/shadcn/components/ui/button';

export function SubmitButton(props: any) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className={props?.className} disabled={pending || props?.disabled}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Submitting...
        </>
      ) : (
        <>Submit</>
      )}
    </Button>
  );
}
