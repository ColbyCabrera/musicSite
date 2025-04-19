'use client';

import {
  ChevronUpDownIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../shadcn/components/ui/tabs';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/ui/shadcn/components/ui/form';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import SelectTags from './tags/select-tags';
import { deleteClient, editClient } from '@/app/lib/actions';
import DeleteButton from '../delete-button';
import { zodResolver } from '@hookform/resolvers/zod';
import { tagsToArray, tagsToString } from '@/app/lib/utils';
import { Textarea } from '../shadcn/components/ui/textarea';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import { Separator } from '../shadcn/components/ui/separator';
import { Client, EditClientFormSchema } from '@/app/lib/definitions';

export default function EditClientForm({
  client,
  tags,
  accountManagers,
}: {
  client: Client;
  tags: string[];
  accountManagers: string[];
}) {
  const [selected, setSelected] = useState(tagsToArray(client.tags));
  const [useText, setUseText] = useState(!client.account_manager);
  const [loading, setLoading] = useState(false);
  const [state, action] = useFormState(
    editClient.bind(null, client.id),
    undefined,
  );

  const form = useForm<z.infer<typeof EditClientFormSchema>>({
    resolver: zodResolver(EditClientFormSchema),
    defaultValues: {
      companyName: client.company_name,
      managementCompany: client.management_company || '',
      contractInfo: client.contract_information || '',
      billingInfo: client.billing_instructions || '',
      accountManager: client.account_manager || '',
    },
  });

  function onSubmit(data: z.infer<typeof EditClientFormSchema>) {
    setLoading(true);
    data.tags = tagsToString(selected);
    action(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-prose">
        <div className="grid max-w-96 gap-4 pt-5">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block">Company name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Company name (optional)"
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
                <FormLabel className="block">Management company</FormLabel>
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

          <div className="flex items-end gap-3">
            <FormField
              control={form.control}
              name="accountManager"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="block">
                    Account manager{' '}
                    <span className="text-muted-foreground">(Optional)</span>
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
                <ChevronUpDownIcon className="min-h-5 min-w-5" />
              ) : (
                <PencilSquareIcon className="min-h-5 min-w-5" />
              )}
            </Button>
          </div>
        </div>

        <Separator className="my-4" />

        <Tabs defaultValue="contractInfo" className="mb-4">
          <TabsList className="flex h-fit w-fit flex-wrap justify-start">
            <TabsTrigger className="flex-1" value="contractInfo">
              Contract information
            </TabsTrigger>
            <TabsTrigger className="flex-1" value="billingInfo">
              Billing instructions
            </TabsTrigger>
          </TabsList>
          <TabsContent value="contractInfo" className="pt-2">
            <FormField
              control={form.control}
              name="contractInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block">
                    Contract information{' '}
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
                    <p className="text-sm text-red-500">
                      {state.errors.contractInfo}
                    </p>
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
                    Billing instructions{' '}
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
                    <p className="text-sm text-red-500">
                      {state.errors.billingInfo}
                    </p>
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
        <div className="flex justify-between">
          <DeleteButton
            className="mt-4"
            deleteFunction={() => deleteClient(client.id)}
            entity={'client'}
          />
          <Button type={'submit'} disabled={loading} className="mt-4">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Editing...
              </>
            ) : (
              'Edit client'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
