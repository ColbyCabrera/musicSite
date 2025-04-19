import { ArrowRightStartOnRectangleIcon as LogOutIcon } from '@heroicons/react/24/outline';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import { signOut } from '@/app/api/auth/[...nextauth]/auth';
import NavLinks from '@/app/ui/dashboard/nav-links';
import { CreatePopover } from './create-popover';
import SideDrawer from './side-drawer';
import Link from 'next/link';

export default function SideNav() {
  return (
    <>
      <div>
        <div className="sticky top-0 hidden h-screen w-48 md:block">
          <div className="flex h-full flex-col items-stretch justify-between bg-slate-200 pt-4">
            <div>
              <CreatePopover></CreatePopover>
              <NavLinks />
            </div>

            <form
              action={async () => {
                'use server';
                await signOut();
              }}
              className="h-12 p-1 md:h-auto md:p-0"
            >
              <Button
                className="flex h-14 w-full items-center gap-2 rounded-none px-5 text-left text-base hover:bg-slate-300"
                variant="ghost"
                type="submit"
              >
                <LogOutIcon className="min-h-5 min-w-5" />
                <div className="hidden md:block">Sign Out</div>
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-50 h-14 border-b border-slate-300/50 bg-slate-300/35 drop-shadow-lg backdrop-blur-md backdrop-filter md:hidden">
        <div className="flex h-full items-center justify-between p-4">
          <Link href="/dashboard">
            <h2 className="text-lg font-bold">Home</h2>
          </Link>
          <SideDrawer />
        </div>
      </div>
    </>
  );
}
