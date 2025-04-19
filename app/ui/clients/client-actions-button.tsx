'use client';

import Link from 'next/link';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../shadcn/components/ui/popover';
import { Button } from '../shadcn/components/ui/button';
import { BanknotesIcon, UserPlusIcon } from '@heroicons/react/24/outline';

export default function ClientActionsButton({
  clientId,
}: {
  clientId: number;
}) {
  const Content = () => (
    <>
      <p className="mt-2 mb-1 px-2 text-sm font-semibold">Actions</p>
      <Link
        href={`/dashboard/jobs/create?client=${clientId}`}
        className="flex items-center gap-3 rounded-sm p-1.5 pr-4 transition-colors hover:bg-slate-100"
      >
        <UserPlusIcon
          className="h-5 min-w-5 text-orange-700 saturate-50"
          strokeWidth={1.5}
        />
        <p className="text-sm">New job</p>
      </Link>
      <Link
        href={`/dashboard/quotes/create?client=${clientId}`}
        className="flex items-center gap-3 rounded-sm p-1.5 pr-4 transition-colors hover:bg-slate-100"
      >
        <BanknotesIcon
          className="h-5 min-w-5 text-green-700 saturate-50"
          strokeWidth={1.5}
        />
        <p className="text-sm">New quote</p>
      </Link>
    </>
  );

  return (
    <>
      <div className="hidden md:block">
        <Popover>
          <PopoverTrigger asChild>
            <Button className="w-fit" variant={'outline'}>
              More actions
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-fit p-1">
            <Content />
          </PopoverContent>
        </Popover>
      </div>
      <div className="block md:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Button className="w-fit" variant={'outline'}>
              More actions
            </Button>
          </DrawerTrigger>
          <DrawerContent className="hide-handle p-2">
            <DrawerTitle className="sr-only">Client actions</DrawerTitle>
            <DrawerDescription className="sr-only">
              Shows more client action buttons
            </DrawerDescription>
            <Content />
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
