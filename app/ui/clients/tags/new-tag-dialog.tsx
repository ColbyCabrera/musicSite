import { useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/ui/shadcn/components/ui/dialog';
import { Label } from '../../shadcn/components/ui/label';
import { Input } from '../../shadcn/components/ui/input';
import { Button } from '../../shadcn/components/ui/button';

export default function NewTagDialog({
  selected,
  onChange
}: {
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const [tagText, setTagText] = useState('');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Create new tag</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create new tag</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-3">
            <Label htmlFor="name">
              Name
            </Label>
            <Input
              id="createTag"
              placeholder=""
              className="col-span-3"
              onChange={(event) => {
                const value = event.target.value;
                setTagText(value);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="submit"
              onClick={() => {
                if (!selected.includes(tagText)) {
                  onChange([...selected, tagText]);
                }
              }}
            >
              Create tag
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
