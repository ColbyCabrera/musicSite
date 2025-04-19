import Client from './client';
import { Separator } from '../shadcn/components/ui/separator';
import { getFilteredClients } from '@/app/lib/data';

export default async function ClientList({
  query,
  currentPage,
  tags,
  accountManager,
}: {
  query: string;
  currentPage: number;
  tags: string;
  accountManager: string;
}) {
  const clients = await getFilteredClients(
    query,
    currentPage,
    tags,
    accountManager,
  );
  const clientsList = clients.map((client) => {
    return (
      <div key={client.id + 1}>
        <Client client={client} key={client.id} />
        <Separator />
      </div>
    );
  });

  return <div>{clientsList}</div>;
}
