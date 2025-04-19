import Team from '../team';
import Link from 'next/link';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../../shadcn/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/ui/shadcn/components/ui/popover';
import { EventImpl } from '@fullcalendar/core/internal';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import { get24hrTime, to12hrTimeString } from '@/app/lib/utils';
import { ClockIcon, SunIcon } from '@heroicons/react/24/outline';
import { Separator } from '@/app/ui/shadcn/components/ui/separator';
import { usePermissionsContext } from '@/app/contexts/PermissionsContext';

interface EventPopoverProps {
  popoverInfo: EventImpl;
}

export default function EventPopover({ popoverInfo }: EventPopoverProps) {
  const isAdmin = usePermissionsContext() === 'ADMIN' ? true : false;
  const title = popoverInfo.title?.replace(/\((\d+|\d+\.\d+)\)/, '');
  const details: string = popoverInfo.extendedProps?.description;
  const isDetails: boolean = details != '';
  const team: Array<string> = popoverInfo.extendedProps?.team;
  const eventId: number = popoverInfo.extendedProps?.resourceId;
  const eventType: string = popoverInfo.extendedProps?.eventType;
  const editLink = `/dashboard/${eventType}s/${eventId}/edit`;
  const detailsLink = `/dashboard/${eventType}s/${eventId}`;
  const eventLength = popoverInfo.extendedProps.eventLength;

  return (
    <>
      <Popover>
        <PopoverTrigger
          className="absolute z-50 hidden h-full w-full bg-transparent md:block"
          aria-label="Popover button"
        />
        <PopoverContent className="mr-1 w-60" sticky="partial" align="start">
          <div className="grid gap-4">
            <div className="space-y-2">
              {eventType === 'job' ? (
                <Link
                  href={detailsLink}
                  className="text-muted-foreground mb-0.5 text-sm hover:underline"
                >
                  Job#{eventId}
                </Link>
              ) : null}
              <h4 className="leading-snug font-medium text-pretty">
                {eventLength && (
                  <span className="text-muted-foreground">
                    ({eventLength}){' '}
                  </span>
                )}
                {title}
              </h4>
              <Separator />
              <div className="w-full space-y-2 overflow-hidden">
                {isDetails && (
                  <>
                    <div className="max-h-52 overflow-y-auto">
                      <div>
                        <h4 className="mb-1.5 leading-none font-medium">
                          Details
                        </h4>
                      </div>
                      <p className="text-muted-foreground text-sm">{details}</p>
                    </div>

                    <Separator />
                  </>
                )}
                <div>
                  <h4 className="mb-1.5 leading-none font-medium">Team</h4>
                  <Team team={team} />
                </div>
                <Separator />
                <div className="flex gap-2">
                  {isAdmin && (
                    <Link href={editLink}>
                      <Button
                        variant="outline"
                        className="focus-visible:ring-transparent"
                      >
                        Edit
                      </Button>
                    </Link>
                  )}
                  <Link href={detailsLink} className="flex-1">
                    <Button className="w-full min-w-fit focus-visible:ring-transparent">
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Drawer>
        <DrawerTrigger
          className="absolute z-50 h-full w-full bg-transparent md:hidden"
          aria-label="Drawer button"
        />
        <DrawerContent className="hide-handle gap-4 px-4">
          <DrawerHeader className="gap-0 px-0 pb-0">
            <DrawerDescription className="text-left">
              {eventType === 'job' ? (
                <Link href={detailsLink} className="inline">
                  <span className="hover:underline">Job#{eventId}</span>
                  {eventLength && <span> ({eventLength})</span>}
                </Link>
              ) : null}
            </DrawerDescription>
            <DrawerTitle className="text-left leading-snug">
              {title}
            </DrawerTitle>
          </DrawerHeader>
          {isDetails && (
            <>
              <div className="max-h-96 overflow-y-auto">
                <div>
                  <h4 className="mb-1 font-medium">Details</h4>
                </div>
                <p className="text-muted-foreground text-sm text-balance">
                  {details}
                </p>
              </div>
            </>
          )}
          <div>
            <h4 className="mb-1.5 leading-none font-medium">Team</h4>
            <Team team={team} />
          </div>
          {!popoverInfo.allDay ? (
            <div className="flex items-center space-x-2">
              <ClockIcon className="text-muted-foreground h-5 w-5" />
              <span className="text-muted-foreground">
                {to12hrTimeString(get24hrTime(popoverInfo.startStr))} -{' '}
                {to12hrTimeString(get24hrTime(popoverInfo.endStr))}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <SunIcon className="h-5 w-5 text-yellow-500" />
              <p className="text-muted-foreground">All day</p>
            </div>
          )}
          <DrawerFooter className="px-0 pt-0">
            <div className="flex gap-2">
              {isAdmin && (
                <Link href={editLink}>
                  <Button
                    variant="outline"
                    className="focus-visible:ring-transparent"
                  >
                    Edit
                  </Button>
                </Link>
              )}
              <Link href={detailsLink} className="flex-1">
                <Button className="w-full min-w-fit focus-visible:ring-transparent">
                  View Details
                </Button>
              </Link>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
