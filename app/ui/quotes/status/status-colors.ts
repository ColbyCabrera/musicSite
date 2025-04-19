import { Quote } from '@/app/lib/definitions';

export const statusColors: { [key in Quote['status']]?: string } = {
  incomplete: 'bg-red-200 text-red-800',
  'in progress': 'bg-yellow-100 text-yellow-800',
  complete: 'bg-green-100 text-green-800',
  rejected: 'bg-zinc-600 text-white',
  approved: 'bg-emerald-200 text-emerald-900',
  sent: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-sky-100 text-sky-800',
  'AM reviewing': 'bg-fuchsia-200 text-fuchsia-900',
  'parts in': 'bg-pink-200 text-pink-900',
  'parts ordered': 'bg-cyan-100 text-cyan-700',
  'back-ordered': 'bg-slate-600 text-slate-50',
  'changes requested': 'bg-amber-100 text-amber-800',
  'waiting on MFG': 'bg-lime-100 text-lime-800',
  'waiting on tech': 'bg-slate-200 text-slate-700',
};
