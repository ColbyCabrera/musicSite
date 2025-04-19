'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  BanknotesIcon,
  DocumentCurrencyDollarIcon,
  PlusCircleIcon,
  UserPlusIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../shadcn/components/ui/popover';

export function CreatePopover() {
  const [open, setOpen] = useState(false);

  return (
    <div className="hidden md:block">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="group flex h-12 w-full items-center justify-center gap-2 font-medium">
          <div className="block h-[88%] w-11/12 flex-1 rounded-lg px-5 text-base hover:bg-slate-300 md:flex-initial">
            <div className="flex h-full items-center gap-2">
              <PlusCircleIcon className="h-5 w-5 transition-all group-hover:scale-110 group-hover:rotate-45" />
              <p>Create</p>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-fit p-1">
          <div className="flex gap-1">
            <div onClick={() => setOpen(false)}>
              <Link
                href="/dashboard/clients/create"
                className="block w-fit rounded-sm px-3 py-1.5 transition-colors hover:bg-slate-100"
              >
                <div className="flex min-w-10 flex-col gap-1">
                  <UserPlusIcon
                    className="h-6 text-orange-700 saturate-50"
                    strokeWidth={1.5}
                  />
                  <p className="text-center text-sm">Client</p>
                </div>
              </Link>
            </div>
            <div onClick={() => setOpen(false)}>
              <Link
                href="/dashboard/quotes/create"
                className="block w-fit rounded-sm px-3 py-1.5 transition-colors hover:bg-slate-100"
              >
                <div className="flex min-w-10 flex-col gap-1">
                  <BanknotesIcon
                    className="h-6 text-green-700 saturate-50"
                    strokeWidth={1.5}
                  />
                  <p className="text-center text-sm">Quote</p>
                </div>
              </Link>
            </div>
            <div onClick={() => setOpen(false)}>
              <Link
                href="/dashboard/jobs/create"
                className="block w-fit rounded-sm px-3 py-1.5 transition-colors hover:bg-slate-100"
              >
                <div className="flex min-w-10 flex-col gap-1">
                  <WrenchScrewdriverIcon
                    className="h-6 text-green-700 saturate-50"
                    strokeWidth={1.5}
                  />
                  <p className="text-center text-sm">Job</p>
                </div>
              </Link>
            </div>
            <div onClick={() => setOpen(false)}>
              <Link
                href="/dashboard/invoices/create"
                className="block w-fit rounded-sm px-3 py-1.5 transition-colors hover:bg-slate-100"
              >
                <div className="flex min-w-10 flex-col gap-1">
                  <DocumentCurrencyDollarIcon
                    className="h-6 text-blue-700 saturate-50"
                    strokeWidth={1.5}
                  />
                  <p className="text-center text-sm">Invoice</p>
                </div>
              </Link>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
