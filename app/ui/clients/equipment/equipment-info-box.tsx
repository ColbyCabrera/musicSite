import { getEquipment, getInventory } from '@/app/lib/data';
import EditInventoryDialog from './edit-inventory-dialog';
import EquipmentList from './equipment-list';
import formatQuantity from '../../format-quantity';

export default async function EquipmentInfoBox({
  clientId,
}: {
  clientId: number;
}) {
  const inventory = await getInventory(clientId);
  const equipment = await getEquipment(clientId);

  return (
    <div className="mt-3 grid grid-cols-1 gap-3">
      <div className="group flex flex-col">
        <h2 className="mb-1.5 text-xl font-semibold text-slate-800">
          Current inventory
        </h2>
        {inventory ? (
          <div>
            <div>
              {formatQuantity(inventory.treadmill, 'Treadmill', 'Treadmills')}
            </div>
            <div>
              {formatQuantity(
                inventory.elliptical,
                'Elliptical',
                'Ellipticals',
              )}
            </div>
            <div>{formatQuantity(inventory.bike, 'Bike', 'Bikes')}</div>
            <div>
              {formatQuantity(inventory.stepper, 'Stepper', 'Steppers')}
            </div>
            <div>
              {formatQuantity(inventory.strength, 'Strength', 'Strength')}
            </div>
            <div>{formatQuantity(inventory.bench, 'Bench', 'Benches')}</div>
            <div>
              {formatQuantity(inventory.spinner, 'Spinner', 'Spinners')}
            </div>
            <div>{formatQuantity(inventory.rower, 'Rower', 'Rowers')}</div>
            <p className="max-w-prose overflow-hidden text-ellipsis font-medium">
              {inventory.miscellaneous}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">No inventory</span>
        )}
        <EditInventoryDialog clientId={clientId} inventory={inventory} />
      </div>
      <div>
        <h2 className="mb-2 text-xl font-semibold text-slate-800">
          Equipment sold
        </h2>
        <EquipmentList equipmentArr={equipment} />
      </div>
    </div>
  );
}
