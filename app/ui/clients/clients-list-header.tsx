import { Separator } from '../shadcn/components/ui/separator';

export default function ClientsListHeader() {
  return (
    <div className="hidden text-muted-foreground lg:block">
      <div className="my-1.5 grid grid-cols-1 gap-x-4 pl-2 sm:grid-cols-2 md:grid-cols-4 md:grid-rows-3 lg:grid-cols-10 lg:grid-rows-1 xl:grid-cols-10">
        <p className=" md:col-span-2 lg:col-span-2 xl:col-span-2 ">Name</p>
        <p className="pr-3 md:col-span-3">Address</p>
        <p className="col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-2">
          Tags
        </p>
        <p className="... overflow-hidden text-ellipsis text-nowrap md:col-span-2 lg:col-span-2">
          Last activity
        </p>
      </div>
      <Separator className="h-0.5" />
    </div>
  );
}
