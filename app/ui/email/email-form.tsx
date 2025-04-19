'use client';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../shadcn/components/ui/form';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../shadcn/components/ui/dropdown-menu';
import { z } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { getCurrentUser } from '@/app/lib/data';
import { Input } from '../shadcn/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../shadcn/components/ui/button';
import { Textarea } from '../shadcn/components/ui/textarea';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

/**
 * A form component for composing and sending emails
 * @param defaultSubject: Optional default subject for the email
 * @param defaultBody: Optional default body for the email
 * @param data: Optional string data to be included, should be stringified JSON data
 * @param autofillOptions: Optional array of email addresses for autofill suggestions
 * @param template: Optional email template to be used for the email body
 * @param replyTo: Optional reply-to email address
 * @param onSend: Optional callback function to be called after sending the email, with the email details
 */
export default function EmailForm({
  defaultSubject,
  defaultBody,
  data = '',
  autofillOptions,
  template,
  replyTo,
  onSend,
}: {
  defaultSubject?: string;
  defaultBody?: string;
  data?: string;
  autofillOptions?: string[];
  template?: string;
  replyTo?: string;
  onSend?: (
    uuid: string,
    sender: string,
    recipient: string,
    subject: string,
    body: string,
  ) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileSchema = z.object({
    filename: z.string(),
    content: z.any(),
  });

  const emailFormSchema = z.object({
    to: z.string().email({ message: 'Email must be in correct format' }),
    subject: z.string().optional(),
    body: z.string().optional(),
    files: z.array(fileSchema).optional(),
  });

  const form = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      to: '',
      subject: defaultSubject || '',
      body: defaultBody || '',
      files: undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof emailFormSchema>) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const currentUserName = (await getCurrentUser()).name;
      const response = await fetch('/api/send', {
        method: 'POST',
        body: JSON.stringify({
          from: currentUserName,
          to: values.to,
          replyTo: replyTo,
          subject: values.subject,
          body: values.body,
          attachments: values.files,
          template: template,
          data: data,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('Email sent successfully!');
        onSend?.(
          result.id,
          `${currentUserName} <support@rmsfitness.com>`,
          values.to,
          values.subject || '',
          values.body || '',
        );
        form.reset();
      } else {
        setError(result.error || 'Something went wrong!');
      }
    } catch (err) {
      setError('Failed to send request.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex max-w-3xl flex-col gap-3">
            <div className="mt-2 flex justify-between rounded-md border border-gray-200">
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem className="flex flex-1 items-center">
                    <FormLabel className="text-muted-foreground mx-2 mb-0 min-w-2 font-normal">
                      To
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder=""
                        className="mt-0! ml-2 border-none"
                        type="text"
                        {...field}
                      />
                    </FormControl>

                    <FormMessage className="mt-0! w-fit p-1 px-3 text-sm" />
                  </FormItem>
                )}
              />
              {autofillOptions && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild className="hidden md:block">
                      <Button
                        variant={'ghost'}
                        type="button"
                        className="ml-1.5 px-2"
                        title="Autofill title"
                      >
                        <ClipboardDocumentListIcon className="min-h-5 min-w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Client emails</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        {autofillOptions.map((option, index) => (
                          <DropdownMenuItem
                            key={index}
                            className="pr-6"
                            onClick={() => form.setValue('to', option)}
                          >
                            {option}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Drawer>
                    <DrawerTrigger asChild className="md:hidden">
                      <Button
                        variant={'ghost'}
                        type="button"
                        className="ml-1.5 px-2"
                        title="Autofill title"
                      >
                        <ClipboardDocumentListIcon className="min-h-5 min-w-5" />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent className="hide-handle pb-3">
                      <DrawerHeader>
                        <DrawerTitle>Client emails</DrawerTitle>
                        <DrawerDescription>
                          Select an email to autofill
                        </DrawerDescription>
                      </DrawerHeader>
                      {autofillOptions.map((option, index) => (
                        <DrawerClose
                          key={index}
                          onClick={() => form.setValue('to', option)}
                          className="mb-3"
                        >
                          {option}
                        </DrawerClose>
                      ))}
                    </DrawerContent>
                  </Drawer>
                </>
              )}
            </div>
            <div className="rounded-md border border-gray-200">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem className="flex items-center">
                    <FormControl>
                      <Input
                        placeholder="Subject"
                        className="mt-0! rounded-t-md rounded-b-none border-x-0 border-t-0"
                        type="text"
                        {...field}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem className="flex items-center">
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Message"
                        className="field-sizing-content border-none"
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="files"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormControl className="rounded-t-none border-x-0 border-t border-b-0 px-3">
                        <Input
                          type="file"
                          multiple
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                              Promise.all(
                                Array.from(files).map(async (file) => ({
                                  filename: file.name,
                                  content: Buffer.from(
                                    await file.arrayBuffer(),
                                  ).toString('base64'),
                                })),
                              ).then((filesArray) => {
                                field.onChange(filesArray);
                              });
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <Button className="w-fit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Email'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
