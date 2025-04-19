import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../shadcn/components/ui/card';
import { Client } from '@/app/lib/definitions';
import EditPropertyDialog from './edit-property-dialog';
import { ClockIcon, MapPinIcon, UserIcon } from '@heroicons/react/24/outline';

export default function PropertyBox({
  properties,
  client,
}: {
  properties: Client['properties'];
  client: Client;
}) {
  const property = properties[0];
  return (
    <Card className="grow border-none bg-inherit shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-x-6 space-y-0 p-0 pb-4">
        <CardTitle className="text-xl font-semibold">Property info</CardTitle>
        <EditPropertyDialog property={property} clientId={client.id} />
      </CardHeader>
      <CardContent className="mb-0.5 space-y-4 p-0">
        {property.street_2 === (null || '') ? (
          <div className="flex items-start gap-3">
            <MapPinIcon className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium leading-none">{property.street_1}</p>
              <p className="text-sm text-muted-foreground">
                {property.city}, {property.state} {property.zip}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <MapPinIcon className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium leading-none">
                {property.street_1} {property.street_2}
              </p>
              <p className="text-sm text-muted-foreground">
                {property.city}, {property.state} {property.zip}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <ClockIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
          {property.operating_hours ? (
            <p>{property.operating_hours}</p>
          ) : (
            <p>No hours specified</p>
          )}
        </div>

        {client.account_manager && (
          <div className="flex items-center gap-3 border-t pr-2 pt-2">
            <UserIcon className="h-5 w-5 shrink-0 text-muted-foreground" />

            <p className="text-sm text-muted-foreground">
              Account managed by {client.account_manager}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
