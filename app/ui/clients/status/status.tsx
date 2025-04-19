'use client';

import { useState } from 'react';
import CommandBody from './command-body';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '../../shadcn/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../shadcn/components/ui/popover';
import StatusDisplay, { StatusColor } from './status-display';
import { Command, CommandInput } from '../../shadcn/components/ui/command';
import { useClientStatusContext } from '@/app/contexts/ClientStatusContext';

export default function Status() {
  return (
    <div className="overflow-hidden transition-all hover:scale-105">
      <div className="hidden md:block">
        <StatusUI deviceType="desktop"></StatusUI>
      </div>
      <div className="block md:hidden">
        <StatusUI deviceType="mobile"></StatusUI>
      </div>
    </div>
  );
}

function StatusUI({ deviceType }: { deviceType: 'desktop' | 'mobile' }) {
  const clientStatus = useClientStatusContext();
  const defaultStatus = clientStatus ? clientStatus.status : 'setStatus';
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(defaultStatus as StatusColor);

  const handleStatusChange = (statusColor: StatusColor) => {
    setStatus(statusColor);
    setOpen(false);
  };

  if (deviceType === 'desktop') {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="max-w-full">
          <StatusDisplay status={status} note={clientStatus?.note} />
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
          <StatusDisplay status={status} note={clientStatus?.note} />
        </DrawerTrigger>
        <DrawerContent className="hide-handle border-none p-1">
          <DrawerTitle className="mt-3 mb-2 ml-3">Client status</DrawerTitle>
          <DrawerDescription className="sr-only">
            View or set client status
          </DrawerDescription>
          <Command>
            <CommandBody onChange={handleStatusChange} />
          </Command>
        </DrawerContent>
      </Drawer>
    );
  }
}
