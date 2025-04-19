'use client';

import { useState } from 'react';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../shadcn/components/ui/toggle-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../shadcn/components/ui/dropdown-menu';
import { FilterButton } from '../../filter-button';
import { tagsToArray, tagsToString } from '@/app/lib/utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../../shadcn/components/ui/drawer';
import { Separator } from '../../shadcn/components/ui/separator';
import BlurTransition from '../../blur-transition';
import { ScrollArea } from '../../shadcn/components/ui/scroll-area';

export default function FilterClients({
  tags,
  accountManagers,
}: {
  tags: string[];
  accountManagers: string[];
}) {
  const pathname = usePathname();
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const initialTags: string[] = tagsToArray(searchParams.get('tags'));
  const initialManager = searchParams.get('account_manager') || '';
  const [selectedTags, setSelectedTags] = useState(initialTags);
  const [selectedManager, setSelectedManager] = useState(initialManager);
  const filteredCount =
    selectedTags.length + Number(selectedManager === '' ? 0 : 1);

  function handleTags(tags: string[]) {
    // Sort tags so order of selection doesn't interfere with db query
    setSelectedTags(tags.sort());
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (tags.length > 0) {
      params.set('tags', tagsToString(tags));
    } else {
      params.delete('tags');
    }
    replace(`${pathname}?${params.toString()}`);
  }

  function handleAccountManager(accountManager: string) {
    setSelectedManager(accountManager);
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (accountManager != '') {
      params.set('account_manager', accountManager);
    } else {
      params.delete('account_manager');
    }
    replace(`${pathname}?${params.toString()}`);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <FilterButton
            filteredCount={filteredCount}
            className="hidden md:flex"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-fit max-w-58">
          <ScrollArea className="max-h-96 overflow-y-auto pr-1">
            <DropdownMenuLabel>Tags</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ToggleGroup
              value={selectedTags}
              type="multiple"
              className="mb-2 flex-col items-stretch gap-0.5"
              onValueChange={(tags) => {
                handleTags(tags);
              }}
            >
              {tags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <ToggleGroupItem
                    className="h-fit min-h-8 w-full justify-start rounded-sm py-1 pr-6 text-left"
                    value={tag}
                    key={tag}
                    data-state={isSelected ? 'on' : 'off'}
                  >
                    {tag}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            <DropdownMenuLabel>Account managers</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ToggleGroup
              value={selectedManager || ''}
              type="single"
              className="flex-col items-stretch gap-0.5"
              onValueChange={(accountManager) => {
                handleAccountManager(accountManager);
              }}
            >
              {accountManagers.map((accountManager) => {
                return (
                  <ToggleGroupItem
                    className="h-8 w-full justify-start rounded-sm pr-6"
                    value={accountManager}
                    key={accountManager}
                  >
                    {accountManager}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      <Drawer>
        <DrawerTrigger asChild>
          <FilterButton filteredCount={filteredCount} className="md:hidden" />
        </DrawerTrigger>
        <DrawerContent className="hide-handle">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filter clients</DrawerTitle>
          </DrawerHeader>

          <BlurTransition />

          <div className="max-h-[60vh] overflow-y-auto p-2">
            <p className="mb-1.5 px-3 text-sm font-semibold">Tags</p>

            <ToggleGroup
              value={selectedTags}
              type="multiple"
              className="mb-2 flex-col items-stretch"
              onValueChange={(tags) => {
                handleTags(tags);
              }}
            >
              {tags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <ToggleGroupItem
                    className="h-8 w-full justify-start rounded-sm pr-6"
                    value={tag}
                    key={tag}
                    data-state={isSelected ? 'on' : 'off'}
                  >
                    {tag}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            <p className="px-3 py-1.5 text-sm font-semibold">
              Account managers
            </p>

            <ToggleGroup
              value={selectedManager || ''}
              type="single"
              className="flex-col items-stretch"
              onValueChange={(accountManager) => {
                handleAccountManager(accountManager);
              }}
            >
              {accountManagers.map((accountManager) => {
                return (
                  <ToggleGroupItem
                    className="h-8 w-full justify-start rounded-sm pr-6"
                    value={accountManager}
                    key={accountManager}
                  >
                    {accountManager}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
