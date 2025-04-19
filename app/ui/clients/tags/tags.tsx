import { cn } from '../../shadcn/lib/utils';

export default function Tags({ tagString }: { tagString: string }) {
  function isPmPacketTag(tag: string) {
    return tag.toLowerCase().includes('pm packet');
  }

  const tags = tagString.split(',').map((tag, index) => {
    const useRed = isPmPacketTag(tag);
    return (
      <div
        className={cn('w-full max-w-fit rounded-md bg-slate-100 px-2 py-1', {
          'bg-red-400': useRed,
        })}
        key={index}
      >
        <p
          className={cn(
            'overflow-hidden text-ellipsis text-nowrap text-sm text-slate-600',
            {
              'text-white': useRed,
            },
          )}
        >
          {tag}
        </p>
      </div>
    );
  });

  return <div className="flex flex-wrap gap-1.5">{tags}</div>;
}
