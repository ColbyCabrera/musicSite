import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/ui/shadcn/components/ui/dialog';
import AddEventForm from './add-event-form';

interface AddEventDialogProps {
  open: boolean;
  setOpen: (open: Boolean) => void;
}

export default function AddEventDialog({ open, setOpen }: AddEventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-full max-h-screen max-w-full flex-col overflow-y-auto sm:h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
        </DialogHeader>
        <AddEventForm />
      </DialogContent>
    </Dialog>
  );
}
