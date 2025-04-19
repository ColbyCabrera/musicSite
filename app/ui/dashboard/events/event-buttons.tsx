'use client';

import { deleteEvent } from '@/app/lib/actions';
import DeleteButton from '../../delete-button';
import { Button } from '../../shadcn/components/ui/button';
import Link from 'next/link';

export function EventButtons({ eventId }: { eventId: number }) {
  return (
    <div className="flex justify-between space-x-4">
      <Button asChild>
        <Link href={`/dashboard/events/${eventId}/edit`}>Edit event</Link>
      </Button>
      <DeleteButton
        entity={'event'}
        deleteFunction={() => deleteEvent(eventId)}
      />
    </div>
  );
}
