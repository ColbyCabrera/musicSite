import Link from 'next/link';
import { format } from 'date-fns';
import { Quote } from '@/app/lib/definitions';
import { moneyFormatter } from '@/app/lib/utils';
import { Badge } from '../../shadcn/components/ui/badge';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { statusColors } from '../../quotes/status/status-colors';

export default function Quote({ quote }: { quote: Quote }) {
  const statusColor = statusColors[quote.status] || 'bg-gray-100 text-gray-800'; // Default color if status not found
  const displayName =
    quote.company_name === '' ? quote.client_name : quote.company_name;

  return (
    <>
      <div className="space-y-1">
        <div className="grid w-full grid-cols-6 items-center justify-between gap-x-3 gap-y-1 md:gap-x-6">
          <div className="col-span-6 flex grow items-center justify-between gap-4 lg:col-span-4 lg:justify-start xl:gap-8">
            <div className="max-w-80 grow">
              <Link
                href={`/dashboard/quotes/${quote.id}`}
                className="hover:underline text-muted-foreground text-sm font-normal capitalize"
              >
                Quote#{quote.id}
              </Link>
              <p className="font-medium">{displayName}</p>
            </div>
            <Badge
              className={`${statusColor} text-foreground my-1 space-x-1.5 overflow-hidden hover:${statusColor}`}
            >
              <span
                className={`${statusColor} overflow-hidden text-nowrap text-ellipsis capitalize`}
              >
                {quote.status}
              </span>
            </Badge>
          </div>

          <div className="col-span-6 text-right lg:col-span-2">
            <p className="text-left font-medium lg:text-right">
              <span className="text-muted-foreground lg:hidden">Total of</span>{' '}
              {moneyFormatter.format(quote.total ? quote.total / 100 : 0)}
            </p>
          </div>
        </div>
        <div>
          {quote.date_sent ? (
            <div className="flex items-center gap-x-2 font-medium">
              <PaperAirplaneIcon className="text-muted-foreground h-5 min-w-5" />
              <p>{format(new Date(quote.date_sent), 'LLL dd, y')}</p>
            </div>
          ) : (
            <p className="text-muted-foreground font-medium">
              Created on{' '}
              <span className="text-black">
                {format(new Date(quote.date_created), 'LLL dd, y')},
              </span>{' '}
              not sent.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
