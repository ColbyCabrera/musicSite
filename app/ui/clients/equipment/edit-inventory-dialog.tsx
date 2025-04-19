'use client';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../shadcn/components/ui/form';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '../../shadcn/components/ui/input';
import { Button } from '../../shadcn/components/ui/button';
import { Textarea } from '../../shadcn/components/ui/textarea';
import { Separator } from '../../shadcn/components/ui/separator';
import { addClientActivity, editInventory } from '@/app/lib/actions';
import { Inventory, EditInventoryFormSchema } from '@/app/lib/definitions';

export default function EditInventoryDialog({
  inventory,
  clientId,
}: {
  inventory: Inventory;
  clientId: number;
}) {
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof EditInventoryFormSchema>>({
    resolver: zodResolver(EditInventoryFormSchema),
    defaultValues: {
      treadmill: inventory ? inventory.treadmill : 0,
      elliptical: inventory ? inventory.elliptical : 0,
      bike: inventory ? inventory.bike : 0,
      stepper: inventory ? inventory.stepper : 0,
      strength: inventory ? inventory.strength : 0,
      bench: inventory ? inventory.bench : 0,
      spinner: inventory ? inventory.spinner : 0,
      rower: inventory ? inventory.rower : 0,
      miscellaneous: inventory ? inventory.miscellaneous : undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof EditInventoryFormSchema>) {
    const result = await editInventory(clientId, form.getValues());
    if (!result?.errors) {
      setOpen(false);
      await addClientActivity(clientId, 'Edited inventory');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-0 w-fit overflow-hidden py-0 opacity-0 transition-all delay-100 duration-200 group-hover:mt-3 group-hover:h-9 group-hover:py-2 group-hover:opacity-100">
          Edit inventory
        </Button>
      </DialogTrigger>
      <DialogContent className="block h-full max-h-screen max-w-full gap-0 overflow-y-auto sm:h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit inventory</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex grow flex-col justify-between gap-2 pb-2 pt-3">
              <div className="grid w-36 gap-2 pt-3">
                <FormField
                  control={form.control}
                  name="treadmill"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className='mb-0'>Treadmills</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          className="mt-0!"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="elliptical"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className='mb-0'>Ellipticals</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          className="mt-0!"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bike"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className='mb-0'>Bikes</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          className="mt-0!"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stepper"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className='mb-0'>Steppers</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          className="mt-0!"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="strength"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className='mb-0'>Strength</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          className="mt-0!"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bench"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className='mb-0'>Benches</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          className="mt-0!"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="spinner"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className='mb-0'>Spinners</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          className="mt-0!"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rower"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormLabel className='mb-0'>Rowers</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          className="mt-0!"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Separator className="my-3"></Separator>
              <FormField
                control={form.control}
                name="miscellaneous"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className='block'>Miscellaneous</FormLabel>
                    <FormControl>
                      <Textarea
                        className="field-sizing-content"
                        placeholder="(Optional)"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-2">
              <Button type="submit">Edit inventory</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
