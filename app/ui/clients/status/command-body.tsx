import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '../../shadcn/components/ui/drawer';
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '../../shadcn/components/ui/command';
import { useState } from 'react';
import { cn } from '../../shadcn/lib/utils';
import EditNoteForm from './edit-note-form';
import { StatusColor } from './status-display';
import { camelToRegularText } from '@/app/lib/utils';
import { updateClientStatus } from '@/app/lib/actions';
import { ScrollArea } from '../../shadcn/components/ui/scroll-area';
import { useClientStatusContext } from '@/app/contexts/ClientStatusContext';

export default function CommandBody({
  onChange,
}: {
  onChange: (statusColor: StatusColor) => void;
}) {
  let contractStatuses = [
    'contracted',
    'notContracted',
    'pending',
    'notApplicable',
  ];
  let billingStatuses = ['active', 'creditCardOnly', 'pastDue'];

  const clientStatus = useClientStatusContext();
  const showActions = clientStatus.status != 'setStatus';
  const statusListItems =
    clientStatus.type === 'contract' ? contractStatuses : billingStatuses;

  return (
    <CommandList className="max-h-none">
      <ScrollArea className="h-fit">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Set statuses">
          {statusListItems.map((status) => (
            <CommandItem
              key={status}
              value={status}
              onSelect={async (currentValue) => {
                onChange(currentValue as StatusColor);
                await updateClientStatus(
                  clientStatus.client_id,
                  currentValue,
                  clientStatus.type,
                  clientStatus.note,
                );
              }}
            >
              {camelToRegularText(status)}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup
          heading="Actions"
          className={cn('hidden', { block: showActions })}
        >
          <DrawerCommandItems />
        </CommandGroup>
      </ScrollArea>
    </CommandList>
  );
}

function DrawerCommandItems() {
  const clientStatus = useClientStatusContext();
  const [open, setOpen] = useState(false);
  return (
    <>
      <CommandItem>
        <Drawer>
          <DrawerTrigger className="w-full text-left">View note</DrawerTrigger>
          <DrawerContent className="hide-handle px-4 py-4">
            <DrawerTitle className="mb-1 text-xl font-semibold">
              View note
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              View the status note
            </DrawerDescription>
            {clientStatus.note ? (
              clientStatus.note
            ) : (
              <p className="text-muted-foreground">No note created</p>
            )}
          </DrawerContent>
        </Drawer>
      </CommandItem>
      <CommandItem>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger className="w-full text-left">Edit note</DrawerTrigger>
          <DrawerContent
            className="hide-handle px-4 py-4"
            aria-describedby="undefined"
          >
            <DrawerTitle className="mb-1 text-xl font-semibold">
              Edit note
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              Edit the status note
            </DrawerDescription>
            <EditNoteForm onFormSubmit={() => setOpen(false)} />
          </DrawerContent>
        </Drawer>
      </CommandItem>
    </>
  );
}
