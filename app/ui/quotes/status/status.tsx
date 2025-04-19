'use client';

import { useState } from 'react';
import CommandBody from './command-body';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../../shadcn/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../shadcn/components/ui/popover';
import StatusDisplay from './status-display';
import { Quote } from '@/app/lib/definitions';
import { useQuoteStatusContext } from '@/app/contexts/QuoteStatusContext';
import { Command, CommandInput } from '../../shadcn/components/ui/command';

export default function Status() {
  return (
    <div className="w-fit overflow-hidden transition-all hover:scale-105">
      <div className="hidden md:block">
        <StatusUI deviceType="desktop" />
      </div>
      <div className="block md:hidden">
        <StatusUI deviceType="mobile" />
      </div>
    </div>
  );
}

function StatusUI({ deviceType }: { deviceType: 'desktop' | 'mobile' }) {
  const quoteStatus = useQuoteStatusContext();
  const defaultStatus = quoteStatus ? quoteStatus : 'setStatus';
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(defaultStatus as Quote['status']);

  const handleStatusChange = (statusColor: Quote['status']) => {
    setStatus(statusColor);
    setOpen(false);
  };

  if (deviceType === 'desktop') {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="max-w-full">
          <StatusDisplay status={status} />
        </PopoverTrigger>
        <PopoverContent className="mr-1 w-fit p-0">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandBody onChange={handleStatusChange} />
          </Command>
        </PopoverContent>
      </Popover>
    );
  } else {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger className="max-w-full">
          <StatusDisplay status={status} />
        </DrawerTrigger>
        <DrawerContent className="hide-handle border-none p-1">
          <DrawerHeader className="justify-start pb-2">
            <DrawerTitle>Set quote status</DrawerTitle>
          </DrawerHeader>

          <Command>
            <CommandBody onChange={handleStatusChange} />
          </Command>
        </DrawerContent>
      </Drawer>
    );
  }
}
