'use client';

import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../shadcn/components/ui/toggle-group';
import { camelToRegularText, tagsToArray } from '@/app/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../shadcn/components/ui/dropdown-menu';
import { FilterButton } from '../filter-button';
import { ClientStatus } from '@/app/lib/definitions';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function FilterInvoices({
  clientStatuses,
}: {
  clientStatuses: ClientStatus['status'][];
}) {
  const pathname = usePathname();
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const initialSelected = tagsToArray(searchParams.get('statuses'));
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const handleSelectedChange = (selectedStatus: string) => {
    const newSelected = selected.includes(selectedStatus)
      ? selected.filter((clientStatus) => clientStatus !== selectedStatus)
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
          <DropdownMenuLabel>Billing statuses</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {clientStatuses.map((clientStatus) => (
            <DropdownMenuCheckboxItem
              key={clientStatus}
              checked={selected.includes(clientStatus)}
              onClick={(e) => {
                e.preventDefault();
                handleSelectedChange(clientStatus);
              }}
              className="capitalize"
            >
              {camelToRegularText(clientStatus)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Drawer>
        <DrawerTrigger asChild>
          <FilterButton filteredCount={selected.length} className="md:hidden" />
        </DrawerTrigger>
        <DrawerContent className="hide-handle p-2">
          <DrawerTitle className="m-2 mb-4">Billing statuses</DrawerTitle>
          <ToggleGroup
            value={selected}
            type="multiple"
            className="flex-col"
            onValueChange={handleDrawerSelectedChange}
          >
            {clientStatuses.map((clientStatus) => {
              const isSelected = selected.includes(clientStatus);
              return (
                <ToggleGroupItem
                  className="h-8 w-full justify-start rounded-sm pr-6 font-normal capitalize"
                  value={clientStatus}
                  key={clientStatus}
                  data-state={isSelected ? 'on' : 'off'}
                >
                  {camelToRegularText(clientStatus)}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </DrawerContent>
      </Drawer>
    </>
  );
}
