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
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../shadcn/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import { useForm } from 'react-hook-form';
import { moneyFormatter } from '@/app/lib/utils';
import { Input } from '../shadcn/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '../shadcn/components/ui/button';
import { getTemplateLineItemByName } from '@/app/lib/data';
import { createTemplateLineItem } from '@/app/lib/actions';
import { Textarea } from '../shadcn/components/ui/textarea';
import { Checkbox } from '../shadcn/components/ui/checkbox';
import { useToast } from '../shadcn/components/ui/use-toast';
import SubmitButtonWithLoader from '../submit-button-with-loader';
import { CreateTemplateLineItemFormSchema } from '@/app/lib/definitions';

export default function CreateTemplateLineItem() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger className="hidden justify-start md:block" asChild>
          <Button variant={'outline'} className="w-fit">
            <div className="group flex items-center gap-3">
              <p>Create template line item</p>
              <PlusIcon className="text-muted-foreground min-h-5 min-w-5 transition-all group-hover:scale-105" />
            </div>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Create new template line item</DialogTitle>
          <DialogDescription className="sr-only">
            Displays a form
          </DialogDescription>
          <CreateTemplateLineItemForm
            onFormSubmit={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger className="flex justify-start md:hidden" asChild>
          <Button variant={'outline'} className="w-fit">
            <div className="group flex items-center gap-3">
              <p>Create template line item</p>
              <PlusIcon className="text-muted-foreground min-h-5 min-w-5 transition-all group-hover:scale-105" />
            </div>
          </Button>
        </DrawerTrigger>
        <DrawerContent className="hide-handle">
          <DrawerHeader className="justify-start">
            <DrawerTitle>Create new template line item</DrawerTitle>
            <DrawerDescription className="sr-only"></DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pt-0">
            <CreateTemplateLineItemForm
              onFormSubmit={() => setDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function CreateTemplateLineItemForm({
  onFormSubmit,
}: {
  onFormSubmit: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();

  const form = useForm<z.infer<typeof CreateTemplateLineItemFormSchema>>({
    resolver: zodResolver(CreateTemplateLineItemFormSchema),
    defaultValues: {
      name: '',
      description: '',
      unitPrice: '$0.00',
      isTaxable: true,
    },
  });

  async function onSubmit(
    values: z.infer<typeof CreateTemplateLineItemFormSchema>,
  ) {
    setLoading(true);
    try {
      const exists = await getTemplateLineItemByName(values.name);
      if (exists) throw new Error('Template line item already exists');
      await createTemplateLineItem(values);
      onFormSubmit();
      form.reset({ name: '', description: '0', unitPrice: '$0.00' });
    } catch (err) {
      console.log('Error creating template line item:', err);
      toast({
        variant: 'destructive',
        title: 'Error creating template line item',
        description: `${err}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mb-4 flex flex-col gap-4">
            <div className="">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormMessage />
                    <FormLabel className="block">Product or service</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Name"
                        className="rounded-b-none border-b-0"
                        required
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormMessage />

                    <FormControl>
                      <Textarea
                        placeholder="Description"
                        className="field-sizing-content rounded-t-none"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="unitPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block">Unit price</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      value={field.value}
                      onBlur={(e) => {
                        const formattedUnitPrice = moneyFormatter.format(
                          Number(e.target.value.replace(/[^.\d]+/g, '')),
                        );
                        form.setValue('unitPrice', formattedUnitPrice);
                      }}
                      onChange={(e) => {
                        form.setValue('unitPrice', e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isTaxable"
              render={({ field }) => (
                <FormItem className="mb-4 flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mb-0"
                    />
                  </FormControl>
                  <FormLabel className="block">Is taxable</FormLabel>
                  <FormMessage />
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
            loadingText="Creating..."
          >
            Create template line item
          </SubmitButtonWithLoader>
        </form>
      </Form>
    </div>
  );
}
