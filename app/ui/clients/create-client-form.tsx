'use client';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../shadcn/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/ui/shadcn/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/ui/shadcn/components/ui/select';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import SelectTags from './tags/select-tags';
import { tagsToString } from '@/app/lib/utils';
import { createClient } from '@/app/lib/actions';
import { zodResolver } from '@hookform/resolvers/zod';
import { Textarea } from '../shadcn/components/ui/textarea';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import { Separator } from '../shadcn/components/ui/separator';
import { CreateClientFormSchema } from '@/app/lib/definitions';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { Checkbox } from '@/app/ui/shadcn/components/ui/checkbox';
import PencilSquareIcon from '@heroicons/react/24/outline/PencilSquareIcon';

export default function CreateClientForm({
  tags,
  accountManagers,
}: {
  tags: string[];
  accountManagers: string[];
}) {
  const initial: string[] = [];
  const [selected, setSelected] = useState(initial);
  const [useText, setUseText] = useState(false);
  const [loading, setLoading] = useState(false);
  const [state, action] = useFormState(createClient, undefined);

  const form = useForm<z.infer<typeof CreateClientFormSchema>>({
    resolver: zodResolver(CreateClientFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      companyName: '',
      managementCompany: '',
      isCompany: false,
      phone: '',
      email: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'United States',
      operatingHours: '',
      accountManager: '',
    },
  });

  function onSubmit(data: z.infer<typeof CreateClientFormSchema>) {
    setLoading(true);
    data.tags = tagsToString(selected);
    action(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-prose">
        <div className="flex flex-wrap justify-stretch gap-x-8">
          <div>
            <h2 className="mt-4 h-fit text-xl font-semibold text-slate-800">
              Client details
            </h2>
            <div className="grid gap-4 pt-3 pb-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="First name" type="text" {...field} />
                    </FormControl>
                    {state?.errors?.firstName && (
                      <p className="text-sm text-red-500">
                        {state.errors.firstName}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Last name" type="text" {...field} />
                    </FormControl>
                    {state?.errors?.lastName && (
                      <p className="text-sm text-red-500">
                        {state.errors.lastName}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">Display Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Display name (optional)"
                        type="text"
                        {...field}
                      />
                    </FormControl>
                    {state?.errors?.companyName && (
                      <p className="text-sm text-red-500">
                        {state.errors.companyName}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="managementCompany"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">Management Company</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Management company (optional)"
                        type="text"
                        {...field}
                      />
                    </FormControl>
                    {state?.errors?.managementCompany && (
                      <p className="text-sm text-red-500">
                        {state.errors.managementCompany}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isCompany"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-y-0 space-x-3 py-4">
                    <FormControl aria-label="Company name is primary name checkbox">
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="block">
                        Use company name as primary name
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <div className="pb-2">
                <p className="pb-2 text-sm font-medium">Phone</p>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="tel"
                          {...field}
                          placeholder="Phone number"
                          className="space-y-0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {state?.errors?.phone && (
                  <p className="text-sm text-red-500">{state.errors.phone}</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Email</p>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          placeholder="Email"
                          className="space-y-0"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Position</p>
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="text"
                          {...field}
                          placeholder="(optional)"
                          className="space-y-0"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-stretch">
            <h2 className="mt-4 text-xl font-semibold text-slate-800">
              Property details
            </h2>
            <div className="flex grow flex-col justify-between gap-4 pt-3 pb-2">
              <div className="flex flex-col">
                <FormField
                  control={form.control}
                  name="street1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block">Street address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Street 1"
                          type="text"
                          className="rounded-b-none"
                          {...field}
                        />
                      </FormControl>
                      {state?.errors?.street1 && (
                        <p className="text-sm text-red-500">
                          {state.errors.street1}
                        </p>
                      )}
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="street2"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Street 2"
                          type="text"
                          className="rounded-t-none border-t-0"
                          {...field}
                        />
                      </FormControl>
                      {state?.errors?.street2 && (
                        <p className="text-sm text-red-500">
                          {state.errors.street2}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">City</FormLabel>
                    <FormControl>
                      <Input placeholder="City" type="text" {...field} />
                    </FormControl>
                    {state?.errors?.city && (
                      <p className="text-sm text-red-500">
                        {state.errors.city}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">State</FormLabel>
                    <FormControl>
                      <Input placeholder="State" type="text" {...field} />
                    </FormControl>
                    {state?.errors?.state && (
                      <p className="text-sm text-red-500">
                        {state.errors.state}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">Zip code</FormLabel>
                    <FormControl>
                      <Input placeholder="Zip code" type="text" {...field} />
                    </FormControl>
                    {state?.errors?.zipCode && (
                      <p className="text-sm text-red-500">
                        {state.errors.zipCode}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">Country</FormLabel>
                    <Select onValueChange={field.onChange}>
                      <FormControl aria-label="Select Country dropdown">
                        <SelectTrigger>
                          <SelectValue placeholder="United States" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="United States">
                          United States
                        </SelectItem>
                        <SelectItem value="United Kingdom">
                          United Kingdom
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="operatingHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">Operating Hours</FormLabel>
                    <FormControl>
                      <Input placeholder="Hours" type="text" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex items-end gap-3">
                <FormField
                  control={form.control}
                  name="accountManager"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="block">
                        Account manager{' '}
                        <span className="text-muted-foreground">
                          (Optional)
                        </span>
                      </FormLabel>
                      {useText ? (
                        <FormControl>
                          <Input
                            placeholder="Account manager"
                            type="text"
                            {...field}
                          />
                        </FormControl>
                      ) : (
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="mb-0">
                              <SelectValue placeholder="Select an account manager" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accountManagers.map((accountManager) => {
                              return (
                                <SelectItem
                                  value={accountManager}
                                  key={accountManager}
                                >
                                  {accountManager}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant={'secondary'}
                  onClick={() => setUseText(!useText)}
                >
                  {useText ? (
                    <ChevronUpDownIcon className="min-h-5 min-w-5"></ChevronUpDownIcon>
                  ) : (
                    <PencilSquareIcon className="min-h-5 min-w-5"></PencilSquareIcon>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <Tabs defaultValue="contractInfo" className="mb-4">
          <TabsList className="flex h-fit w-fit flex-wrap justify-start">
            <TabsTrigger className="flex-1" value="contractInfo">
              Contract Information
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="billingInfo">
              Billing Instructions
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="notes">
              Notes
            </TabsTrigger>
          </TabsList>
          <TabsContent value="contractInfo" className="pt-2">
            <FormField
              control={form.control}
              name="contractInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block">
                    Contract Information{' '}
                    <span className="text-muted-foreground">(Optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      className="field-sizing-content"
                      {...field}
                    />
                  </FormControl>
                  {state?.errors?.contractInfo && (
                    <p className="text-sm text-red-500">{state.errors.notes}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
          <TabsContent value="billingInfo" className="pt-2">
            <FormField
              control={form.control}
              name="billingInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block">
                    Billing Instructions{' '}
                    <span className="text-muted-foreground">(Optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      className="field-sizing-content"
                      {...field}
                    />
                  </FormControl>
                  {state?.errors?.billingInfo && (
                    <p className="text-sm text-red-500">{state.errors.notes}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
          <TabsContent value="notes" className="pt-2">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block">
                    Notes{' '}
                    <span className="text-muted-foreground">(Optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      className="field-sizing-content"
                      {...field}
                    />
                  </FormControl>
                  {state?.errors?.notes && (
                    <p className="text-sm text-red-500">{state.errors.notes}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>
        <SelectTags
          tags={tags}
          selected={selected}
          onChange={(tags: string[]) => setSelected(tags)}
        />
        <Button type={'submit'} disabled={loading} className="mt-4">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create client'
          )}
        </Button>
      </form>
    </Form>
  );
}
