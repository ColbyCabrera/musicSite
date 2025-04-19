import Link from 'next/link';
import { format } from 'date-fns';
import { Invoice } from '@/app/lib/definitions';
import { Badge } from '../../shadcn/components/ui/badge';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { statusColors } from '../../clients/status/status-colors';
import { camelToRegularText, moneyFormatter } from '@/app/lib/utils';

export default function Invoice({ invoice }: { invoice: Invoice }) {
  const statusColor = invoice.is_pending
    ? 'bg-gray-100 text-gray-800'
    : statusColors[invoice.status + 'Light'] || 'bg-gray-100 text-gray-800'; // Default color if status not found

  return (
    <>
      <div className="space-y-1">
        <div className="grid w-full grid-cols-6 items-center justify-between gap-x-3 gap-y-1 md:gap-x-6">
          <div className="col-span-6 flex grow items-center justify-between gap-4 lg:col-span-4 lg:justify-start xl:gap-8">
            <div className="max-w-80 grow">
              <Link
                href={`/dashboard/invoices/${invoice.id}`}
                className="text-muted-foreground text-sm font-normal capitalize hover:underline"
              >
                Invoice#{invoice.id}
              </Link>
              <p className="font-medium">{invoice.title}</p>
            </div>
            <Badge
              className={`${statusColor} text-foreground my-1 space-x-1.5 overflow-hidden hover:${statusColor}`}
            >
              <span
                className={`${statusColor} overflow-hidden text-nowrap text-ellipsis capitalize`}
              >
                {invoice.is_pending
                  ? 'Pending'
                  : camelToRegularText(invoice.status || 'No status set')}
              </span>
            </Badge>
          </div>

          <div className="col-span-6 text-right lg:col-span-2">
            <p className="text-left font-medium lg:text-right">
              <span className="text-muted-foreground lg:hidden">Total of</span>{' '}
              {moneyFormatter.format(invoice.total ? invoice.total / 100 : 0)}
            </p>
          </div>
        </div>
        <div>
          {invoice.date_sent ? (
            <div className="flex items-center gap-x-2 font-medium">
              <PaperAirplaneIcon className="text-muted-foreground h-5 min-w-5" />
              <p>{format(new Date(invoice.date_sent), 'LLL dd, y')}</p>
            </div>
          ) : (
            <p className="text-muted-foreground font-medium">
              Created on{' '}
              <span className="text-black">
                {format(new Date(invoice.date_created), 'LLL dd, y')},
              </span>{' '}
              not sent.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
