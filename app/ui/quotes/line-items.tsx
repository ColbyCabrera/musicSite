import { LineItem } from '@/app/lib/definitions';
import { moneyFormatter } from '@/app/lib/utils';
import { Badge } from '../shadcn/components/ui/badge';
import { Separator } from '../shadcn/components/ui/separator';

export default function LineItems({ lineItems }: { lineItems: LineItem[] }) {
  return (
    <div>
      {lineItems.length > 0 && (
        <div className="text-muted-foreground mb-2 hidden grid-cols-10 gap-4 lg:grid">
          <h3 className="col-span-4 overflow-hidden text-nowrap text-ellipsis">
            Product or service
          </h3>
          <h3 className="col-span-2 overflow-hidden text-ellipsis">Quantity</h3>
          <h3 className="col-span-2 overflow-hidden text-nowrap text-ellipsis">
            Unit price
          </h3>
          <h3 className="col-span-2">Total</h3>
        </div>
      )}
      <div className="mb-6 md:space-y-4">
        {lineItems.map((lineItem) => (
          <div
            key={lineItem.id}
            className="grid grid-cols-10 gap-x-4 text-black"
          >
            <div className="@container col-span-10 pr-3 lg:col-span-4 lg:pr-6">
              <div>
                <p className="text-muted-foreground text-sm lg:hidden">
                  Product or service
                </p>
                <div className="mb-1 flex max-w-108 gap-x-6 gap-y-1.5 @max-sm:flex-col @sm:items-center">
                  <p className="font-medium text-balance lg:@sm:grow lg:@sm:basis-1/2">
                    {lineItem.name}{' '}
                    {!lineItem.is_taxable && (
                      <span className="text-muted-foreground sm:hidden @sm:hidden">
                        (nontaxable)
                      </span>
                    )}
                  </p>
                  {!lineItem.is_taxable && (
                    <div className="hidden text-nowrap @sm:inline-flex lg:@sm:basis-1/2">
                      <Badge
                        variant={'outline'}
                        className="h-fit w-fit text-nowrap"
                      >
                        Non-taxable
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              <p className="mb-4 max-w-prose whitespace-pre-wrap lg:mb-2">
                {lineItem.description.trim()}
              </p>
              {!lineItem.is_taxable && (
                <p className="text-muted-foreground hidden text-sm sm:inline-flex @sm:hidden">
                  Non-taxable
                </p>
              )}
            </div>
            <div className="col-span-3 lg:col-span-2">
              <p className="text-muted-foreground text-sm lg:hidden">
                Quantity
              </p>
              <p>{lineItem.quantity}</p>
            </div>
            <div className="col-span-3 lg:col-span-2">
              <p className="text-muted-foreground text-sm lg:hidden">
                Unit price
              </p>
              <p>{moneyFormatter.format(lineItem.unit_price / 100)}</p>
            </div>
            <div className="col-span-4 lg:col-span-2">
              <p className="text-muted-foreground text-sm lg:hidden">Total</p>
              <p>
                {moneyFormatter.format(
                  lineItem.quantity * (lineItem.unit_price / 100),
                )}
              </p>
            </div>

            <Separator className="col-span-full my-4 md:my-2 md:mb-0.5" />
          </div>
        ))}
      </div>
    </div>
  );
}
