'use client';

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../shadcn/components/ui/form';
import { z } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { addProperty } from '@/app/lib/actions';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../../shadcn/components/ui/input';
import { Button } from '../../shadcn/components/ui/button';
import { useToast } from '../../shadcn/components/ui/use-toast';
import { AddPropertyFormSchema } from '@/app/lib/definitions';

export default function AddPropertyDialog({ clientId }: { clientId: number }) {
  const [open, setOpen] = useState(false);

  const { toast } = useToast();

  const form = useForm<z.infer<typeof AddPropertyFormSchema>>({
    resolver: zodResolver(AddPropertyFormSchema),
    defaultValues: {
      street1: '',
      street2: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'United States',
      operatingHours: '',
    },
  });

  async function onSubmit(values: z.infer<typeof AddPropertyFormSchema>) {
    const result = await addProperty(clientId, form.getValues());
    if (!result?.errors) {
      setOpen(false);
      form.reset(form.getValues());
      toast({
        title: 'New property added',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={'secondary'}
          className="bg-slate-200 hover:bg-slate-300"
        >
          Add property
        </Button>
      </DialogTrigger>
      <DialogContent className="block h-full max-h-screen max-w-full gap-0 overflow-y-auto sm:h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add new property</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex grow flex-col justify-between gap-2 pb-2 pt-3">
              <div className="flex flex-col ">
                <FormField
                  control={form.control}
                  name="street1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street address</FormLabel>
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
                    <FormLabel>City</FormLabel>
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
                    <FormLabel>State</FormLabel>
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
                    <FormLabel>Zip code</FormLabel>
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
                    <FormLabel>Country</FormLabel>
                    <Select onValueChange={field.onChange}>
                      <FormControl>
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
                    <FormLabel>Operating Hours</FormLabel>
                    <FormControl>
                      <Input placeholder="Hours" type="text" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-3">
              <Button type="submit">Add property</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
