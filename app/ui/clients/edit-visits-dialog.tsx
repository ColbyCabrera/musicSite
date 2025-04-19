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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/ui/shadcn/components/ui/dialog';
import { z } from 'zod';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../shadcn/components/ui/input';
import { Button } from '../shadcn/components/ui/button';
import { addClientActivity, editVisits } from '@/app/lib/actions';
import { Client, EditVisitsFormSchema } from '@/app/lib/definitions';

export default function EditVisitsDialog({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof EditVisitsFormSchema>>({
    resolver: zodResolver(EditVisitsFormSchema),
    defaultValues: {
      nextVisit: client?.next_visit ? client.next_visit : undefined,
      lastVisit: client?.last_visit ? client.last_visit : undefined,
      specialSchedule: client?.maintenance_schedule
        ? client.maintenance_schedule
        : undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof EditVisitsFormSchema>) {
    setLoading(true);
    const result = await editVisits(client.id, form.getValues());
    if (!result?.errors) {
      form.reset(form.getValues());
      setOpen(false);
      await addClientActivity(client.id, 'Edited maintenance information');
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={'secondary'}>Edit visits</Button>
      </DialogTrigger>
      <DialogContent className="block h-full max-h-screen max-w-full gap-0 overflow-y-auto sm:h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit visits section</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="mb-4 grid gap-4 pt-6">
              <FormField
                control={form.control}
                name="nextVisit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">Next visit</FormLabel>
                    <FormControl>
                      <Input placeholder="Next visit" type="text" {...field} />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastVisit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">Last visit</FormLabel>
                    <FormControl>
                      <Input placeholder="Last visit" type="text" {...field} />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialSchedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">
                      Special Maintenace Schedule
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Schedule" type="text" {...field} />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type={'submit'} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Editing...
                  </>
                ) : (
                  'Edit visit'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
