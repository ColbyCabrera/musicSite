'use client';

import { z } from 'zod';
import {
  createDraftInvoice,
  createInvoice,
  updateJobStatus,
} from '@/app/lib/actions';
import {
  CardHeader,
  CardTitle,
  CardContent,
  Card,
} from '../shadcn/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../shadcn/components/ui/form';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shadcn/components/ui/select';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { MouseEvent, useReducer } from 'react';
import { Input } from '../shadcn/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../shadcn/components/ui/button';
import { Textarea } from '../shadcn/components/ui/textarea';
import SubmitButtonWithLoader from '../submit-button-with-loader';
import { CreateInvoiceFormSchema, JobData } from '@/app/lib/definitions';

type State = {
  openDialog: boolean;
  openDrawer: boolean;
  loadingNow: boolean;
  loadingLater: boolean;
  loadingIncomplete: boolean;
};

type Action =
  | { type: 'OPEN_DIALOG'; payload: boolean }
  | { type: 'OPEN_DRAWER'; payload: boolean }
  | { type: 'LOADING_NOW'; payload: boolean }
  | { type: 'LOADING_LATER'; payload: boolean }
  | { type: 'LOADING_INCOMPLETE'; payload: boolean };

// Define the reducer function
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'OPEN_DIALOG':
      return { ...state, openDialog: action.payload };
    case 'OPEN_DRAWER':
      return { ...state, openDrawer: action.payload };
    case 'LOADING_NOW':
      return { ...state, loadingNow: action.payload };
    case 'LOADING_LATER':
      return { ...state, loadingLater: action.payload };
    case 'LOADING_INCOMPLETE':
      return { ...state, loadingIncomplete: action.payload };
    default:
      return state;
  }
};

export default function CompleteJob({
  jobData,
  displayName,
}: {
  jobData: JobData;
  displayName?: string;
}) {
  // Initialize the state with useReducer
  const [state, dispatch] = useReducer(reducer, {
    openDialog: false,
    openDrawer: false,
    loadingNow: false,
    loadingLater: false,
    loadingIncomplete: false,
  });

  const [formState, action] = useFormState(
    createInvoice.bind(null, true, jobData.client_id, jobData.quote_id, null),
    undefined,
  );

  const form = useForm<z.infer<typeof CreateInvoiceFormSchema>>({
    resolver: zodResolver(CreateInvoiceFormSchema),
    defaultValues: {
      title: jobData.title,
      paymentMethod: 'credit card',
      notes: '',
    },
  });

  const onInvoiceLaterClick = async (e: MouseEvent<HTMLButtonElement>) => {
    dispatch({ type: 'LOADING_LATER', payload: true });
    try {
      await createDraftInvoice(
        jobData.client_id,
        jobData.quote_id,
        jobData.title,
      );
      await updateJobStatus(jobData.job_id, 'complete');
      dispatch({ type: 'OPEN_DIALOG', payload: false });
      dispatch({ type: 'OPEN_DRAWER', payload: false });
    } catch (error) {
      console.error(error);
    } finally {
      dispatch({ type: 'LOADING_LATER', payload: false });
      dispatch({ type: 'LOADING_INCOMPLETE', payload: false }); // Reset loading state here to avoid flash of buttons switching
    }
  };

  const onMarkIncompleteClick = async (e: MouseEvent<HTMLButtonElement>) => {
    dispatch({ type: 'LOADING_INCOMPLETE', payload: true });
    try {
      await updateJobStatus(jobData.job_id, 'incomplete');
    } catch (error) {
      console.error(error);
      dispatch({ type: 'LOADING_INCOMPLETE', payload: false });
    }
  };

  async function onSubmit(data: z.infer<typeof CreateInvoiceFormSchema>) {
    dispatch({ type: 'LOADING_NOW', payload: true });
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('paymentMethod', data.paymentMethod);
    formData.append('notes', data.notes || '');

    try {
      await action(formData);
      await updateJobStatus(jobData.job_id, 'complete');
      dispatch({ type: 'OPEN_DIALOG', payload: false });
      dispatch({ type: 'OPEN_DRAWER', payload: false });
    } catch (error) {
      console.error(error);
      dispatch({ type: 'LOADING_NOW', payload: false });
    } finally {
      dispatch({ type: 'LOADING_NOW', payload: false });
      dispatch({ type: 'LOADING_INCOMPLETE', payload: false }); // Reset loading state here to avoid flash of buttons switching
    }
  }

  const content = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 grid gap-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="block">Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="block">Payment method</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="mb-0">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="credit card">Credit card</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="paymentMethod" value={field.value} />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="block">
                Notes <span className="text-muted-foreground">(Optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea className="field-sizing-content" {...field} />
              </FormControl>
              {formState?.errors?.notes && (
                <p className="text-sm text-red-500">{formState.errors.notes}</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <SubmitButtonWithLoader
          loading={state.loadingNow}
          loadingText="Submitting..."
        >
          Submit
        </SubmitButtonWithLoader>
      </form>
    </Form>
  );

  const invoiceLaterButton = (
    <Button variant="outline" onClick={onInvoiceLaterClick}>
      {state.loadingLater ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Submitting...
        </>
      ) : (
        'Invoice Later'
      )}
    </Button>
  );

  return jobData.status === 'complete' ? (
    <SubmitButtonWithLoader
      loading={state.loadingIncomplete}
      loadingText="Marking as incomplete..."
      onClick={onMarkIncompleteClick}
    >
      Mark as incomplete
    </SubmitButtonWithLoader>
  ) : (
    <>
      <Dialog
        open={state.openDialog}
        onOpenChange={(open) =>
          dispatch({ type: 'OPEN_DIALOG', payload: open })
        }
      >
        <DialogTrigger asChild className="hidden md:block">
          <Button>Complete Job</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete job</DialogTitle>
            <DialogDescription>Invoice now or invoice later</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle>
                  {displayName ? `Invoice for ${displayName}` : 'Invoice now'}
                </CardTitle>
              </CardHeader>
              <CardContent>{content}</CardContent>
            </Card>
            {invoiceLaterButton}
          </div>
        </DialogContent>
      </Dialog>
      <Drawer
        open={state.openDrawer}
        onOpenChange={(open) =>
          dispatch({ type: 'OPEN_DRAWER', payload: open })
        }
      >
        <DrawerTrigger asChild className="md:hidden">
          <Button>Complete Job</Button>
        </DrawerTrigger>
        <DrawerContent className="hide-handle px-4 pb-4">
          <DrawerHeader>
            <DrawerTitle>Complete job</DrawerTitle>
            <DrawerDescription>Invoice now or invoice later</DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-4">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle>
                  {displayName ? `Invoice for ${displayName}` : 'Invoice now'}
                </CardTitle>
              </CardHeader>
              <CardContent>{content}</CardContent>
            </Card>
            {invoiceLaterButton}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
