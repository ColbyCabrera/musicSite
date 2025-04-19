import { ChatBubbleOvalLeftIcon } from '@heroicons/react/24/outline';
import { Badge } from '../shadcn/components/ui/badge';
import Link from 'next/link';

export default function ChatIconWithBadge({
  displayNumber,
  id,
}: {
  displayNumber: number;
  id: number;
}) {
  return (
    <Link
      href={`/dashboard/quotes/messages/${id}`}
      className="relative grid min-w-fit grid-cols-2 grid-rows-2 transition-all hover:scale-105"
    >
      <ChatBubbleOvalLeftIcon className="col-span-2 row-span-2 min-h-6 min-w-6 text-slate-700" />
      {displayNumber > 0 && (
        <Badge className="absolute col-span-1 col-start-2 row-span-1 row-start-2 h-3 w-3 justify-center p-0 text-[0.6rem]">
          {displayNumber}
        </Badge>
      )}
    </Link>
  );
}
