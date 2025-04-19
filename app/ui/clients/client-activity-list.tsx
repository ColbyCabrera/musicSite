import { ClientActivity } from '@/app/lib/definitions';
import { Separator } from '../shadcn/components/ui/separator';
import Activity from './activity';

export default function ClientActivityList({
  activities,
}: {
  activities: ClientActivity[];
}) {
  const activitiesList = activities.map((activity, index) => {
    return (
      <div key={activity.id} className='py-1'>
        <Activity activity={activity} displayDate={true}></Activity>
        {index != activities.length - 1 && (
          <Separator className="my-2 max-w-96" />
        )}
      </div>
    );
  });

  return <div>{activitiesList}</div>;
}
