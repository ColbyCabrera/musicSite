import {
  getClientById,
  getLineItemsByQuoteId,
  getQuoteById,
  getTaxById,
} from '@/app/lib/data';
import Link from 'next/link';
import { format } from 'date-fns';
import { JobData } from '@/app/lib/definitions';
import { Badge } from '../../shadcn/components/ui/badge';
import { addTimeToDate, moneyFormatter } from '@/app/lib/utils';

const statusColors = {
  complete: 'bg-green-100 text-green-800',
  incomplete: 'bg-slate-100 text-slate-600',
  incompleteLate: 'bg-red-100 text-red-700',
};

export default async function JobDisplay({ job }: { job: JobData }) {
  const now = new Date();
  const jobEndTime = job.end_time
    ? addTimeToDate(job.end_date, job.end_time)
    : new Date(job.end_date);
  const isLate = jobEndTime < now && job.status === 'incomplete';
  const statusColor = isLate
    ? statusColors['incompleteLate']
    : statusColors[job.status];

  let quote, lineItems, client, tax;

  if (job.quote_id) {
    [quote, lineItems] = await Promise.all([
      getQuoteById(job.quote_id),
      getLineItemsByQuoteId(job.quote_id),
    ]);

    if (quote) {
      [client, tax] = await Promise.all([
        getClientById(quote.client_id),
        getTaxById(quote.tax_id),
      ]);
    }
  }

  return (
    <div className="grid w-full grid-cols-6 items-center justify-between gap-x-3 gap-y-2 md:gap-x-6">
      <div className="col-span-6 flex grow items-center justify-between gap-4 lg:col-span-4 lg:justify-start xl:gap-8">
        <div className="max-w-64 grow">
          <Link
            href={`/dashboard/jobs/${job.id}`}
            className="text-muted-foreground text-sm font-normal capitalize hover:underline"
          >
            Job#{job.id} | {job.job_type}
          </Link>
          <p className="font-medium">{job.title}</p>
        </div>

        <Badge
          className={`${statusColor} text-foreground my-1 space-x-1.5 hover:${statusColor}`}
        >
          <span className={`${statusColor} capitalize`}>{job.status}</span>
        </Badge>
      </div>

      <p className="text-muted-foreground col-span-3 lg:col-span-1">
        {job.date_created ? format(job.date_created, 'LLL dd, y') : 'No date'}
      </p>

      <div className="col-span-3 text-right lg:col-span-1">
        {quote ? (
          <p className="w-full font-medium break-words">
            {moneyFormatter.format(quote.total ? quote.total / 100 : 0)}
          </p>
        ) : (
          <p className="font-medium">{moneyFormatter.format(0)}</p>
        )}
      </div>
    </div>
  );
}
