import { Separator } from './shadcn/components/ui/separator';

// Loading animation
const shimmer =
  'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/60 before:to-transparent';

export function CardSkeleton() {
  return (
    <div
      className={`${shimmer} relative overflow-hidden rounded-xl bg-gray-100 p-2 shadow-xs`}
    >
      <div className="flex p-4">
        <div className="h-5 w-5 rounded-md bg-gray-200" />
        <div className="ml-2 h-6 w-16 rounded-md bg-gray-200 text-sm font-medium" />
      </div>
      <div className="flex items-center justify-center truncate rounded-xl bg-white px-4 py-8">
        <div className="h-7 w-20 rounded-md bg-gray-200" />
      </div>
    </div>
  );
}

export function CardsSkeleton() {
  return (
    <>
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </>
  );
}

export function RevenueChartSkeleton() {
  return (
    <div className={`${shimmer} relative w-full overflow-hidden md:col-span-4`}>
      <div className="mb-4 h-8 w-36 rounded-md bg-gray-100" />
      <div className="rounded-xl bg-gray-100 p-4">
        <div className="sm:grid-cols-13 mt-0 grid h-[410px] grid-cols-12 items-end gap-2 rounded-md bg-white p-4 md:gap-4" />
        <div className="flex items-center pb-2 pt-6">
          <div className="h-5 w-5 rounded-full bg-gray-200" />
          <div className="ml-2 h-4 w-20 rounded-md bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

export function InvoiceSkeleton() {
  return (
    <div className="flex flex-row items-center justify-between border-b border-gray-100 py-4">
      <div className="flex items-center">
        <div className="mr-2 h-8 w-8 rounded-full bg-gray-200" />
        <div className="min-w-0">
          <div className="h-5 w-40 rounded-md bg-gray-200" />
          <div className="mt-2 h-4 w-12 rounded-md bg-gray-200" />
        </div>
      </div>
      <div className="mt-2 h-4 w-12 rounded-md bg-gray-200" />
    </div>
  );
}

export function LatestInvoicesSkeleton() {
  return (
    <div
      className={`${shimmer} relative flex w-full flex-col overflow-hidden md:col-span-4`}
    >
      <div className="mb-4 h-8 w-36 rounded-md bg-gray-100" />
      <div className="flex grow flex-col justify-between rounded-xl bg-gray-100 p-4">
        <div className="bg-white px-6">
          <InvoiceSkeleton />
          <InvoiceSkeleton />
          <InvoiceSkeleton />
          <InvoiceSkeleton />
          <InvoiceSkeleton />
          <div className="flex items-center pb-2 pt-6">
            <div className="h-5 w-5 rounded-full bg-gray-200" />
            <div className="ml-2 h-4 w-20 rounded-md bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <>
      <div
        className={`${shimmer} relative mb-4 h-8 w-36 overflow-hidden rounded-md bg-gray-100`}
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-8">
        <RevenueChartSkeleton />
        <LatestInvoicesSkeleton />
      </div>
    </>
  );
}

export function ScheduleSkeleton() {
  const renderDays = () => {
    const days = [];
    for (let i = 0; i < 30; i++) {
      days.push(
        <div key={i} className="rounded-lg bg-gray-200 p-2">
          <div className="flex justify-end">
            <div className="mb-2 h-5 w-5 rounded-md md:bg-gray-300"></div>
          </div>
          <div>
            <div className=" hidden h-5 w-full rounded-md bg-gray-100 md:block"></div>
          </div>
        </div>,
      );
    }
    return days;
  };

  return (
    <div
      className={`${shimmer} flex h-[85vh] max-w-full flex-col gap-2 overflow-hidden rounded-xl bg-gray-100 p-4 shadow-xs md:h-[91vh]`}
    >
      <div className="hidden lg:block">
        <div className="mb-4 grid h-fit grid-cols-3 justify-between gap-2">
          <div className="grid max-w-72 grid-cols-3 gap-2">
            <div className="rounded-md bg-gray-300"></div>
            <div className="rounded-md bg-gray-300"></div>
            <div className="rounded-md bg-gray-300"></div>
          </div>
          <div className="h-8 rounded-md bg-gray-200"></div>
          <div className="col-start-3">
            <div className="ml-auto h-8 max-w-64 rounded-md bg-gray-300"></div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 lg:hidden">
        <div className="mx-auto h-8 w-1/3 rounded-md bg-gray-200"></div>
        <div className="h-16 rounded-md bg-gray-300"></div>
      </div>

      <div className=" grid h-5 grid-cols-5 gap-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, index) => (
          <div key={index} className=" rounded-md bg-gray-200"></div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-5 gap-2">{renderDays()}</div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="w-full border-b border-gray-100 last-of-type:border-none [&:first-child>td:first-child]:rounded-tl-lg [&:first-child>td:last-child]:rounded-tr-lg [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg">
      {/* Customer Name and Image */}
      <td className="relative overflow-hidden whitespace-nowrap py-3 pl-6 pr-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-100"></div>
          <div className="h-6 w-24 rounded bg-gray-100"></div>
        </div>
      </td>
      {/* Email */}
      <td className="whitespace-nowrap px-3 py-3">
        <div className="h-6 w-32 rounded bg-gray-100"></div>
      </td>
      {/* Amount */}
      <td className="whitespace-nowrap px-3 py-3">
        <div className="h-6 w-16 rounded bg-gray-100"></div>
      </td>
      {/* Date */}
      <td className="whitespace-nowrap px-3 py-3">
        <div className="h-6 w-16 rounded bg-gray-100"></div>
      </td>
      {/* Status */}
      <td className="whitespace-nowrap px-3 py-3">
        <div className="h-6 w-16 rounded bg-gray-100"></div>
      </td>
      {/* Actions */}
      <td className="whitespace-nowrap py-3 pl-6 pr-3">
        <div className="flex justify-end gap-3">
          <div className="h-[38px] w-[38px] rounded bg-gray-100"></div>
          <div className="h-[38px] w-[38px] rounded bg-gray-100"></div>
        </div>
      </td>
    </tr>
  );
}

export function InvoicesMobileSkeleton() {
  return (
    <div className="mb-2 w-full rounded-md bg-white p-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-8">
        <div className="flex items-center">
          <div className="mr-2 h-8 w-8 rounded-full bg-gray-100"></div>
          <div className="h-6 w-16 rounded bg-gray-100"></div>
        </div>
        <div className="h-6 w-16 rounded bg-gray-100"></div>
      </div>
      <div className="flex w-full items-center justify-between pt-4">
        <div>
          <div className="h-6 w-16 rounded bg-gray-100"></div>
          <div className="mt-2 h-6 w-24 rounded bg-gray-100"></div>
        </div>
        <div className="flex justify-end gap-2">
          <div className="h-10 w-10 rounded bg-gray-100"></div>
          <div className="h-10 w-10 rounded bg-gray-100"></div>
        </div>
      </div>
    </div>
  );
}

export function InvoicesTableSkeleton() {
  return (
    <div className="mt-6 flow-root">
      <div className="inline-block min-w-full align-middle">
        <div className="rounded-lg bg-gray-50 p-2 md:pt-0">
          <div className="md:hidden">
            <InvoicesMobileSkeleton />
            <InvoicesMobileSkeleton />
            <InvoicesMobileSkeleton />
            <InvoicesMobileSkeleton />
            <InvoicesMobileSkeleton />
            <InvoicesMobileSkeleton />
          </div>
          <table className="hidden min-w-full text-gray-900 md:table">
            <thead className="rounded-lg text-left text-sm font-normal">
              <tr>
                <th scope="col" className="px-4 py-5 font-medium sm:pl-6">
                  Customer
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Email
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Amount
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Date
                </th>
                <th scope="col" className="px-3 py-5 font-medium">
                  Status
                </th>
                <th
                  scope="col"
                  className="relative pb-4 pl-3 pr-6 pt-2 sm:pr-6"
                >
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
              <TableRowSkeleton />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CreateJobFormSkeleton() {
  return (
    <div
      className={`${shimmer} w-full max-w-96 overflow-hidden rounded-xl bg-slate-100 p-4 shadow-xs`}
    >
      <p className="mb-4 h-8 w-40 rounded-md bg-slate-200 text-2xl font-bold"></p>

      <div className="grid w-full grid-cols-1 gap-3">
        <div className="flex w-full flex-col gap-2">
          <div className="mb-1 h-5 w-20 rounded-md bg-slate-200"></div>
          <div className="h-10 w-full rounded-md bg-slate-200"></div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="mb-1 h-5 w-32 rounded-md bg-slate-200"></div>
          <div className="h-20 w-full rounded-md bg-slate-200"></div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="mb-1 h-5 w-32 rounded-md bg-slate-200"></div>
          <div className="h-10 w-full rounded-md bg-slate-200"></div>
        </div>

        <div className="grid gap-4 pt-3">
          <div className="flex flex-col items-start gap-2">
            <div className="flex gap-4">
              <div className="flex flex-col gap-2">
                <div className="mb-1 h-5 w-24 rounded-md bg-slate-200"></div>
                <div className="h-10 w-40 rounded-md bg-slate-200"></div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="mb-1 h-5 w-24 rounded-md bg-slate-200"></div>
                <div className="h-10 w-40 rounded-md bg-slate-200"></div>
              </div>
            </div>
            <div className="mt-2 flex flex-row items-start gap-2">
              <div className="h-5 w-5 rounded-md bg-slate-200"></div>
              <div className="h-5 w-20 rounded-md bg-slate-200"></div>
            </div>
          </div>
        </div>

        <div className="my-4 border-b border-slate-200"></div>

        <div className="grid gap-4">
          <div className="flex flex-col items-start gap-2">
            <div className="min-h-32 w-full rounded-lg border p-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="h-6 w-20 rounded-md bg-slate-200"></div>
                <div className="h-8 w-32 rounded-md bg-slate-200"></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="h-8 w-20 rounded-md bg-slate-200"></div>
                <div className="h-8 w-20 rounded-md bg-slate-200"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 h-10 w-32 rounded-md bg-slate-200"></div>
      </div>
    </div>
  );
}

export function ClientSkeleton() {
  return (
    <div className="transition-colors hover:bg-blue-50">
      <div className="grid animate-pulse grid-cols-1 gap-x-4 gap-y-1.5 py-4 pl-2 sm:grid-cols-2 md:grid-cols-4 md:grid-rows-3 lg:grid-cols-10 lg:grid-rows-1 xl:grid-cols-10">
        <div className="h-6 w-1/2 rounded-md bg-slate-200 md:col-span-2 lg:col-span-2 xl:col-span-2"></div>
        <div className="h-6 w-3/4 rounded-md bg-slate-200 pr-3 md:col-span-3 lg:col-span-3"></div>
        <div className="col-span-1 h-6 w-1/3 rounded-md bg-slate-200 sm:col-span-2 md:col-span-4 lg:col-span-2"></div>
        <div className="h-6 w-1/4 rounded-md bg-slate-200 md:col-span-2 lg:col-span-2"></div>
      </div>
    </div>
  );
}

export function ClientListSkeleton() {
  const skeletons = Array.from({ length: 20 }).map((_, index) => (
    <div key={index}>
      <ClientSkeleton />
      <Separator />
    </div>
  ));

  return <div>{skeletons}</div>;
}

export function CreateClientFormSkeleton() {
  return (
    <div
      className={`${shimmer} relative max-w-[42rem] overflow-hidden rounded-xl bg-gray-100 p-4 shadow-xs`}
    >
      <div className="flex flex-wrap justify-stretch gap-x-8">
        <div className="min-w-64">
          <h2 className="mb-4 mt-4 h-8 w-40 rounded-md bg-gray-200 text-xl font-semibold text-slate-800"></h2>
          <div className="grid gap-2 pt-3">
            <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
            <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>

            <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
            <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>

            <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
            <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>

            <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
            <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>

            <div className="flex flex-row items-start space-x-3 space-y-0 py-4">
              <div className="mb-1 h-5 w-5 rounded-md bg-gray-200"></div>
              <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
            </div>

            <div className="pb-2">
              <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
              <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>
            </div>

            <div className="pb-2">
              <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
              <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>
            </div>

            <div className="pb-2">
              <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
              <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>
            </div>

            <div className="pb-2">
              <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
              <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-stretch">
          <h2 className="mb-4 mt-4 h-8 w-40 rounded-md bg-gray-200 text-xl font-semibold text-slate-800"></h2>
          <div className="flex grow flex-col justify-between gap-2 pb-2 pt-3">
            <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
            <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>

            <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
            <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>

            <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
            <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>

            <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
            <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>

            <div className="mb-1 h-5 w-20 rounded-md bg-gray-200"></div>
            <div className="mb-4 h-10 w-full rounded-md bg-gray-200"></div>
          </div>
        </div>
      </div>

      <div className="my-4 border-b border-gray-200"></div>

      <div className="grid gap-4">
        <div className="flex flex-col items-start gap-2">
          <div className="min-h-32 w-full rounded-lg border p-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-6 w-20 rounded-md bg-gray-200"></div>
              <div className="h-8 w-32 rounded-md bg-gray-200"></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-8 w-20 rounded-md bg-gray-200"></div>
              <div className="h-8 w-20 rounded-md bg-gray-200"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 h-10 w-32 rounded-md bg-gray-200"></div>
    </div>
  );
}
