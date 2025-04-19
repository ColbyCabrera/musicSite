import Link from 'next/link';
import { format } from 'date-fns';
import { Invoice } from '@/app/lib/definitions';
import { Badge } from '../shadcn/components/ui/badge';
import { statusColors } from '../clients/status/status-colors';
import { camelToRegularText, moneyFormatter } from '@/app/lib/utils';
import { CalendarIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

export default function Invoice({
  invoice,
  dateType,
}: {
  invoice: Invoice;
  dateType: 'created' | 'sent';
}) {
  const statusColor = invoice.is_pending
    ? 'bg-gray-100 text-gray-800'
    : statusColors[invoice.status + 'Light'] || 'bg-gray-100 text-gray-800'; // Default color if status not found

  return (
    <Link href={`/dashboard/invoices/${invoice.id}`}>
      <div className="transition-all hover:my-1 hover:rounded-lg hover:bg-blue-50 lg:hover:my-0 lg:hover:rounded-none">
        <div className="py-4 pl-0 transition-all hover:translate-x-3 lg:pl-2 lg:hover:translate-x-1">
          <div className="grid grid-cols-3 items-center gap-x-4 gap-y-3 lg:grid-cols-16">
            <div className="col-span-3 flex items-center gap-3 pr-4 lg:col-span-5 lg:max-w-80">
              <h3 className="font-semibold text-balance lg:flex-1">
                {invoice.title}
              </h3>
            </div>

            <div className="col-span-3 mr-3 flex items-center gap-2 lg:col-span-5">
              <Badge
                className={`${statusColor} text-foreground my-1 space-x-1.5 overflow-hidden contrast-95 saturate-150 hover:${statusColor}`}
              >
                <span className={`${statusColor} opacity-80`}>
                  Invoice#{invoice.id}
                </span>
                <p className={`${statusColor} opacity-20`}> | </p>
                <span
                  className={`${statusColor} overflow-hidden text-nowrap text-ellipsis capitalize`}
                >
                  {invoice.is_pending
                    ? 'Pending'
                    : camelToRegularText(invoice.status || 'No status set')}
                </span>
              </Badge>
            </div>

            <div className="col-span-3 lg:col-span-3">
              <p className="font-medium md:font-normal">
                <span className="text-muted-foreground lg:hidden">
                  Total of
                </span>{' '}
                {moneyFormatter.format(invoice.total ? invoice.total / 100 : 0)}
              </p>
            </div>

            <div className="col-span-3 lg:col-span-3">
              <div className="block space-y-1">
                <div className="hidden items-center space-x-2 lg:flex">
                  <CalendarIcon className="text-muted-foreground h-5 min-w-5" />
                  <span className="text-nowrap">
                    {dateType === 'created'
                      ? format(new Date(invoice.date_created), 'LLL dd, y')
                      : invoice.date_sent
                        ? format(new Date(invoice.date_sent), 'LLL dd, y')
                        : 'Not sent'}
                  </span>
                </div>
                <div className="lg:hidden">
                  {invoice.date_sent ? (
                    <div className="flex items-center gap-x-2">
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
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
