'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Equipment } from '@/app/lib/definitions';
import { formatDateToLocal } from '@/app/lib/utils';
import { Button } from '../../shadcn/components/ui/button';
import { Separator } from '../../shadcn/components/ui/separator';
import ChevronUpIcon from '@heroicons/react/24/outline/ChevronUpIcon';
import ChevronDownIcon from '@heroicons/react/24/outline/ChevronDownIcon';

export default function EquipmentList({
  equipmentArr,
}: {
  equipmentArr: Equipment[];
}) {
  const [viewFull, setViewFull] = useState(false);

  if (!equipmentArr.length) {
    return <span className="text-muted-foreground">None sold yet</span>;
  }

  const slicedArr = viewFull ? equipmentArr : equipmentArr.slice(0, 2);

  const equipmentRows = slicedArr.map((equipment, index) => (
    <div key={equipment.id}>
      <EquipmentItem equipment={equipment} />
      {index !== slicedArr.length - 1 && <Separator className="my-3" />}
    </div>
  ));

  return (
    <div className="xl:block xl:max-w-fit xl:pr-10">
      <div className="hidden grid-rows-6 xl:grid xl:grid-cols-6 xl:grid-rows-1">
        {/* Equipment Headers */}
        <p className="mb-0.5 text-sm text-slate-500">Install date</p>
        <p className="mb-0.5 text-sm text-slate-500">Type</p>
        <p className="mb-0.5 text-sm text-slate-500">Make</p>
        <p className="mb-0.5 text-sm text-slate-500">Model</p>
        <p className="mb-0.5 text-sm text-slate-500">Serial</p>
        <p className="mb-0.5 text-sm text-slate-500">CNS number</p>
      </div>
      {equipmentRows}
      <Button
        variant="link"
        className={clsx('mt-2 h-fit p-0 text-slate-600 hover:text-slate-700', {
          'hidden text-sm': equipmentArr.length <= 2,
        })}
        onClick={() => setViewFull(!viewFull)}
      >
        {viewFull ? (
          <>
            View less <ChevronUpIcon className="ml-1 h-4"></ChevronUpIcon>
          </>
        ) : (
          <>
            View more <ChevronDownIcon className="ml-1 h-4"></ChevronDownIcon>
          </>
        )}
      </Button>
    </div>
  );
}

function EquipmentItem({ equipment }: { equipment: Equipment }) {
  const [date, setDate] = useState('');

  useEffect(() => {
    setDate(formatDateToLocal(equipment.install_date));
  }, []);

  return (
    <div className="grid grid-rows-6 xl:grid-cols-6 xl:grid-rows-1">
      {/* Install Date */}
      <div className="flex items-center gap-2 xl:block">
        <p className="text-nowrap text-sm text-slate-500 xl:hidden">
          Install date
        </p>

        {date ? (
          <p className="mb-0.5 overflow-hidden text-ellipsis text-nowrap pr-4 md:mb-0">
            {date}
          </p>
        ) : (
          <div className="my-0.5 w-28 max-w-full animate-pulse pr-4">
            <p className="text-nowrap rounded-lg bg-slate-200 text-sm text-transparent">
              Placeholder date
            </p>
          </div>
        )}
      </div>
      {/* Type */}
      <div className="flex items-center gap-2 xl:block">
        <p className="text-sm text-slate-500 xl:hidden">Type</p>
        <p className="mb-0.5 overflow-hidden text-ellipsis text-nowrap pr-4 md:mb-0">
          {equipment.type}
        </p>
      </div>
      {/* Make */}
      <div className="flex items-center gap-2 xl:block">
        <p className="text-sm text-slate-500 xl:hidden">Make</p>
        <p className="mb-0.5 overflow-hidden text-ellipsis text-nowrap pr-4 md:mb-0">
          {equipment.make}
        </p>
      </div>
      {/* Model */}
      <div className="flex items-center gap-2 xl:block">
        <p className="text-sm text-slate-500 xl:hidden">Model</p>
        <p className="mb-0.5 overflow-hidden text-ellipsis text-nowrap pr-4 md:mb-0">
          {equipment.model}
        </p>
      </div>
      {/* Serial */}
      <div className="flex items-center gap-2 xl:block">
        <p className="text-sm text-slate-500 xl:hidden">Serial</p>
        <p className="mb-0.5 overflow-hidden text-ellipsis text-nowrap pr-4 md:mb-0">
          {equipment.serial}
        </p>
      </div>
      {/* CNS number */}
      <div className="flex items-center gap-2 xl:block">
        <p className="text-sm text-slate-500 xl:hidden">CNS number</p>
        <p className="mb-0.5 overflow-hidden text-ellipsis text-nowrap pr-4 md:mb-0">
          {equipment.cns}
        </p>
      </div>
    </div>
  );
}
