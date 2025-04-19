import Job from './job';
import { JobData } from '@/app/lib/definitions';
import { Separator } from '../shadcn/components/ui/separator';

export default async function JobList({ jobs }: { jobs: JobData[] }) {
  const jobsList = jobs.map((job) => {
    return (
      <div key={job.id + 1}>
        <Job job={job} key={job.id} />
        <Separator />
      </div>
    );
  });

  return <div>{jobsList}</div>;
}
