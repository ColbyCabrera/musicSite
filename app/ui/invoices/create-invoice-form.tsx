'use client';

import clsx from 'clsx';
import {
  Client,
  CreateInvoiceFormSchema,
  QuoteFormData,
  Tax,
} from '@/app/lib/definitions';
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
import useSWR from 'swr';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { cn } from '@/app/ui/shadcn/lib/utils';
import { SubmitButton } from '../submit-button';
import { createInvoice } from '@/app/lib/actions';
import { useSearchParams } from 'next/navigation';
import SelectClient from '../clients/select-client';
import { zodResolver } from '@hookform/resolvers/zod';
import CreateQuoteForm from '../quotes/create-quote-form';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import { Textarea } from '@/app/ui/shadcn/components/ui/textarea';
import ClipboardDocumentListIcon from '@heroicons/react/24/outline/ClipboardDocumentListIcon';

export default function CreateInvoiceForm({ taxes }: { taxes: Tax[] }) {
  const quoteId = Number(useSearchParams().get('quote')) || null;
  const [quoteData, setQuoteData] = useState<QuoteFormData | null>(null);
  const [clientName, setClientName] = useState<string>('Client Name');
  const initialClientId = Number(useSearchParams().get('client'));
  const [clientId, setClientId] = useState<number | null>(
    initialClientId || null,
  );

  const [state, action] = useFormState(
    createInvoice.bind(null, false, clientId, quoteId, quoteData),
    undefined,
  );

  const handleClientIdChange = (id: number, name: string) => {
    setClientId(id);
    setClientName(name);
  };

  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  const { data, isLoading, error } = useSWR<{ client: Client }>(
    () => (clientId ? `/api/clients/${clientId}?form=job` : null),
    fetcher,
    {
      onSuccess: (data) => {
        setClientName(
          data.client?.company_name || data.client?.contacts[0].name || '',
        );
      },
    },
  );

  const client = data?.client as Client;
  const autofillText = clientName
    ? `${clientName} ${client?.properties[0].zip}`
    : '';

  const form = useForm<z.infer<typeof CreateInvoiceFormSchema>>({
    resolver: zodResolver(CreateInvoiceFormSchema),
    defaultValues: {
      title: '',
      paymentMethod: 'credit card',
      notes: '',
    },
  });

  return (
    <Form {...form}>
      <form action={action}>
        <div className="my-2 mb-8 flex flex-wrap gap-x-2">
          <h1
            className={cn('text-3xl font-bold', {
              'mr-1': clientName === 'Client Name' && isLoading,
            })}
          >
            Create Invoice for
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

        {quoteId ? (
          <div className="flex w-full flex-col gap-x-6 gap-y-4 md:flex-row"></div>
        ) : (
          <Tabs defaultValue="jobForm">
            <TabsList className="mb-6 grid grid-cols-2 md:w-56">
              <TabsTrigger value="jobForm">Invoice</TabsTrigger>
              <TabsTrigger value="quoteForm" disabled={!clientId}>
                Line items
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="jobForm"
              className="data-[state=inactive]:hidden"
              forceMount={true}
            >
              <div className="grid max-w-prose gap-4">
                <div className="flex items-end gap-2">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="block">Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Invoice name"
                            type="text"
                            {...field}
                          />
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
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block">Payment method</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="mb-0">
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="check">Check</SelectItem>
                          <SelectItem value="credit card">
                            Credit card
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <input
                        type="hidden"
                        name="paymentMethod"
                        value={field.value}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block">Notes</FormLabel>
                      <FormControl>
                        <Textarea className="field-sizing-content" {...field} />
                      </FormControl>
                      {state?.errors?.notes && (
                        <p className="text-sm text-red-500">
                          {state.errors.notes}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </TabsContent>
            <TabsContent
              value="quoteForm"
              className="data-[state=inactive]:hidden"
              forceMount={true}
            >
              <div
                className={clsx('mb-2', {
                  'pointer-events-none opacity-60': !clientId,
                })}
              >
                <CreateQuoteForm
                  taxes={taxes}
                  asSubForm={true}
                  onQuoteChange={(quoteData) => setQuoteData(quoteData)}
                />
              </div>
            </TabsContent>
          </Tabs>
        )}
        <FormMessage className="my-3 whitespace-pre-wrap">
          {state?.message?.replace(',', ',\n')}
        </FormMessage>
        <SubmitButton className="mt-4">Submit</SubmitButton>
      </form>
    </Form>
  );
}
