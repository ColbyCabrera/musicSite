'use client';

import {
  Client,
  CreateJobFormSchema,
  JobData,
  JobForm,
} from '@/app/lib/definitions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shadcn/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
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
import useSWR from 'swr';
import { useState } from 'react';
import { format } from 'date-fns';
import Team from '../dashboard/team';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import DeleteButton from '../delete-button';
import { DateRange } from 'react-day-picker';
import { cn } from '@/app/ui/shadcn/lib/utils';
import { SubmitButton } from '../submit-button';
import TeamSelect from '../dashboard/team-select';
import SelectClient from '../clients/select-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar as CalendarIcon } from 'lucide-react';
import { deleteJob, updateJob } from '@/app/lib/actions';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import { Textarea } from '@/app/ui/shadcn/components/ui/textarea';
import { Checkbox } from '@/app/ui/shadcn/components/ui/checkbox';
import { Separator } from '@/app/ui/shadcn/components/ui/separator';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { useTeamMembersContext } from '../../contexts/TeamMembersContext';
import { Calendar as ShadcnCalendar } from '@/app/ui/shadcn/components/ui/calendar';

export default function EditJobForm({
  params,
  jobData,
  jobForms,
}: {
  params: { id: number };
  jobData: JobData;
  jobForms: JobForm[];
}) {
  const jobId = params.id;
  const teamMembers = useTeamMembersContext();
  const initialClientId = jobData.client_id;
  const [clientName, setClientName] = useState('Client Name');
  const [clientId, setClientId] = useState<number | null>(
    initialClientId || null,
  );
  const initialNames = (
    jobData.names[0] === null ? [] : [...jobData.names]
  ) as string[];
  const updateJobWithIds = updateJob.bind(null, jobId, clientId);
  const [state, action] = useFormState(updateJobWithIds, undefined);
  const [isChecked, setIsChecked] = useState(jobData.all_day);
  const [selected, setSelected] = useState(initialNames);
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(jobData.start_date),
    to: new Date(jobData.end_date),
  });
  const [selectedJobForms, setSelectedJobForms] = useState<number[]>(
    jobData.jobForms?.map((jobForm) => jobForm.id) ?? [],
  );

  const handleClientIdChange = (id: number, name: string) => {
    setClientId(id);
    setClientName(name);
  };

  const fetcher = (url: string) => fetch(url).then((res) => res.json());
  const { data, isLoading, error } = useSWR(
    () => (clientId ? `/api/clients/${clientId}` : null),
    (url) => fetcher(url),
    {
      onSuccess: (data) => {
        setClientName(
          data.client?.company_name || data.client?.contacts[0].name || 'Client Name',
        );
      },
    },
  );

  const client = data?.client as Client;
  const autofillText = clientName
    ? `${clientName} ${client?.properties[0].zip}`
    : '';

  const form = useForm<z.infer<typeof CreateJobFormSchema>>({
    resolver: zodResolver(CreateJobFormSchema),
    defaultValues: {
      title: jobData.title,
      jobType: jobData.job_type,
      instructions: jobData.instructions,
      startTime: jobData.start_time || '',
      endTime: jobData.end_time || '',
      jobForms: [],
    },
  });

  return (
    <Form {...form}>
      <form action={action}>
        <div className="my-2 flex flex-wrap gap-x-2">
          <h1
            className={cn('text-3xl font-bold', {
              'mr-1': clientName === 'Client Name' && isLoading,
            })}
          >
            Edit Job for
          </h1>
          {clientName === 'Client Name' && isLoading ? (
            <div className="w-fit animate-pulse rounded-lg border-b-2 border-transparent bg-slate-100 text-3xl text-transparent">
              LOADING NAME
            </div>
          ) : (
            <SelectClient
              onChange={handleClientIdChange}
              clientName={clientName}
            />
          )}
        </div>

        <div className="flex w-full flex-col gap-x-6 gap-y-4 pt-2 md:flex-row">
          <div className="max-w-prose min-w-72 flex-1">
            <div className="grid gap-4">
              <div className="flex items-end gap-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="block">Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Job name" type="text" {...field} />
                      </FormControl>
                      {state?.errors?.title && (
                        <p className="text-sm text-red-500">
                          {state.errors.title}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  variant={'ghost'}
                  type="button"
                  className="px-2"
                  title="Autofill title"
                  onClick={() => form.setValue('title', autofillText)}
                  disabled={isLoading || !data}
                >
                  <ClipboardDocumentListIcon className="min-h-5 min-w-5" />
                </Button>
              </div>

              <FormField
                control={form.control}
                name="jobType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">Job type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger
                          className="mb-0"
                          aria-label="Select job type"
                        >
                          <SelectValue placeholder="Select a verified email to display" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="install">Install</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="site visit">Site visit</SelectItem>
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="jobType" value={field.value} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">Instructions</FormLabel>
                    <FormControl>
                      <Textarea className="col-span-3" {...field} />
                    </FormControl>
                    {state?.errors?.instructions && (
                      <p className="text-sm text-red-500">
                        {state.errors.instructions}
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
                  <FormItem className="flex flex-col">
                    <FormLabel htmlFor="dates">Start - End</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="dates"
                          variant={'outline'}
                          className={cn(
                            'w-[300px] justify-start text-left font-normal',
                            !date && 'text-muted-foreground',
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date?.from ? (
                            date.to &&
                            date.from.getTime() != date.to.getTime() ? ( // If dates are equal only show from date
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

            <div className="mt-4 grid gap-4">
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
                            value={field.value}
                            onChange={field.onChange}
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
                            value={field.value}
                            onChange={field.onChange}
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
                      <FormControl aria-label="All day checkbox">
                        <Checkbox
                          name="allDayCheckbox"
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
            <div className="mt-4 hidden max-w-prose justify-between gap-4 md:flex">
              <DeleteButton
                deleteFunction={() => deleteJob(jobId)}
                entity={'job'}
              />
              <SubmitButton type="submit">Submit</SubmitButton>
            </div>
          </div>
          <Separator
            orientation="vertical"
            className="my-3 hidden h-auto md:block"
          />
          <Separator className="max-w-prose md:hidden" />
          <div className="mb-3">
            <FormField
              control={form.control}
              name="jobForms"
              render={({ field }) => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Job forms</FormLabel>
                    <FormDescription>
                      Select the forms you want team members to complete.
                    </FormDescription>
                  </div>
                  {jobForms.map((jobForm) => (
                    <FormField
                      key={jobForm.id}
                      control={form.control}
                      name="jobForms"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={jobForm.id}
                            className="flex flex-row items-center space-y-0 space-x-3"
                          >
                            <FormControl>
                              <Checkbox
                                checked={
                                  selectedJobForms.includes(jobForm.id) || false
                                }
                                onCheckedChange={(checked) => {
                                  const updatedJobForms = checked
                                    ? [...selectedJobForms, jobForm.id]
                                    : selectedJobForms.filter(
                                        (id) => id !== jobForm.id,
                                      );
                                  setSelectedJobForms(updatedJobForms);
                                  form.setValue('jobForms', updatedJobForms);
                                }}
                              />
                            </FormControl>
                            <FormLabel className="">{jobForm.name}</FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                  <input
                    type="hidden"
                    name="jobForms"
                    value={JSON.stringify(selectedJobForms)}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="mt-4 flex max-w-prose justify-between gap-4 md:hidden">
          <DeleteButton
            deleteFunction={() => deleteJob(jobId)}
            entity={'job'}
          />
          <SubmitButton type="submit">Submit</SubmitButton>
        </div>
      </form>
    </Form>
  );
}
