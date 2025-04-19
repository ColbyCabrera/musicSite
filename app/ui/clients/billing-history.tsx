'use client';

import { Bill } from '@/app/lib/definitions';
import { Separator } from '../shadcn/components/ui/separator';
import { get24hrTime, getTimeZone, to12hrTimeString } from '@/app/lib/utils';

export default function BillingHistory({ history }: { history: Bill[] }) {
  if (history[0] != undefined) {
    const historyList = history.map((bill, index) => {
      return (
        <div key={bill.id}>
          <h2 className="mb-1 mt-6 text-xl font-semibold text-slate-800">
            Billing history
          </h2>
          <div className="py-1">
            <Bill bill={bill}></Bill>
            {index != history.length - 1 && (
              <Separator className="my-2 max-w-96" />
            )}
          </div>
        </div>
      );
    });
    return <div>{historyList}</div>;
  }
}

export function Bill({ bill }: { bill: Bill }) {
  if (bill != undefined) {
    const date = new Date(bill.date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      timeZone: getTimeZone(),
    });

    const time24hr = get24hrTime(bill.date);

    const formattedTime = to12hrTimeString(time24hr);

    return (
      <div>
        <p className="text-sm text-muted-foreground">{`${date} ${formattedTime}`}</p>
        <div className="flex flex-wrap justify-between">
          <p className="overflow-hidden text-ellipsis">{bill.description}</p>
          <p className="text-muted-foreground">${bill.amount}</p>
        </div>
      </div>
    );
  } else {
    return <p></p>;
  }
}
