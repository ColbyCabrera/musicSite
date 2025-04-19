import { MouseEvent } from 'react';
import { removeFromArray } from '@/app/lib/utils';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Tag({
  tag,
  selected,
  onChange,
}: {
  tag: string;
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  function handleButtonClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    onChange(removeFromArray(event.currentTarget.value, selected));
  }

  return (
    <div className="flex w-fit items-center gap-2 rounded-lg bg-slate-100 px-2 py-1">
      <p className="text-sm text-muted-foreground">{tag}</p>
      <button
        className="text-sm font-light text-muted-foreground transition-all hover:scale-125 hover:text-slate-700"
        onClick={handleButtonClick}
        value={tag}
      >
        <XMarkIcon className="h-4" />
      </button>
    </div>
  );
}
