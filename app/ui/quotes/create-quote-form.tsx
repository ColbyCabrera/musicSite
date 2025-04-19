'use client';

import {
  calculateSubtotal,
  calculateTotal,
  moneyFormatter,
  percentFormatter,
} from '@/app/lib/utils';
import useSWR from 'swr';
import {
  Client,
  QuoteFormData,
  Tax,
  LineItem,
  TemplateLineItem,
} from '@/app/lib/definitions';
import CreateTax from './create-tax';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shadcn/components/ui/select';
import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { cn } from '@/app/ui/shadcn/lib/utils';
import { createQuote } from '@/app/lib/actions';
import SelectLineItem from './select-line-item';
import { useSearchParams } from 'next/navigation';
import { Form } from '../shadcn/components/ui/form';
import SelectClient from '../clients/select-client';
import { Label } from '../shadcn/components/ui/label';
import { Button } from '../shadcn/components/ui/button';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from '../shadcn/components/ui/use-toast';
import { Checkbox } from '../shadcn/components/ui/checkbox';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Separator } from '../shadcn/components/ui/separator';
import { Textarea } from '@/app/ui/shadcn/components/ui/textarea';
import SubmitButtonWithLoader from '../submit-button-with-loader';

type LineItemField = QuoteFormData['lineItems'][0];

export default function CreateQuoteForm({
  taxes,
  asSubForm,
  initialLineItems,
  initialTax,
  onQuoteChange,
}: {
  taxes: Tax[];
  asSubForm?: boolean;
  initialLineItems?: LineItem[];
  initialTax?: { id: number | null; taxRate: number };
  onQuoteChange?: (quoteData: QuoteFormData) => void;
}) {
  const DEFAULT_LINE_ITEM: LineItemField = {
    name: '',
    description: '',
    quantity: 1,
    unit_price: '$0.00',
    is_taxable: true,
  };

  const [loading, setLoading] = useState(false);
  const [selectedTaxId, setSelectedTaxId] = useState<number | null>(
    initialTax?.id || null,
  );
  const [selectedTaxRate, setSelectedTaxRate] = useState<number>(
    initialTax?.taxRate || 0,
  );
  const [clientName, setClientName] = useState<string>('Client Name');
  const initialClientId = Number(useSearchParams().get('client'));
  const [clientId, setClientId] = useState<number | null>(
    initialClientId || null,
  );
  const [lineItems, setLineItems] = useState<LineItemField[]>(
    initialLineItems
      ? initialLineItems.map((lineItem) => ({
          ...lineItem,
          unit_price: moneyFormatter.format(lineItem.unit_price / 100),
        }))
      : [DEFAULT_LINE_ITEM],
  );

  useEffect(() => {
    if (onQuoteChange) {
      onQuoteChange({
        lineItems: lineItems,
        taxId: selectedTaxId,
      });
    }
  }, [lineItems, selectedTaxId]);

  const handleTaxChange = (value: string) => {
    if (value === '-1') {
      setSelectedTaxId(null);
      setSelectedTaxRate(0);
      return;
    }

    const taxId = Number(value.split('%')[1]);
    setSelectedTaxId(taxId);
    const taxRate = Number(value.split('%')[0]);
    setSelectedTaxRate(taxRate);
  };

  const handleClientIdChange = (id: number, name: string) => {
    setClientId(id);
    setClientName(name);
  };

  const handleLineItemChange = (
    index: number,
    field: keyof LineItemField,
    value: string | number | boolean,
  ) => {
    setLineItems((prevLineItems) =>
      prevLineItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const addLineItem = () => {
    setLineItems((prevLineItems) => [...prevLineItems, DEFAULT_LINE_ITEM]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prevLineItems) =>
      prevLineItems.filter((_, i) => i !== index),
    );
  };

  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  const { data, isLoading, error } = useSWR<{ client: Client }>(
    () => (clientId ? `/api/clients/${clientId}` : null),
    fetcher,
    {
      onSuccess: (data) => {
        setClientName(
          data.client?.company_name || data.client?.contacts[0].name || '',
        );
      },
    },
  );

  const form = useForm({});

  async function onSubmit() {
    setLoading(true);
    try {
      const validationErrors = await createQuote(
        clientId,
        selectedTaxId,
        lineItems,
      );

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
      console.log('Error creating quote:', err);
    }
  }

  return (
    <>
      {!asSubForm ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-wrap gap-x-2">
              <h1
                className={cn('text-3xl font-bold', {
                  'mr-1': clientName === 'Client Name' && isLoading,
                })}
              >
                Create Quote for
              </h1>
              {clientName === 'Client Name' && isLoading ? (
                <div className="animate-pulse rounded-lg border-b-2 border-transparent bg-slate-100 text-3xl text-transparent">
                  LOADING NAME
                </div>
              ) : (
                <SelectClient
                  onChange={handleClientIdChange}
                  clientName={clientName}
                />
              )}
            </div>

            {/* Line Items Section */}
            <div className="max-w-4xl lg:pr-6">
              <div className="text-muted-foreground mb-3 hidden grid-cols-6 gap-5 lg:grid">
                <h3 className="col-span-3">Product or service</h3>
                <h3 className="col-span-1">Quantity</h3>
                <h3 className="col-span-1">Unit price</h3>
                <h3 className="col-span-1">Total</h3>
              </div>

              <div className="flex flex-col gap-6">
                {lineItems.length > 0 ? (
                  lineItems.map((lineItem, index) => (
                    <LineItem
                      key={index}
                      lineItem={lineItem}
                      index={index}
                      onLineItemChange={handleLineItemChange}
                      onRemoveLineItem={removeLineItem}
                    />
                  ))
                ) : (
                  <div className="rounded-md border border-gray-200">
                    <p className="text-muted-foreground my-12 text-center text-sm">
                      No line items
                    </p>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant={'outline'}
                onClick={addLineItem}
                className="mt-4"
              >
                Add Line Item
              </Button>
            </div>

            <div className="max-w-96">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Subtotal</p>
                <p className="font-medium">{calculateSubtotal(lineItems)}</p>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Select onValueChange={handleTaxChange}>
                    <SelectTrigger className="w-32 text-left">
                      <SelectValue placeholder="Select tax" />
                    </SelectTrigger>
                    <SelectContent className="max-h-96">
                      <SelectItem value="-1">No tax</SelectItem>
                      {taxes.map((tax) => (
                        <SelectItem
                          key={tax.id}
                          value={`${tax.tax_rate}%${tax.id}`}
                        >
                          {tax.name}{' '}
                          <span className="text-muted-foreground">
                            {percentFormatter.format(tax.tax_rate)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <CreateTax />
                </div>

                <p className="font-medium">
                  {percentFormatter.format(selectedTaxRate)}
                </p>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium">
                  {calculateTotal(lineItems, selectedTaxRate)}
                </p>
              </div>
            </div>

            <SubmitButtonWithLoader loading={loading}>
              Submit
            </SubmitButtonWithLoader>
          </form>
        </Form>
      ) : (
        <div className="space-y-6">
          {/* Line Items Section */}
          <div className="max-w-4xl lg:pr-6">
            <div className="text-muted-foreground mb-3 hidden grid-cols-6 gap-5 lg:grid">
              <h3 className="col-span-3">Product or service</h3>
              <h3 className="col-span-1">Quantity</h3>
              <h3 className="col-span-1">Unit price</h3>
              <h3 className="col-span-1">Total</h3>
            </div>

            <div className="flex flex-col gap-6">
              {lineItems.length > 0 ? (
                lineItems.map((lineItem, index) => (
                  <LineItem
                    key={index}
                    lineItem={lineItem}
                    index={index}
                    onLineItemChange={handleLineItemChange}
                    onRemoveLineItem={removeLineItem}
                  />
                ))
              ) : (
                <div className="rounded-md border border-gray-200">
                  <p className="text-muted-foreground my-12 text-center text-sm">
                    No line items
                  </p>
                </div>
              )}
            </div>
            <Button
              type="button"
              variant={'outline'}
              onClick={addLineItem}
              className="mt-4"
            >
              Add Line Item
            </Button>
          </div>

          <div className="max-w-96">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Subtotal</p>
              <p className="font-medium">{calculateSubtotal(lineItems)}</p>
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Select
                  onValueChange={handleTaxChange}
                  defaultValue={
                    selectedTaxId ? `${selectedTaxRate}%${selectedTaxId}` : '-1'
                  }
                >
                  <SelectTrigger className="w-32 text-left">
                    <SelectValue placeholder="Select tax" />
                  </SelectTrigger>
                  <SelectContent className="max-h-96">
                    <SelectItem value="-1">No tax</SelectItem>
                    {taxes.map((tax) => (
                      <SelectItem
                        key={tax.id}
                        value={`${tax.tax_rate}%${tax.id}`}
                      >
                        {tax.name}{' '}
                        <span className="text-muted-foreground">
                          {percentFormatter.format(tax.tax_rate)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CreateTax />
              </div>

              <p className="font-medium">
                {percentFormatter.format(selectedTaxRate)}
              </p>
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Total</p>
              <p className="font-medium">
                {calculateTotal(lineItems, selectedTaxRate)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LineItem({
  lineItem,
  index,
  onLineItemChange,
  onRemoveLineItem,
}: {
  lineItem: LineItemField;
  index: number;
  onLineItemChange: (
    index: number,
    field: keyof LineItemField,
    value: string | number | boolean,
  ) => void;
  onRemoveLineItem: (index: number) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleFetchStart = () => {
    setIsLoading(true);
  };

  const handleFetchEnd = (error?: Error) => {
    setIsLoading(false);
    if (error) {
      console.error('Failed to fetch line item details:', error);
      // TODO: Add user-facing error notification using toast
    }
  };

  const handleItemSelected = (selectedFullItem: TemplateLineItem) => {
    onLineItemChange(index, 'name', selectedFullItem.name);
    onLineItemChange(index, 'description', selectedFullItem.description);
    onLineItemChange(
      index,
      'unit_price',
      moneyFormatter.format(selectedFullItem.unit_price / 100),
    );
    onLineItemChange(index, 'is_taxable', selectedFullItem.is_taxable);
  };

  return (
    <div className="grid auto-rows-min grid-cols-6 gap-5">
      <div className="col-span-6 lg:col-span-3">
        <Label htmlFor={`name${index}`} className="mb-2 block lg:hidden">
          Product or service
        </Label>
        <div className="flex rounded-md rounded-b-none border border-b-0 border-gray-200">
          <Input
            type="text"
            placeholder="Name"
            disabled={isLoading}
            value={lineItem.name}
            className="rounded-b-none border-none"
            id={`name${index}`}
            onChange={(e) => {
              onLineItemChange(index, 'name', e.target.value);
            }}
          />
          <SelectLineItem
            name={lineItem.name || ''}
            onItemSelected={handleItemSelected}
            onFetchStart={handleFetchStart}
            onFetchEnd={handleFetchEnd}
          />
        </div>

        <Textarea
          placeholder="Description"
          className="field-sizing-content rounded-t-none"
          value={lineItem.description}
          disabled={isLoading}
          id={`description${index}`}
          onChange={(e) => {
            onLineItemChange(index, 'description', e.target.value);
          }}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-5 lg:col-span-1 lg:justify-between">
        <div className="space-y-2 lg:space-y-0">
          <Label htmlFor={`quantity${index}`} className="block lg:hidden">
            Quantity
          </Label>
          <Input
            type="number"
            min={1}
            value={lineItem.quantity}
            id={`quantity${index}`}
            onBlur={(e) =>
              onLineItemChange(
                index,
                'quantity',
                Math.round(Number(e.target.value)),
              )
            }
            onChange={(e) =>
              onLineItemChange(index, 'quantity', Number(e.target.value))
            }
          />
        </div>
        <div className="flex items-center gap-2 pt-3 lg:pt-0 lg:pb-3">
          <Checkbox
            id={`is_taxable${index}`}
            checked={lineItem.is_taxable}
            onCheckedChange={(checked) =>
              onLineItemChange(index, 'is_taxable', checked)
            }
          />
          <Label htmlFor={`is_taxable${index}`}>Taxed</Label>
        </div>
      </div>
      <div className="col-span-2 space-y-2 lg:col-span-1 lg:space-y-0">
        <Label htmlFor={`unit_price${index}`} className="block lg:hidden">
          Unit price
        </Label>
        <Input
          type="text"
          value={lineItem.unit_price}
          onBlur={(e) =>
            onLineItemChange(
              index,
              'unit_price',
              moneyFormatter.format(
                Number(e.target.value.replace(/[^.\d]+/g, '')),
              ),
            )
          }
          onChange={(e) =>
            onLineItemChange(index, 'unit_price', e.target.value)
          }
          id={`unit_price${index}`}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-5 lg:col-span-1 lg:justify-between">
        <div className="space-y-2 lg:space-y-0">
          <Label htmlFor={`total${index}`} className="block lg:hidden">
            Total
          </Label>
          <p
            id={`total${index}`}
            className="flex h-10 w-full items-center overflow-x-auto rounded-md border px-3 text-sm"
          >
            {moneyFormatter.format(
              Number(lineItem.unit_price.replace(/[^.\d]+/g, '')) *
                lineItem.quantity,
            )}
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="col-span-1 max-w-fit p-3"
            onClick={() => onRemoveLineItem(index)}
          >
            <XMarkIcon className="min-h-5 min-w-5 text-slate-600" />
          </Button>
        </div>
      </div>
    </div>
  );
}
