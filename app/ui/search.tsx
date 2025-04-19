'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';
import { Input } from './shadcn/components/ui/input';
import { Label } from './shadcn/components/ui/label';

export default function Search({ placeholder }: { placeholder: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const handleSearch = useDebouncedCallback((term) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (term) {
      params.set('query', term);
    } else {
      params.delete('query');
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);

  return (
    <div className="relative flex flex-1 shrink-0">
      <Label htmlFor="search" className="sr-only">
        Search
      </Label>
      <Input
        id="search"
        className="peer placeholder:text-muted-foreground focus-visible:ring-muted-foreground block h-12 w-full rounded-full border border-gray-200 pl-10 text-sm transition-all md:h-10"
        placeholder={placeholder}
        defaultValue={searchParams.get('query')?.toString()}
        onChange={(e) => {
          handleSearch(e.target.value);
        }}
      />
      <MagnifyingGlassIcon className="text-muted-foreground absolute top-1/2 left-3 h-[18px] w-[18px] -translate-y-1/2 peer-focus:text-slate-600" />
    </div>
  );
}
