import Link from 'next/link';
import { format } from 'date-fns';
import { Quote } from '@/app/lib/definitions';
import { moneyFormatter } from '@/app/lib/utils';
import { statusColors } from './status/status-colors';
import { Badge } from '../shadcn/components/ui/badge';
import ChatIconWithBadge from './chat-icon-with-badge';
import { CalendarIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

export default function Quote({
  quote,
  dateType,
}: {
  quote: Quote;
  dateType: 'created' | 'sent';
}) {
  const statusColor = statusColors[quote.status] || 'bg-gray-100 text-gray-800'; // Default color if status not found
  const displayName =
    quote.company_name === '' ? quote.client_name : quote.company_name;

  return (
    <div className="relative transition-all hover:my-1 hover:rounded-lg hover:bg-blue-50 lg:hover:my-0 lg:hover:rounded-none">
      <div className="py-4 pl-0 transition-all hover:translate-x-3 lg:pl-2 lg:hover:translate-x-1">
        <Link
          href={`/dashboard/quotes/${quote.id}`}
          className="absolute top-0 left-0 h-full w-full"
        />
        <div className="grid grid-cols-3 items-center gap-x-4 gap-y-3 lg:grid-cols-16">
          <div className="col-span-3 flex items-center gap-3 pr-4 lg:col-span-4 lg:max-w-80">
            <h3 className="font-semibold text-balance lg:flex-1">
              {displayName}
            </h3>
            <ChatIconWithBadge
              displayNumber={quote.messages_count || 0}
              id={quote.id}
            />
          </div>

          <div className="col-span-3 mr-3 flex items-center gap-2 lg:col-span-4">
            <Badge
              className={`${statusColor} text-foreground my-1 space-x-1.5 overflow-hidden hover:${statusColor}`}
            >
              <span className={`${statusColor} opacity-80`}>
                Quote#{quote.id}
              </span>
              <p className={`${statusColor} opacity-20`}> | </p>
              <span
                className={`${statusColor} overflow-hidden text-nowrap text-ellipsis capitalize`}
              >
                {quote.status}
              </span>
            </Badge>
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 lg:hidden">
              {quote.manager || 'No quote manager'}
            </Badge>
          </div>

          <div className="col-span-2 hidden lg:col-span-3 lg:block">
            <p className="overflow-hidden text-nowrap text-ellipsis">
              {quote.manager || 'No quote manager'}
            </p>
          </div>

          <div className="col-span-3 lg:col-span-2">
            <p className="font-medium md:font-normal">
              <span className="text-muted-foreground lg:hidden">Total of</span>{' '}
              {moneyFormatter.format(quote.total ? quote.total / 100 : 0)}
            </p>
          </div>

          <div className="col-span-3 lg:col-span-3">
            <div className="block space-y-1">
              <div className="hidden items-center space-x-2 lg:flex">
                <CalendarIcon className="text-muted-foreground h-5 min-w-5" />
                <span className="text-nowrap">
                  {dateType === 'created'
                    ? format(new Date(quote.date_created), 'LLL dd, y')
                    : quote.date_sent
                    ? format(new Date(quote.date_sent), 'LLL dd, y')
                    : 'Not sent'}
                </span>
              </div>
              <div className="lg:hidden">
                {quote.date_sent ? (
                  <div className="flex items-center gap-x-2">
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
          </div>
        </div>
      </div>
    </div>
  );
}
