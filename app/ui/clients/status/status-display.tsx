import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../shadcn/components/ui/tooltip';
import { cn } from '../../shadcn/lib/utils';
import { statusColors } from './status-colors';
import { camelToRegularText } from '@/app/lib/utils';
import { ClientStatus } from '@/app/lib/definitions';

export type StatusColor =
  | 'contracted'
  | 'contractedLight'
  | 'notContracted'
  | 'notContractedLight'
  | 'pending'
  | 'pendingLight'
  | 'notApplicable'
  | 'notApplicableLight'
  | 'active'
  | 'activeLight'
  | 'pastDue'
  | 'pastDueLight'
  | 'creditCardOnly'
  | 'creditCardOnlyLight'
  | 'setStatus'
  | 'setStatusLight';

export default function StatusDisplay({
  status,
  note,
}: {
  status: StatusColor;
  note: ClientStatus['note'];
}) {
  const statusColor = statusColors[status as StatusColor];
  const statusColorLight = statusColors[`${status}Light` as StatusColor];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`${statusColorLight} flex h-fit w-fit max-w-full items-center gap-1.5 overflow-hidden rounded-md px-2 py-1`}
          >
            <div className={`${statusColor} block h-2 min-w-2 rounded-full`} />
            <p className="overflow-hidden text-sm font-medium text-nowrap text-ellipsis">
              {camelToRegularText(status)}
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent className={cn('hidden', { block: note })}>
          {note}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
