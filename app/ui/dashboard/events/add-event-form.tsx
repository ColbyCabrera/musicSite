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
import dayjs from 'dayjs';
import Team from '../team';
import { useState } from 'react';
import { format } from 'date-fns';
import TeamSelect from '../team-select';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { addEvent } from '@/app/lib/actions';
import { DateRange } from 'react-day-picker';
import { cn } from '@/app/ui/shadcn/lib/utils';
import { SubmitButton } from '../../submit-button';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar as CalendarIcon } from 'lucide-react';
import { AddEventFormSchema } from '@/app/lib/definitions';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import { Textarea } from '@/app/ui/shadcn/components/ui/textarea';
import { Checkbox } from '@/app/ui/shadcn/components/ui/checkbox';
import { Separator } from '@/app/ui/shadcn/components/ui/separator';
import { useTeamMembersContext } from '@/app/contexts/TeamMembersContext';
import { useCurrentUserContext } from '@/app/contexts/CurrentUserContext';
import { Calendar as ShadcnCalendar } from '@/app/ui/shadcn/components/ui/calendar';

export default function AddEventForm() {
  const teamMembers = useTeamMembersContext();
  const user = useCurrentUserContext();
  const [state, action] = useFormState(addEvent, undefined);
  const [isChecked, setIsChecked] = useState(false);
  const [selected, setSelected] = useState([user.name]);
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(dayjs().format('MM/DD/YYYY').toString()),
    to: undefined,
  });

  const form = useForm<z.infer<typeof AddEventFormSchema>>({
    resolver: zodResolver(AddEventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      startTime: '',
      endTime: '',
      checkbox: false,
      allDay: false,
    },
  });

  return (
    <Form {...form}>
      <form action={action}>
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
        </div>

        <FormField
          control={form.control}
          name="dates"
          render={({ field }) => (
            <FormItem className="flex flex-col pt-4">
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
                <p className="text-sm text-red-500">{state.errors.datesJson}</p>
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

        <div className="grid gap-4 pt-4">
          <div className="flex flex-col items-start gap-2">
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
                        disabled={isChecked}
                      />
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
                        defaultValue="23:59"
                        disabled={isChecked}
                      />
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
                  <FormControl>
                    <Checkbox
                      name="checkbox"
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
          </div>
        </div>

        <input
          type="checkbox"
          name="allDay"
          id="allDay"
          checked={isChecked}
          onChange={() => {}}
          hidden
        />

        <Separator className="my-4" />

        <div className="grid gap-4">
          <div className="flex flex-col items-start gap-2">
            <div className="min-h-32 w-full rounded-lg border p-2">
              <div className="flex items-center justify-between">
                <h3 className="pl-1 text-xl font-bold">Team</h3>
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
                  <Team team={selected.filter((member) => member != '')} />
                ) : (
                  <i className="text-muted-foreground pl-1 text-sm">
                    No users are currently assigned
                  </i>
                )}
              </div>
            </div>
          </div>
        </div>
        <SubmitButton className="mt-4">Submit</SubmitButton>
      </form>
    </Form>
  );
}
