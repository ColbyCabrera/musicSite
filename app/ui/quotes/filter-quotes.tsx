'use client';

import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import { tagsToArray } from '@/app/lib/utils';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../shadcn/components/ui/toggle-group';
import { Quote } from '@/app/lib/definitions';
import { FilterButton } from '../filter-button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../shadcn/components/ui/dropdown-menu';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function FilterQuotes({
  quoteStatuses,
}: {
  quoteStatuses: Quote['status'][];
}) {
  const pathname = usePathname();
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const initialSelected = tagsToArray(searchParams.get('statuses'));
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const handleSelectedChange = (selectedStatus: string) => {
    const newSelected = selected.includes(selectedStatus)
      ? selected.filter((quoteStatus) => quoteStatus !== selectedStatus)
      : [...selected, selectedStatus];

    setSelected(newSelected);

    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (newSelected.length > 0) {
      params.set('statuses', newSelected.toString());
    } else {
      params.delete('statuses');
    }

    replace(`${pathname}?${params.toString()}`);
  };

  const handleDrawerSelectedChange = (selectedStatuses: string[]) => {
    setSelected(selectedStatuses);

    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (selectedStatuses.length > 0) {
      params.set('statuses', selectedStatuses.toString());
    } else {
      params.delete('statuses');
    }

    replace(`${pathname}?${params.toString()}`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <FilterButton
            filteredCount={selected.length}
            className="hidden md:flex"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Quote statuses</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {quoteStatuses.map((quoteStatus) => (
            <DropdownMenuCheckboxItem
              key={quoteStatus}
              checked={selected.includes(quoteStatus)}
              onClick={(e) => {
                e.preventDefault();
                handleSelectedChange(quoteStatus);
              }}
              className="capitalize"
            >
              {quoteStatus}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Drawer>
        <DrawerTrigger asChild>
          <FilterButton filteredCount={selected.length} className="md:hidden" />
        </DrawerTrigger>
        <DrawerContent className="hide-handle p-2">
          <DrawerTitle className="m-2 mb-4">Quote statuses</DrawerTitle>
          <ToggleGroup
            value={selected}
            type="multiple"
            className="flex-col"
            onValueChange={handleDrawerSelectedChange}
          >
            {quoteStatuses.map((quoteStatus) => {
              const isSelected = selected.includes(quoteStatus);
              return (
                <ToggleGroupItem
                  className="h-8 w-full justify-start rounded-sm pr-6 font-normal capitalize"
                  value={quoteStatus}
                  key={quoteStatus}
                  data-state={isSelected ? 'on' : 'off'}
                >
                  {quoteStatus}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </DrawerContent>
      </Drawer>
    </>
  );
}
