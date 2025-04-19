'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { CalendarEvent } from '@/app/lib/definitions';
import { usePermissionsContext } from '@/app/contexts/PermissionsContext';
import { formatEvents, getTimeDifferenceInMinutes } from '@/app/lib/utils';
import interactionPlugin from '@fullcalendar/interaction';
import AddEventDialog from './events/add-event-dialog';
import timeGridPlugin from '@fullcalendar/timegrid';
import EventContent from './events/event-content';

export default function Calendar({ events }: { events: CalendarEvent[] }) {
  const router = useRouter();
  const permissions = usePermissionsContext();
  const [open, setOpen] = useState(false);
  const handleCloseDialog = () => setOpen(false);
  const initialView = permissions === 'ADMIN' ? 'dayGridMonth' : 'dayGridDay';
  let initialEvents = formatEvents(events);
  let leftToolbar = 'prev,next,today';
  let rightToolbar = 'dayGridMonth,timeGridWeek,dayGridDay';
  let centerToolbar = 'title';
  let customButtons;

  if (permissions === 'ADMIN') {
    customButtons = {
      addEvent: {
        text: 'Add event',
        click: function () {
          setOpen(true);
        },
      },
      addJob: {
        text: 'Add job',
        click: function () {
          router.push('/dashboard/jobs/create');
        },
      },
    };
    leftToolbar = 'prev,next,today,addEvent,addJob';
  } else {
    customButtons = {};
  }

  return (
    <div className="calendar-container h-full pb-1">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin, timeGridPlugin]}
        headerToolbar={{
          left: leftToolbar,
          center: centerToolbar,
          right: rightToolbar,
        }}
        eventClassNames={(arg): string[] => {
          // Add a class to events that are less than 30 minutes long
          // to increase their height for readability
          const SHORT_EVENT_THRESHOLD_MINUTES = 30;
          if (!arg.event.start || !arg.event.end) return [''];

          return getTimeDifferenceInMinutes(arg.event.start, arg.event.end) <=
            SHORT_EVENT_THRESHOLD_MINUTES
            ? ['increase-height']
            : [''];
        }}
        customButtons={customButtons}
        initialView={initialView}
        nowIndicator={true}
        editable={true}
        selectable={true}
        selectMirror={true}
        initialEvents={[...initialEvents]}
        hiddenDays={[0, 6]}
        contentHeight={'100%'}
        height={'100%'}
        eventContent={EventContent}
        slotEventOverlap={false}
      />

      <AddEventDialog open={open} setOpen={handleCloseDialog} />
    </div>
  );
}
