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
} from '../shadcn/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '../shadcn/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import { useForm } from 'react-hook-form';
import { createTax } from '@/app/lib/actions';
import { Input } from '../shadcn/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CreateTaxFormSchema } from '@/app/lib/definitions';
import SubmitButtonWithLoader from '../submit-button-with-loader';

const percentFormatter = new Intl.NumberFormat('en-ES', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default function CreateTax() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger className="hidden md:block">
          <PlusIcon className="text-muted-foreground h-5 w-5 transition-all hover:scale-110 hover:text-black"></PlusIcon>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Create new tax</DialogTitle>
          <CreateTaxForm onFormSubmit={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger className="md:hidden">
          <PlusIcon className="text-muted-foreground h-5 w-5 transition-all hover:scale-110 hover:text-black"></PlusIcon>
        </DrawerTrigger>
        <DrawerContent className="hide-handle">
          <DrawerHeader className="justify-start">
            <DrawerTitle>Create new tax</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 pt-0">
            <CreateTaxForm onFormSubmit={() => setDrawerOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function CreateTaxForm({ onFormSubmit }: { onFormSubmit: () => void }) {
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof CreateTaxFormSchema>>({
    resolver: zodResolver(CreateTaxFormSchema),
    defaultValues: {
      taxName: '',
      taxRate: '0',
    },
  });

  async function onSubmit(values: z.infer<typeof CreateTaxFormSchema>) {
    setLoading(true);
    try {
      await createTax(values);
      onFormSubmit();
      form.reset({ taxName: '', taxRate: '0' });
    } catch (err) {
      console.log('Error creating tax:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mb-4 flex flex-col gap-4">
            <FormField
              control={form.control}
              name="taxName"
              render={({ field }) => (
                <FormItem>
                  <FormMessage />
                  <FormLabel className="block">Tax name</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Tax name"
                      required
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taxRate"
              render={({ field }) => (
                <FormItem>
                  <FormMessage />
                  <FormLabel className="block">
                    Tax rate{' '}
                    <span className="text-muted-foreground">(as percent)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      max={1000}
                      min={0}
                      step={0.01}
                      type="number"
                      onChange={(e) => {
                        form.setValue('taxRate', e.target.value);
                      }}
                      onBlur={(e) => {
                        const formattedTaxRate = percentFormatter.format(
                          Number(e.target.value),
                        );
                        form.setValue('taxRate', formattedTaxRate);
                      }}
                      value={field.value}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <SubmitButtonWithLoader
            onClick={(event) => {
              event.stopPropagation(); // Prevent submission of quote form
              form.handleSubmit(onSubmit)();
            }}
            loading={loading}
          >
            Create tax
          </SubmitButtonWithLoader>
        </form>
      </Form>
    </div>
  );
}
