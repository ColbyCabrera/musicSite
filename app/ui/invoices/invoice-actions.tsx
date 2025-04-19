'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowUturnLeftIcon,
  ChatBubbleOvalLeftIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../shadcn/components/ui/popover';
import { cn } from '../shadcn/lib/utils';
import { Invoice } from '@/app/lib/definitions';
import { Button } from '../shadcn/components/ui/button';
import { updateInvoiceSendState } from '@/app/lib/actions';

export default function InvoiceActionsButton({
  invoice,
}: {
  invoice: Invoice;
}) {
  const invoiceId = invoice.id;

  const Content = () => (
    <>
      <p className="mt-2 mb-1 px-2 text-sm font-semibold">Actions</p>
      <ChangeSendStatusButton invoice={invoice} />
      <Link
        href={`/dashboard/quotes/messages/${invoiceId}`}
        className="flex items-center gap-3 rounded-sm p-1.5 pr-4 transition-colors hover:bg-slate-100"
      >
        <ChatBubbleOvalLeftIcon
          className="h-5 min-w-5 text-slate-700"
          strokeWidth={1.5}
        />
        <p className="text-sm">View activity</p>
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
            <Content />
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}

function ChangeSendStatusButton({ invoice }: { invoice: Invoice }) {
  const [sent, setSent] = useState(!!invoice.date_sent);
  const [loading, setLoading] = useState(false);
  const markInvoiceOnClick = async () => {
    setLoading(true);
    try {
      await updateInvoiceSendState(invoice.id, !sent);
      setSent((sent) => !sent);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };
  return sent ? (
    <button
      type="button"
      disabled={loading}
      className={cn(
        'flex items-center gap-3 rounded-sm p-1.5 pr-4 transition-colors hover:bg-slate-100',
        { 'opacity-40': loading },
      )}
      onClick={markInvoiceOnClick}
    >
      {loading ? (
        <Loader2 className="h-5 min-w-5 animate-spin" width={20} />
      ) : (
        <ArrowUturnLeftIcon
          className="h-5 min-w-5 text-red-700"
          strokeWidth={1.5}
        />
      )}

      <p className="text-sm">Mark invoice as unsent</p>
    </button>
  ) : (
    <button
      type="button"
      disabled={loading}
      className={cn(
        'flex items-center gap-3 rounded-sm p-1.5 pr-4 transition-colors hover:bg-slate-100',
        { 'opacity-40': loading },
      )}
      onClick={markInvoiceOnClick}
    >
      {loading ? (
        <Loader2 className="h-5 min-w-5 animate-spin" width={20} />
      ) : (
        <PaperAirplaneIcon
          className="h-5 min-w-5 text-teal-700"
          strokeWidth={1.5}
        />
      )}

      <p className="text-sm">Mark invoice as sent</p>
    </button>
  );
}
