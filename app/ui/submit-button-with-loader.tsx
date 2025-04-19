import { Loader2 } from 'lucide-react';
import { Button } from './shadcn/components/ui/button';

interface SubmitButtonWithLoaderProps {
  loading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  onClick?: (event?: any) => void;
  disabled?: boolean;
}

export default function SubmitButtonWithLoader({
  loading,
  children,
  loadingText,
  onClick,
  disabled,
}: SubmitButtonWithLoaderProps) {
  return (
    <Button type="submit" disabled={loading || disabled} onClick={onClick}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText ? loadingText : 'Editing...'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
