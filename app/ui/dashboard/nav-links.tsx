'use client';

import clsx from 'clsx';
import Link from 'next/link';
import {
  UserGroupIcon,
  HomeIcon,
  BanknotesIcon,
  WrenchIcon,
  DocumentTextIcon,
  DocumentCurrencyDollarIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { usePathname } from 'next/navigation';
import { Button } from '@/app/ui/shadcn/components/ui/button';

const links = [
  {
    name: 'Home',
    href: '/dashboard',
    id: 'dashboard',
    icon: HomeIcon,
  },
  {
    name: 'Clients',
    href: '/dashboard/clients',
    id: 'clients',
    icon: UserGroupIcon,
  },
  {
    name: 'Jobs',
    href: '/dashboard/jobs',
    id: 'jobs',
    icon: WrenchIcon,
  },
  {
    name: 'Quotes',
    href: '/dashboard/quotes',
    id: 'quotes',
    icon: BanknotesIcon,
  },
  {
    name: 'Invoices',
    href: '/dashboard/invoices',
    id: 'invoices',
    icon: DocumentCurrencyDollarIcon,
  },
  {
    name: 'Forms',
    href: '/dashboard/forms',
    id: 'forms',
    icon: DocumentTextIcon,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    id: 'settings',
    icon: Cog6ToothIcon,
  },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {links.map((link) => {
        const LinkIcon = link.icon;
        return (
          <Link
            key={link.name}
            href={link.href}
            className="mx-2 flex h-12 items-center justify-center bg-inherit font-medium md:m-0 md:grow-0 md:items-center"
          >
            <Button
              className={clsx(
                'block h-[88%] w-11/12 flex-1 rounded-lg px-5 text-base hover:bg-slate-300 md:flex-initial',
                {
                  'bg-slate-200 text-slate-700 md:bg-slate-50': isOnPath(
                    link.id,
                    pathname,
                  ),
                },
              )}
              variant="ghost"
            >
              <div className="flex items-center gap-2">
                <LinkIcon className="min-h-5 min-w-5"></LinkIcon>
                {link.name}
              </div>
            </Button>
          </Link>
        );
      })}
    </>
  );
}

function isOnPath(link: string, path: string) {
  const isOnHome = !path.includes('dashboard/');
  const includesLink = path.includes(link);

  if (isOnHome) return includesLink;
  else if (includesLink && link != 'dashboard') return true;
  else return false;
}
