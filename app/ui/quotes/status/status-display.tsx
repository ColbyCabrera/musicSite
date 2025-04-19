import { Quote } from '@/app/lib/definitions';
import { statusColors } from './status-colors';

export default function StatusDisplay({ status }: { status: Quote['status'] }) {
  const statusColor = statusColors[status] || 'bg-gray-100 text-gray-800'; // Default color if status not found
  return (
    <div
      className={`${statusColor} flex h-fit w-fit max-w-full items-center gap-1.5 overflow-hidden rounded-md py-1 pr-2.5 pl-2 saturate-150`}
    >
      <div className={`block h-2 min-w-2 rounded-full bg-current opacity-80`} />
      <p className="overflow-hidden text-sm font-medium text-nowrap text-ellipsis capitalize">
        {status}
      </p>
    </div>
  );
}
