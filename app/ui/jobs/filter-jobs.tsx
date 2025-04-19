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
import { FilterButton } from '../filter-button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../shadcn/components/ui/dropdown-menu';
import { JobData } from '@/app/lib/definitions';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function FilterJobs({
  jobTypes,
}: {
  jobTypes: JobData['job_type'][];
}) {
  const pathname = usePathname();
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const initialSelected = tagsToArray(searchParams.get('types'));
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const handleSelectedChange = (selectedType: string) => {
    const newSelected = selected.includes(selectedType)
      ? selected.filter((jobType) => jobType !== selectedType)
      : [...selected, selectedType];

    setSelected(newSelected);

    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (newSelected.length > 0) {
      params.set('types', newSelected.toString());
    } else {
      params.delete('types');
    }

    replace(`${pathname}?${params.toString()}`);
  };

  const handleDrawerSelectedChange = (selectedTypes: string[]) => {
    setSelected(selectedTypes);

    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (selectedTypes.length > 0) {
      params.set('types', selectedTypes.toString());
    } else {
      params.delete('types');
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
          <DropdownMenuLabel>Job types</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {jobTypes.map((jobType) => (
            <DropdownMenuCheckboxItem
              key={jobType}
              checked={selected.includes(jobType)}
              onClick={(e) => {
                e.preventDefault();
                handleSelectedChange(jobType);
              }}
              className="capitalize"
            >
              {jobType}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Drawer>
        <DrawerTrigger asChild>
          <FilterButton filteredCount={selected.length} className="md:hidden" />
        </DrawerTrigger>
        <DrawerContent className="hide-handle p-2">
          <DrawerTitle className="m-2 mb-4">Job types</DrawerTitle>
          <ToggleGroup
            value={selected}
            type="multiple"
            className="flex-col"
            onValueChange={handleDrawerSelectedChange}
          >
            {jobTypes.map((jobType) => {
              const isSelected = selected.includes(jobType);
              return (
                <ToggleGroupItem
                  className="h-8 w-full justify-start rounded-sm pr-6 font-normal capitalize"
                  value={jobType}
                  key={jobType}
                  data-state={isSelected ? 'on' : 'off'}
                >
                  {jobType}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </DrawerContent>
      </Drawer>
    </>
  );
}
