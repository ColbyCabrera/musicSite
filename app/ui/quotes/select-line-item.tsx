import useSWR from 'swr';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerTitle,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '../shadcn/components/ui/command';
import { useState } from 'react';
import { cn } from '../shadcn/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { Input } from '../shadcn/components/ui/input';
import { TemplateLineItem } from '@/app/lib/definitions';
import { getTemplateLineItemByName } from '@/app/lib/data';
import CreateTemplateLineItem from './create-template-line-item';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/app/lib/utils';

export default function SelectLineItem({
  name,
  onItemSelected,
  onFetchStart,
  onFetchEnd,
}: {
  name: string;
  onItemSelected: (item: TemplateLineItem) => void;
  onFetchStart: () => void;
  onFetchEnd: (error?: Error) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [lineItemName, setLineItemName] = useState(name);

  const fetcher = (url: string, body: object) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).then((res) => res.json());
  const { data, isLoading, error } = useSWR(
    ['/api/quotes/template-line-items', { query }],
    ([url, body]) => fetcher(url, body),
  );

  const lineItems: TemplateLineItem[] = data?.lineItems;

  const handleSearch = useDebouncedCallback((query) => {
    setQuery(query);
  }, 300);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger className="max-w-full">
        <MagnifyingGlassIcon className="text-muted-foreground mx-3 h-4 min-w-4 hover:scale-110" />
      </DrawerTrigger>
      <DrawerContent className="hide-handle h-200 max-h-[70vh] border-none md:p-2">
        <DrawerTitle />
        <DrawerDescription />
        <Command className="rounded-t-xl rounded-b-none">
          <div className="mx-1 flex items-center border-b px-3">
            <MagnifyingGlassIcon className="text-muted-foreground h-4 min-w-4" />
            <Input
              placeholder="Search for a line item..."
              onChange={(e) => handleSearch(e.target.value)}
              name="search"
              className="m-1 w-auto flex-1 border-none focus-visible:ring-0 focus-visible:ring-transparent"
            />
          </div>

          <CommandList className="h-full max-h-none">
            {!isLoading && <CommandEmpty>No results found.</CommandEmpty>}
            {isLoading && (
              <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="mr-1 h-10 w-10 animate-spin" />
              </div>
            )}
            <CommandGroup>
              {lineItems?.map((lineItem: TemplateLineItem) => (
                <CommandItem
                  className="flex gap-2"
                  key={lineItem.name}
                  value={lineItem.name}
                  onSelect={async (currentValue) => {
                    setLineItemName(currentValue);
                    setQuery('');
                    setOpen(false);

                    let fetchedItem: TemplateLineItem | null = null;
                    let fetchError: Error | undefined = undefined;

                    try {
                      onFetchStart();
                      fetchedItem =
                        await getTemplateLineItemByName(currentValue);
                      onItemSelected(fetchedItem);
                    } catch (err) {
                      fetchError =
                        err instanceof Error ? err : new Error(String(err));
                      console.error('Error fetching line item details:', err);
                    } finally {
                      onFetchEnd(fetchError);
                    }
                  }}
                >
                  <Check
                    className={cn(
                      'h-5 max-w-5 min-w-5',
                      lineItemName === lineItem.name
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <div>
                    <p>{lineItem.name}</p>
                    <div className="text-muted-foreground">
                      <p>
                        {formatCurrency(lineItem.unit_price)}{' '}
                        {lineItem.is_taxable ? 'Taxable' : 'Non-taxable'}
                      </p>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <DrawerFooter>
          <CreateTemplateLineItem />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
