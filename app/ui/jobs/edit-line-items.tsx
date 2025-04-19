'use client';

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
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { moneyFormatter } from '@/app/lib/utils';
import { Form } from '../shadcn/components/ui/form';
import { Button } from '../shadcn/components/ui/button';
import CreateQuoteForm from '../quotes/create-quote-form';
import { toast } from '../shadcn/components/ui/use-toast';
import { addEntityActivity, addQuoteToJob, editQuote } from '@/app/lib/actions';
import SubmitButtonWithLoader from '../submit-button-with-loader';
import { LineItem, Quote, QuoteFormData, Tax } from '@/app/lib/definitions';

export default function EditLineItems({
  jobId,
  clientId,
  quote,
  lineItems,
  taxes,
  taxRate,
}: {
  jobId: number;
  clientId: number;
  quote?: Quote | null;
  lineItems?: LineItem[];
  taxes: Tax[];
  taxRate: number;
}) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quoteData, setQuoteData] = useState<QuoteFormData>({
    lineItems: lineItems
      ? lineItems.map((lineItem) => ({
          ...lineItem,
          // Convert cents integer to dollars string
          unit_price: moneyFormatter.format(lineItem.unit_price / 100),
        }))
      : [
          {
            name: '',
            description: '',
            quantity: 1,
            unit_price: '$0.00',
            is_taxable: true,
          },
        ],
    taxId: quote?.tax_id ? quote.tax_id : null,
  });

  const form = useForm({});

  const content = (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 overflow-visible"
      >
        <CreateQuoteForm
          taxes={taxes}
          asSubForm={true}
          initialLineItems={lineItems}
          initialTax={{ id: quoteData.taxId, taxRate: taxRate }}
          onQuoteChange={(quoteData) => setQuoteData(quoteData)}
        />
        <SubmitButtonWithLoader loading={loading} loadingText="Submitting...">
          Submit
        </SubmitButtonWithLoader>
      </form>
    </Form>
  );

  async function onSubmit() {
    setLoading(true);
    try {
      let validationErrors: string[] | undefined = [];
      if (quote) {
        validationErrors = await editQuote(
          quote.id,
          clientId,
          quoteData.taxId,
          quote.user_id,
          quoteData.lineItems,
          true,
        );
      } else {
        validationErrors = await addQuoteToJob(
          jobId,
          clientId,
          quoteData.taxId,
          quoteData.lineItems,
        );
      }

      await addEntityActivity(jobId, 'job', 'Line items edited');

      if (validationErrors && validationErrors.length > 0) {
        validationErrors.forEach((error) => {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: error,
            duration: 5000,
          });
        });
        throw new Error('Validation errors');
      }
    } catch (err) {
      setLoading(false);
      console.log('Error editing line items:', err);
    }
    setDialogOpen(false);
    setDrawerOpen(false);
    setLoading(false);
  }

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild className="hidden md:block">
          <Button
            size={'sm'}
            variant={'secondary'}
            className="bg-slate-200 hover:bg-slate-300"
          >
            Edit line items
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-screen max-w-prose overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit line items</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">{content}</div>
        </DialogContent>
      </Dialog>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild className="md:hidden">
          <Button
            size={'sm'}
            variant={'secondary'}
            className="bg-slate-200 hover:bg-slate-300"
          >
            Edit line items
          </Button>
        </DrawerTrigger>
        <DrawerContent className="hide-handle px-3 pr-2 pb-0">
          <DrawerHeader>
            <DialogTitle>Edit line items</DialogTitle>
            <DialogDescription></DialogDescription>
          </DrawerHeader>
          <div className="grid max-h-[75vh] gap-4 overflow-y-auto p-1 pb-4">
            <div className="mr-2">{content}</div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
