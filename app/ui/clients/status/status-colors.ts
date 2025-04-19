import { ClientStatus } from '@/app/lib/definitions';

export const statusColors: { [key in ClientStatus['status']]?: string } = {
  contracted: 'bg-green-600',
  contractedLight: 'bg-green-100',
  notContracted: 'bg-zinc-500',
  notContractedLight: 'bg-zinc-100',
  pending: 'bg-blue-500',
  pendingLight: 'bg-blue-100',
  notApplicable: 'bg-gray-500',
  notApplicableLight: 'bg-gray-100',
  active: 'bg-green-500',
  activeLight: 'bg-green-100',
  pastDue: 'bg-red-500',
  pastDueLight: 'bg-red-100',
  creditCardOnly: 'bg-yellow-600',
  creditCardOnlyLight: 'bg-yellow-100',
  setStatus: 'bg-slate-300',
  setStatusLight: 'bg-slate-50',
};
