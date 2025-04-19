import Link from 'next/link';
import { format } from 'date-fns';
import { JobData } from '@/app/lib/definitions';
import { addTimeToDate, to12hrTimeString } from '@/app/lib/utils';
import { Badge } from '../shadcn/components/ui/badge';
import { CalendarIcon, ClockIcon, SunIcon } from '@heroicons/react/24/outline';

const statusColors = {
  complete: 'bg-green-100 text-green-800',
  incomplete: 'bg-slate-100 text-slate-600',
  incompleteLate: 'bg-red-100 text-red-700',
};

export default function Job({ job }: { job: JobData }) {
  const now = new Date();
  const jobEndTime = job.end_time
    ? addTimeToDate(job.end_date, job.end_time)
    : new Date(job.end_date);
  const isLate = jobEndTime < now && job.status === 'incomplete';

  const statusColor = isLate
    ? statusColors['incompleteLate']
    : statusColors[job.status];

  return (
    <Link href={`/dashboard/jobs/${job.id}`}>
      <div className="transition-all hover:my-1 hover:rounded-lg hover:bg-blue-50 lg:hover:my-0 lg:hover:rounded-none">
        <div className="py-4 pl-0 transition-all hover:translate-x-3 lg:pl-2 lg:hover:translate-x-1">
          <div className="grid grid-cols-1 items-center gap-x-4 gap-y-4 md:grid-cols-1 lg:grid-cols-10 lg:grid-rows-1 xl:grid-cols-10">
            <h3 className="col-span-2 text-balance pr-4 font-semibold md:col-span-4 lg:col-span-3 xl:col-span-3">
              {job.title}
            </h3>
            <div className="col-span-4 flex min-w-fit items-center gap-2 overflow-hidden text-ellipsis lg:col-span-2">
              <Badge
                className={`${statusColor} my-1 space-x-1.5 text-foreground hover:${statusColor}`}
              >
                <span className={`${statusColor} opacity-80`}>
                  Job#{job.job_id}
                </span>
                <p className={`${statusColor} opacity-20`}> | </p>
                <span className={`${statusColor} capitalize`}>
                  {job.status}
                </span>
              </Badge>
              <Badge className="my-1 capitalize lg:hidden">
                {job.job_type}
              </Badge>
            </div>
            <div className="col-span-2 hidden md:col-span-4 lg:col-span-2 lg:inline">
              <Badge className="my-1 capitalize">{job.job_type}</Badge>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <div className="block space-y-1">
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-nowrap">
                    {format(job.start_date, 'LLL dd, y')}
                  </span>
                </div>
                {!job.all_day ? (
                  <div className="mr-4 flex items-center space-x-2">
                    <ClockIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-nowrap">
                      {to12hrTimeString(job.start_time!)} -{' '}
                      {to12hrTimeString(job.end_time!)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <SunIcon className="h-5 w-5 text-yellow-500" />
                    <p>All day</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
