'use client';

import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../shadcn/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shadcn/components/ui/select';
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
import { Button } from '../../shadcn/components/ui/button';
import { addClientActivity, editProperty } from '@/app/lib/actions';
import { Client, AddPropertyFormSchema } from '@/app/lib/definitions';

export default function AddPropertyDialog({
  property,
  clientId,
}: {
  property: Client['properties'][0];
  clientId: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof AddPropertyFormSchema>>({
    resolver: zodResolver(AddPropertyFormSchema),
    defaultValues: {
      street1: property.street_1,
      street2: property.street_2 == null ? undefined : property.street_2,
      city: property.city,
      state: property.state,
      zipCode: property.zip,
      country: property.country,
      operatingHours: property.operating_hours,
    },
  });

  async function onSubmit() {
    setLoading(true);
    const result = await editProperty(property.id, form.getValues());
    if (!result?.errors) {
      form.reset(form.getValues());
      setOpen(false);
      await addClientActivity(clientId, 'Edited property');
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={'secondary'}
          size={'sm'}
          className="block overflow-hidden bg-slate-200 text-ellipsis hover:bg-slate-300"
        >
          Edit property
        </Button>
      </DialogTrigger>
      <DialogContent className="block h-full max-h-screen max-w-full gap-0 overflow-y-auto sm:h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-3">
            Edit property {property.street_1}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
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
                      <FormControl>
                        <SelectTrigger className="mb-0">
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
                    <FormLabel className="block">Operating hours</FormLabel>
                    <FormControl>
                      <Input placeholder="Hours" type="text" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-3">
              <Button type={'submit'} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Editing...
                  </>
                ) : (
                  'Edit property'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
