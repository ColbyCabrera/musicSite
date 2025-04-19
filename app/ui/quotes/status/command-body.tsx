import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '../../shadcn/components/ui/command';
import { useParams } from 'next/navigation';
import { updateQuoteStatus } from '@/app/lib/actions';
import { Quote, quoteStatuses } from '@/app/lib/definitions';
import { ScrollArea } from '../../shadcn/components/ui/scroll-area';

export default function CommandBody({
  onChange,
}: {
  onChange: (statusColor: Quote['status']) => void;
}) {
  const params = useParams<{ id: string }>();
  const quoteId = Number(params.id);
  const statusListItems = quoteStatuses;

  return (
    <CommandList className="max-h-none">
      <ScrollArea className="h-fit">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Set statuses">
          {statusListItems.map((status) => (
            <CommandItem
              key={status}
              value={status}
              className="capitalize"
              onSelect={async (currentValue) => {
                onChange(currentValue as Quote['status']);
                await updateQuoteStatus(quoteId, currentValue);
              }}
            >
              {status}
            </CommandItem>
          ))}
        </CommandGroup>
      </ScrollArea>
    </CommandList>
  );
}
