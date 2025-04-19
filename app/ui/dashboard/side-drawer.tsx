'use client';

import React from 'react';
import { useState } from 'react';
import NavLinks from './nav-links';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import { cn } from '../shadcn/lib/utils';
import { clientSignOut } from '@/app/lib/actions';
import { Button } from '../shadcn/components/ui/button';

export default function SideDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Drawer direction="top" open={open} onOpenChange={setOpen}>
      <DrawerTrigger aria-label="Open side drawer">
        <AnimatedBars open={open} />
      </DrawerTrigger>
      <DrawerContent
        isTransparent={true}
        className={cn(
          'hide-handle fade-in-short h-full rounded-none bg-slate-50',
          {
            'opacity-0 fade-out': !open,
          },
        )}
      >
        <div className="flex items-center justify-between p-4">
          <p className="text-base font-bold text-slate-700">RMS Fitness</p>
          <DrawerClose>
            <AnimatedBars open={open} />
          </DrawerClose>
        </div>

        <div className="flex h-full flex-col rounded-t-3xl bg-slate-100 pt-3">
          <div
            onClick={() => setOpen(false)}
            className={cn('stretch-in origin-top px-2 transition-all', {
              'scale-y-0 opacity-0': !open,
            })}
          >
            <NavLinks />
          </div>

          <DrawerFooter>
            <Button className="w-full" onClick={async () => clientSignOut()}>
              Sign Out
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function AnimatedBars({ open }: { open: boolean }) {
  return (
    <div className={'relative mr-0.5 grid h-3 w-5 justify-center px-0.5'}>
      <div
        className={cn(
          'absolute top-0 h-[2px] w-full rounded-md bg-slate-700 transition-transform',
          {
            'top-1/2 -translate-y-[1px] rotate-45 bg-slate-600': open,
          },
        )}
      ></div>
      <div
        className={cn(
          'absolute bottom-0 h-[2px] w-full rounded-md bg-slate-700 transition-transform',
          {
            'bottom-1/2 translate-y-[1px] -rotate-45 bg-slate-600': open,
          },
        )}
      ></div>
    </div>
  );
}
