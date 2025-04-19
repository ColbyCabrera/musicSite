import { ClientActivity } from '@/app/lib/definitions';
import { get24hrTime, getTimeZone, to12hrTimeString } from '@/app/lib/utils';

export default function Activity({
  activity,
  displayDate,
  displayTime
}: {
  activity: ClientActivity;
  displayDate?: boolean;
  displayTime?: boolean;
}) {
  if (activity != undefined) {
    const date = new Date(activity.date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });

    const time24hr = get24hrTime(activity.date);
    const formattedTime = to12hrTimeString(time24hr);

    if (displayDate) {
      return (
        <div>
          <p className="text-sm text-muted-foreground">{`${date} ${formattedTime}`}</p>
          <p>{activity.activity}</p>
        </div>
      );
    } else if (displayTime) {
      return (
        <div>
          <p className="text-sm text-muted-foreground">{formattedTime}</p>
          <p>{activity.activity}</p>
        </div>
      );
    } else {
      return (
        <div>
          <p>{activity.activity}</p>
        </div>
      );
    }
  } else {
    return <p></p>;
  }
}
