'use client';

import { useEffect, useState } from 'react';
import { Email } from '@/app/lib/definitions';
import { get24hrTime, to12hrTimeString } from '@/app/lib/utils';

export function DisplayEmail({ email }: { email: Email }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    setDate(
      new Date(email.created_at).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      }),
    );
    const time24hr = get24hrTime(email.created_at);
    const formattedTime = to12hrTimeString(time24hr);
    setTime(formattedTime);
  }, []);

  return (
    <div className="flex flex-col rounded-lg py-2 pr-4 transition-all hover:bg-blue-50 hover:pr-2 hover:pl-2">
      <div className="mb-1.5 space-y-0.5">
        <h3 className="text-lg font-medium">
          {email.subject === '' ? '(No subject)' : email.subject}
        </h3>
        <p className="text-muted-foreground overflow-hidden text-sm text-nowrap text-ellipsis">
          From: <span className="font-medium">{email.sender}</span>
        </p>
        <p className="text-muted-foreground overflow-hidden text-sm text-nowrap text-ellipsis">
          To: <span className="font-medium">{email.recipient}</span>
        </p>
        {date ? (
          <p className="text-muted-foreground text-xs">{`${date} ${time}`}</p>
        ) : (
          <div className="mb-1 h-3 w-28 animate-pulse rounded-lg bg-slate-100"></div>
        )}
      </div>

      <p className="overflow-hidden text-ellipsis whitespace-pre-wrap">
        {email.text === '' ? '(No body text)' : email.text}
      </p>
    </div>
  );
}
