'use client';

import { get24hrTime, to12hrTimeString } from '@/app/lib/utils';
import { useEffect, useState } from 'react';

export default function TimeDisplay({
  time,
  date,
}: {
  time?: string;
  date?: string;
}) {
  const [formattedTime, setFormattedTime] = useState('');

  useEffect(() => {
    const time24hr = get24hrTime(date);
    const formattedTime = to12hrTimeString(time24hr);
    setFormattedTime(formattedTime);
  }, []);

  if (time) {
    return <p className="text-slate-600">{to12hrTimeString(time)}</p>;
  } else if (date) {
    return (
      <div>
        {formattedTime ? (
          <p className="text-nowrap text-sm text-muted-foreground">
            {formattedTime}
          </p>
        ) : (
          <p className="w-fit animate-pulse rounded-lg bg-slate-100 text-sm text-transparent">
            12:00 AM
          </p>
        )}
      </div>
    );
  }
}
