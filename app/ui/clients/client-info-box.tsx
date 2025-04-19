import Link from 'next/link';
import Status from './status/status';
import { getClientStatus, getCurrentUser } from '@/app/lib/data';
import { Client } from '@/app/lib/definitions';
import EditVisitsDialog from './edit-visits-dialog';
import { ClientStatusProvider } from '@/app/contexts/ClientStatusContext';

export default async function ClientInfoBox({ client }: { client: Client }) {
  const currentUser = await getCurrentUser();
  const [contractStatus, billingStatus] = await Promise.all([
    getClientStatus(client.id, 'contract'),
    getClientStatus(client.id, 'billing'),
  ]);

  return (
    <div className="gap-x-6 rounded-lg">
      <div className="flex flex-col gap-6">
        <div>
          <div className="mb-2 flex items-center justify-between gap-6 xl:mb-0 xl:items-start">
            <h2 className="text-xl font-semibold text-slate-800">Visits</h2>
            <EditVisitsDialog client={client} />
          </div>
          <p className="text-muted-foreground">
            Next maintenance visit:{' '}
            <span className="font-medium text-black">
              {client.next_visit ? client.next_visit : 'None scheduled'}
            </span>
          </p>
          <p className="text-muted-foreground">
            Last visit:{' '}
            <span className="font-medium text-black">
              {client.last_visit ? client.last_visit : 'N/A'}
            </span>
          </p>
          <p className="max-w-prose overflow-hidden text-ellipsis text-pretty text-muted-foreground">
            Special maintenance schedule:{' '}
            <span className="font-medium text-black">
              {client.maintenance_schedule
                ? client.maintenance_schedule
                : 'None scheduled'}
            </span>
          </p>
        </div>
        <div>
          <div className="mb-3 flex max-w-96 items-center justify-between gap-6">
            {currentUser.role === 'ADMIN' ? (
              <Link
                href={`/dashboard/clients/${client.id}/contract-information`}
                className="w-min flex-1 text-xl font-semibold text-slate-800 hover:underline"
              >
                <h2>Contract information</h2>
              </Link>
            ) : (
              <h2 className="w-min flex-1 text-xl font-semibold text-slate-800">
                Contract information
              </h2>
            )}
            <ClientStatusProvider clientStatus={contractStatus}>
              <Status />
            </ClientStatusProvider>
          </div>

          <p className="max-w-96 overflow-hidden text-ellipsis text-balance">
            {client.contract_information ? (
              client.contract_information
            ) : (
              <span className="text-muted-foreground">None yet</span>
            )}
          </p>
        </div>
        <div>
          <div className="mb-3 flex max-w-96 items-center justify-between gap-6">
            <h2 className="w-min flex-1 text-xl font-semibold text-slate-800">
              Billing instructions
            </h2>
            <ClientStatusProvider clientStatus={billingStatus}>
              <Status />
            </ClientStatusProvider>
          </div>
          <p className="max-w-96 overflow-hidden text-ellipsis">
            {client.billing_instructions ? (
              client.billing_instructions
            ) : (
              <span className="text-muted-foreground">None yet</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
