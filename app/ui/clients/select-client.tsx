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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../shadcn/components/ui/pagination';
import { cn } from '../shadcn/lib/utils';
import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Client } from '@/app/lib/definitions';
import { useDebouncedCallback } from 'use-debounce';
import { Input } from '../shadcn/components/ui/input';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function SelectClient({
  clientName,
  onChange,
}: {
  clientName: string;
  onChange: (id: number, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [totalPages, setTotalPages] = useState(1);

  const fetcher = (url: string, body: object) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).then((res) => res.json());
  const { data, isLoading, error } = useSWR(
    ['/api/clients/filtered-clients', { query, page }],
    ([url, body]) => fetcher(url, body),
  );

  useEffect(() => {
    if (data) {
      setTotalPages(data.totalPages);
    }
  }, [data]);

  const clients: Client[] = data?.clients;

  const handleSearch = useDebouncedCallback((query) => {
    setQuery(query);
    setPage(1);
  }, 300);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger className="max-w-full">
        <div className="border-b-2 border-dotted border-slate-300">
          <h1 className="overflow-hidden text-3xl font-bold text-nowrap text-ellipsis">
            {clientName}
          </h1>
        </div>
      </DrawerTrigger>
      <DrawerContent className="hide-handle h-[62vh] border-none md:p-2">
        <DrawerTitle></DrawerTitle>
        <DrawerDescription></DrawerDescription>
        <Command className="rounded-xl">
          <div className="mx-1 flex items-center border-b px-3">
            <MagnifyingGlassIcon className="text-muted-foreground h-4 min-w-4" />
            <Input
              placeholder="Search for a client..."
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
              {clients?.map((client) => (
                <CommandItem
                className='flex gap-2'
                key={client.id}
                  value={
                    (client.company_name || client.contacts[0].name) +
                    '%' + // add symbol to seperate id from rest of string
                    client.id
                  }
                  onSelect={(currentValue) => {
                    let [name, id] = separateId(currentValue);
                    if (name === clientName) id = 0; // Set id to default when client is unselected
                    onChange(id, name === clientName ? 'Client Name' : name);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'h-5 min-w-5 max-w-5',
                      clientName ===
                        (client.company_name || client.contacts[0].name)
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  {client.company_name || client.contacts[0].name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        <DrawerFooter>
          <Pagination defaultValue={1}>
            <PaginationContent className="w-full justify-center *:flex-1 first:mr-auto last:ml-auto max-[420px]:gap-0">
              <PaginationItem className="flex justify-end">
                <PaginationPrevious
                  className={cn('ml-1 max-[380px]:pr-2 max-[380px]:pl-1', {
                    'pointer-events-none opacity-50':
                      isLoading || totalPages === 0,
                  })}
                  href="#"
                  onClick={() => setPage(Math.max(page - 1, 1))}
                />
              </PaginationItem>
              {(() => {
                if (totalPages <= 4) {
                  return (
                    <div className="flex justify-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (pageValue) => (
                          <PaginationItem
                            className="flex justify-center"
                            key={pageValue}
                            onClick={() => setPage(pageValue)}
                          >
                            <PaginationLink
                              className="max-[420px]:h-8 max-[420px]:w-8"
                              isActive={page === pageValue}
                              href="#"
                            >
                              {pageValue}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                    </div>
                  );
                }

                if (page <= 3) {
                  return (
                    <div className="flex justify-center gap-1">
                      <PaginationItem onClick={() => setPage(1)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:w-8"
                          isActive={page === 1}
                          href="#"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem onClick={() => setPage(2)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:w-8"
                          isActive={page === 2}
                          href="#"
                        >
                          2
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem onClick={() => setPage(3)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:w-8"
                          isActive={page === 3}
                          href="#"
                        >
                          3
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationEllipsis className="max-[420px]:h-8 max-[420px]:w-8" />
                      </PaginationItem>
                      <PaginationItem onClick={() => setPage(totalPages)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:w-8"
                          href="#"
                          isActive={page === totalPages}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </div>
                  );
                }

                if (page >= totalPages - 2) {
                  return (
                    <div className="flex justify-center gap-0.5">
                      <PaginationItem onClick={() => setPage(1)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:w-8"
                          isActive={page === 1}
                          href="#"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationEllipsis className="mr-2 max-[420px]:h-8 max-[420px]:w-4" />
                      </PaginationItem>
                      <PaginationItem onClick={() => setPage(totalPages - 2)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:max-w-9"
                          isActive={page === totalPages - 2}
                          href="#"
                        >
                          {totalPages - 2}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem onClick={() => setPage(totalPages - 1)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:max-w-9"
                          href="#"
                          isActive={page === totalPages - 1}
                        >
                          {totalPages - 1}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem onClick={() => setPage(totalPages)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:max-w-9"
                          href="#"
                          isActive={page === totalPages}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </div>
                  );
                }

                if (page >= 4) {
                  return (
                    <div className="flex justify-center gap-1">
                      <PaginationItem onClick={() => setPage(1)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:w-8"
                          isActive={page === 1}
                          href="#"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationEllipsis className="max-[420px]:h-8 max-[420px]:w-8" />
                      </PaginationItem>

                      <PaginationItem
                        onClick={() => setPage(page - 1)}
                        className="hidden md:list-item"
                      >
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:w-8"
                          isActive={false}
                          href="#"
                        >
                          {page - 1}
                        </PaginationLink>
                      </PaginationItem>

                      <PaginationItem onClick={() => setPage(page)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:w-8"
                          isActive={true}
                          href="#"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem
                        onClick={() => setPage(page + 1)}
                        className="hidden md:list-item"
                      >
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:w-8"
                          isActive={false}
                          href="#"
                        >
                          {page + 1}
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationEllipsis className="max-[420px]:h-8 max-[420px]:w-8" />
                      </PaginationItem>
                      <PaginationItem onClick={() => setPage(totalPages)}>
                        <PaginationLink
                          className="max-[420px]:h-8 max-[420px]:w-8"
                          href="#"
                          isActive={page === totalPages}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </div>
                  );
                }
              })()}

              <PaginationItem>
                <PaginationNext
                  className={cn('ml-1 max-[380px]:pr-1 max-[380px]:pl-2', {
                    'pointer-events-none opacity-50':
                      isLoading || totalPages === 0,
                  })}
                  href="#"
                  onClick={() => setPage(Math.min(page + 1, totalPages))}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function separateId(value: string): [string, number] {
  const sliceIndex = value.search('%');
  return [value.slice(0, sliceIndex), Number(value.slice(sliceIndex + 1))];
}
