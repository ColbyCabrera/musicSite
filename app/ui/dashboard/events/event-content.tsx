import EventPopover from './event-popover';
import { cn } from '../../shadcn/lib/utils';
import { EventContentArg } from '@fullcalendar/core/index.js';

export default function EventContent(eventContent: EventContentArg) {
  const length = eventContent.event._def.extendedProps.eventLength;
  const isComplete = eventContent.event._def.extendedProps.isCompleted;

  return (
    <>
      <EventPopover popoverInfo={eventContent.event} />
      <div
        className={cn(
          'event-content flex max-w-full gap-1 pl-0.5 text-xs md:pl-1 lg:text-sm',
          {
            'completed-job': isComplete,
          },
        )}
      >
        {eventContent.timeText && (
          <b className="time-text">{eventContent.timeText}</b>
        )}
        <p className="max-w-full leading-tight">
          {length && <span className="hidden sm:inline">({length})</span>}{' '}
          {eventContent.event.title}
        </p>
      </div>
      <div
        className={cn(
          'event-content day-view max-w-full gap-1 rounded-lg p-2',
          {
            'completed-job': isComplete,
          },
        )}
      >
        <p className="max-w-full font-medium">{eventContent.event.title}</p>
        {eventContent.timeText && (
          <p className="time-text text-xs opacity-95">
            {eventContent.timeText}
          </p>
        )}
        {length && (
          <p className="text-xs opacity-95">
            {length} {length > 1 ? 'hrs' : 'hr'}
          </p>
        )}
      </div>
    </>
  );
}
