'use client';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/ui/shadcn/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/ui/shadcn/components/ui/popover';
import { z } from 'zod';
import Team from '../team';
import { useState } from 'react';
import { format } from 'date-fns';
import TeamSelect from '../team-select';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { DateRange } from 'react-day-picker';
import { cn } from '@/app/ui/shadcn/lib/utils';
import { deleteEvent, updateEvent } from '@/app/lib/actions';
import { QueryResultRow } from '@vercel/postgres';
import { SubmitButton } from '../../submit-button';
import { zodResolver } from '@hookform/resolvers/zod';
import DeleteButton from '../../delete-button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { AddEventFormSchema } from '@/app/lib/definitions';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import { Textarea } from '@/app/ui/shadcn/components/ui/textarea';
import { Checkbox } from '@/app/ui/shadcn/components/ui/checkbox';
import { Separator } from '@/app/ui/shadcn/components/ui/separator';
import { useTeamMembersContext } from '@/app/contexts/TeamMembersContext';
import { Calendar as ShadcnCalendar } from '@/app/ui/shadcn/components/ui/calendar';

export default function EditEventForm({
  params,
  eventData,
}: {
  params: { id: number };
  eventData: QueryResultRow;
}) {
  const eventId = params.id;
  const teamMembers = useTeamMembersContext();
  const initialNames = (
    eventData.names[0] === null ? [] : [...eventData.names]
  ) as string[];
  const updateEventWithId = updateEvent.bind(null, eventId);
  const [state, action] = useFormState(updateEventWithId, undefined);
  const [isChecked, setIsChecked] = useState(eventData.all_day);
  const [selected, setSelected] = useState(initialNames);
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(eventData.start_date),
    to: eventData.end_date,
  });

  const form = useForm<z.infer<typeof AddEventFormSchema>>({
    resolver: zodResolver(AddEventFormSchema),
    defaultValues: {
      title: eventData.title,
      description: eventData.description,
      startTime: eventData.start_time,
      endTime: eventData.end_time,
    },
  });

  return (
    <Form {...form}>
      <form action={action} className="max-w-96">
        <h1 className="mb-2 text-3xl font-bold">Edit Event</h1>
        <div className="grid gap-4 pt-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block">Title</FormLabel>
                <FormControl>
                  <Input placeholder="Event name" type="text" {...field} />
                </FormControl>
                {state?.errors?.title && (
                  <p className="text-sm text-red-500">{state.errors.title}</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block">Description</FormLabel>
                <FormControl>
                  <Textarea
                    id="description"
                    className="col-span-3"
                    {...field}
                  />
                </FormControl>
                {state?.errors?.description && (
                  <p className="text-sm text-red-500">
                    {state.errors.description}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dates"
            render={({ field }) => (
              <FormItem className="flex flex-col pt-1">
                <FormLabel>Start - End</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={'outline'}
                      className={cn(
                        'w-[300px] justify-start text-left font-normal',
                        !date && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date?.from ? (
                        date.to ? (
                          <>
                            {format(date.from, 'LLL dd, y')} -{' '}
                            {format(date.to, 'LLL dd, y')}
                          </>
                        ) : (
                          format(date.from, 'LLL dd, y')
                        )
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <ShadcnCalendar
                      mode="range"
                      defaultMonth={date?.from}
                      selected={date}
                      onSelect={setDate}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                {state?.errors?.datesJson && (
                  <p className="text-sm text-red-500">
                    {state.errors.datesJson}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <input
            type="text"
            name="datesJson"
            id="datesJson"
            value={JSON.stringify(date)}
            onChange={() => {}}
            hidden
          />
        </div>

        <div className="grid gap-4 pt-4">
          <div className="flex flex-col items-start gap-4">
            <div className="flex gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        className="mt-1 w-auto"
                        name="startTime"
                        defaultValue={eventData.start_time}
                        disabled={isChecked}
                      ></Input>
                    </FormControl>
                    {state?.errors?.startTime && (
                      <p className="text-sm text-red-500">
                        {state.errors.startTime}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        className="mt-1 w-auto"
                        name="endTime"
                        defaultValue={eventData.end_time}
                        disabled={isChecked}
                      ></Input>
                    </FormControl>
                    {state?.errors?.endTime && (
                      <p className="text-sm text-red-500">
                        {state.errors.endTime}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="checkbox"
              render={({ field }) => (
                <FormItem className="mt-2 flex flex-row items-start space-y-0 space-x-2">
                  <FormControl aria-label="All day checkbox">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => setIsChecked(!isChecked)}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>All Day</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <input
              type="checkbox"
              name="allDay"
              id="allDay"
              checked={isChecked}
              onChange={() => {}}
              hidden
            />
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid gap-4">
          <div className="flex flex-col items-start gap-2">
            <div className="min-h-32 w-full rounded-lg border p-2">
              <div className="flex items-center justify-between">
                <p className="pl-1 text-xl font-bold">Team</p>
                <div>
                  <TeamSelect
                    teamMembers={teamMembers}
                    selected={selected}
                    onChange={(teamMembers: string[]) =>
                      setSelected(teamMembers)
                    }
                  />
                  <FormField
                    control={form.control}
                    name="team"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel></FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            {...field}
                            value={JSON.stringify(selected)}
                            className="hidden"
                          />
                        </FormControl>

                        {state?.errors?.team && (
                          <FormMessage className="text-sm text-red-500">
                            {state.errors.team}
                          </FormMessage>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap">
                {selected.length > 0 ? (
                  <Team team={selected} />
                ) : (
                  <i className="text-muted-foreground pl-1 text-sm">
                    No users are currently assigned
                  </i>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-between">
          <SubmitButton type="submit">Submit</SubmitButton>
          <DeleteButton
            entity={'event'}
            deleteFunction={() => deleteEvent(eventId)}
          />
        </div>
      </form>
    </Form>
  );
}
