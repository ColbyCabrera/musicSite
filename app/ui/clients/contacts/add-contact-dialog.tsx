'use client';

import { z } from 'zod';
import { useState } from 'react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../shadcn/components/ui/form';
import { useForm } from 'react-hook-form';
import { cn } from '../../shadcn/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/ui/shadcn/components/ui/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../../shadcn/components/ui/input';
import { ContactFormSchema } from '@/app/lib/definitions';
import { Button } from '../../shadcn/components/ui/button';
import PlusIcon from '@heroicons/react/24/outline/PlusIcon';
import { useToast } from '../../shadcn/components/ui/use-toast';
import { addClientActivity, addContact } from '@/app/lib/actions';
import { Loader2 } from 'lucide-react';

export default function AddPropertyDialog({ clientId }: { clientId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedPhones, setExpandedPhones] = useState(false);
  const [expandedEmails, setExpandedEmails] = useState(false);

  const { toast } = useToast();

  const form = useForm<z.infer<typeof ContactFormSchema>>({
    resolver: zodResolver(ContactFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      phone2: '',
      phone3: '',
      phone4: '',
      email: '',
      email2: '',
      email3: '',
      email4: '',
      position: '',
    },
  });

  async function onSubmit(values: z.infer<typeof ContactFormSchema>) {
    setLoading(true);
    const result = await addContact(clientId, form.getValues());
    if (!result?.errors) {
      form.reset({
        firstName: '',
        lastName: '',
        phone: '',
        phone2: '',
        phone3: '',
        phone4: '',
        email: '',
        email2: '',
        email3: '',
        email4: '',
        position: '',
      });
      setOpen(false);
      toast({
        title: 'New contact added',
      });
      await addClientActivity(clientId, 'Added new contact');
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={'secondary'}
          size={'sm'}
          className="block overflow-hidden text-ellipsis bg-slate-200 hover:bg-slate-300"
        >
          Add contact
        </Button>
      </DialogTrigger>
      <DialogContent className="block h-full max-h-screen max-w-full gap-0 overflow-y-auto sm:h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add new contact</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex grow flex-col justify-between gap-2 pb-2 pt-3">
              <div className="grid gap-4 pt-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='block'>First name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="First name"
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
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='block'>Last name</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" type="text" {...field} />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <div className="flex items-end gap-3">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className='block'>Phone</FormLabel>
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
                    <Button
                      variant={'secondary'}
                      type="button"
                      onClick={() => setExpandedPhones(!expandedPhones)}
                    >
                      <PlusIcon
                        className={cn(
                          'h-5 w-5 transition-all duration-200 hover:scale-110',
                          {
                            'rotate-45': expandedPhones,
                          },
                        )}
                      />
                    </Button>
                  </div>

                  <div
                    className={cn(
                      'invisible mt-0 flex max-h-0 flex-col gap-4 overflow-y-clip opacity-0 transition-all ease-in-out',
                      {
                        'visible mt-3 max-h-64 pb-1 opacity-100':
                          expandedPhones,
                      },
                    )}
                  >
                    <FormField
                      control={form.control}
                      name="phone2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='block'>Phone 2</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              {...field}
                              placeholder="(Optional)"
                              className="space-y-0"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone3"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='block'>Phone 3</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              {...field}
                              placeholder="(Optional)"
                              className="space-y-0"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone4"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='block'>Phone 4</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              {...field}
                              placeholder="(Optional)"
                              className="space-y-0"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-end gap-3">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className='block'>Email</FormLabel>
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
                    <Button
                      variant={'secondary'}
                      type="button"
                      onClick={() => setExpandedEmails(!expandedEmails)}
                    >
                      <PlusIcon
                        className={cn(
                          'h-5 w-5 transition-all duration-200 hover:scale-110',
                          {
                            'rotate-45': expandedEmails,
                          },
                        )}
                      />
                    </Button>
                  </div>

                  <div
                    className={cn(
                      'invisible mt-0 flex max-h-0 flex-col gap-4 overflow-y-clip opacity-0 transition-all ease-in-out',
                      {
                        'visible mt-3 max-h-64 pb-1 opacity-100':
                          expandedEmails,
                      },
                    )}
                  >
                    <FormField
                      control={form.control}
                      name="email2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='block'>Email 2</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              {...field}
                              placeholder="(optional)"
                              className="space-y-0"
                            />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email3"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='block'>Email 3</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              {...field}
                              placeholder="(optional)"
                              className="space-y-0"
                            />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email4"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='block'>Email 4</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
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

                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='block'>Position</FormLabel>
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

            <DialogFooter className="mt-2">
              <Button type={'submit'} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add contact'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
