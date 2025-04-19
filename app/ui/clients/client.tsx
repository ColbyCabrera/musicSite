import { Client as ClientType } from '@/app/lib/definitions';
import Link from 'next/link';
import Tags from './tags/tags';
import TimeDisplay from './time-display';
import Activity from './activity';

export default async function Client({ client }: { client: ClientType }) {
  const lastActivity = client.activities.sort((a, b) => {
    return a.date < b.date ? 1 : -1;
  })[0];
  const street1 = client.properties[0].street_1;
  const street2 = client.properties[0].street_2;
  const city = client.properties[0].city;
  const state = client.properties[0].state;
  const zip = client.properties[0].zip;
  const address =
    street2 != (null || '')
      ? `${street1}, ${street2}, ${city}, ${state} ${zip}`
      : `${street1}, ${city}, ${state} ${zip}`;

  const displayName =
    client.company_name === '' ? client.contacts[0]?.name : client.company_name;

  return (
    <Link href={`/dashboard/clients/${client.id}`}>
      <div className="transition-all hover:my-1 hover:rounded-lg hover:bg-blue-50 lg:hover:my-0 lg:hover:rounded-none">
        <div className="transition-all hover:translate-x-3 lg:hover:translate-x-1">
          <div className="grid items-center grid-cols-1 gap-x-4 gap-y-1.5 py-4 pl-0 sm:grid-cols-2 md:grid-cols-4 md:grid-rows-3 lg:grid-cols-10 lg:grid-rows-1 lg:pl-2 xl:grid-cols-10">
            <h3 className="font-semibold md:col-span-2 lg:col-span-2 xl:col-span-2 ">
              {displayName}
            </h3>
            <p className="overflow-hidden text-ellipsis text-nowrap pr-3 md:col-span-3 lg:col-span-3">
              {address}
            </p>
            <div className="col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-2">
              {client.tags && <Tags tagString={client.tags}></Tags>}
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <div className="mt-3 flex items-center gap-x-2 lg:mt-0 lg:block">
                <div className="order-1 lg:order-none">
                  <TimeDisplay date={lastActivity?.date} />
                </div>
                <div className="text-muted-foreground">
                  <Activity activity={lastActivity} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
