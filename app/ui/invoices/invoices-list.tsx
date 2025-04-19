'use client';

import Invoice from './invoice';
import { useState } from 'react';
import { cn } from '../shadcn/lib/utils';
import { Invoice as InvoiceType } from '@/app/lib/definitions';
import { Separator } from '../shadcn/components/ui/separator';
import ArrowsRightLeftIcon from '@heroicons/react/24/outline/ArrowsRightLeftIcon';

type DateType = 'created' | 'sent';

export default function InvoiceList({ invoices }: { invoices: InvoiceType[] }) {
  const [showDateType, setShowDateType] = useState<DateType>('created');

  const invoicesList = invoices.map((invoice) => {
    return (
      <div key={invoice.id + 1}>
        <Invoice invoice={invoice} key={invoice.id} dateType={showDateType} />
        <Separator />
      </div>
    );
  });

  return (
    <div>
      <InvoiceListHeader
        onShowDateChange={(dateType: DateType) => setShowDateType(dateType)}
        showDateType={showDateType}
      />
      {invoicesList}
    </div>
  );
}

function InvoiceListHeader({
  showDateType,
  onShowDateChange,
}: {
  showDateType: DateType;
  onShowDateChange: (dateType: DateType) => void;
}) {
  return (
    <div className="text-muted-foreground hidden lg:block">
      <div className="my-1.5 grid grid-cols-1 gap-x-4 pl-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-16">
        <p className="lg:col-span-5">Client Name</p>
        <p className="pr-3 lg:col-span-5">Invoice# & Status</p>
        <p className="overflow-hidden text-nowrap text-ellipsis lg:col-span-3">
          Total
        </p>
        <div className="flex items-center gap-2 lg:col-span-3">
          <button
            type="button"
            onClick={() => onShowDateChange('created')}
            className={cn(
              'decoration-muted-foreground opacity-60 transition-opacity hover:underline',
              {
                'opacity-100': showDateType === 'created',
              },
            )}
          >
            Created
          </button>

          <ArrowsRightLeftIcon
            className={cn('h-4 min-w-4 transition-all', {
              'rotate-y-180': showDateType === 'sent',
            })}
          />

          <button
            type="button"
            onClick={() => onShowDateChange('sent')}
            className={cn(
              'decoration-muted-foreground opacity-60 transition-opacity hover:underline',
              {
                'opacity-100': showDateType === 'sent',
              },
            )}
          >
            Sent
          </button>
        </div>
      </div>
      <Separator className="h-0.5" />
    </div>
  );
}
