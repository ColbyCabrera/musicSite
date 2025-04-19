import TagsDisplay from './tags-display';
import NewTagDialog from './new-tag-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/ui/shadcn/components/ui/popover';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../shadcn/components/ui/toggle-group';
import { Button } from '../../shadcn/components/ui/button';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

export default function SelectTags({
  tags,
  selected,
  onChange,
}: {
  tags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  return (
    <div className="mb-2 w-full rounded-lg border p-3">
      <div>
        <div className="mb-3 flex justify-between">
          <h3 className="pl-1 text-xl font-bold">Tags</h3>
          <NewTagDialog
            selected={selected}
            onChange={(tags: string[]) => onChange(tags)}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={'outline'}
              className="flex w-full justify-between font-normal"
            >
              Select tags
              <ChevronDownIcon className="h-3 min-w-3" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="max-h-100 min-w-(--radix-popover-trigger-width) overflow-y-auto p-1"
            sticky="partial"
            align="start"
          >
            <h3 className="my-1 pl-4 text-sm font-bold">Tags</h3>
            <ToggleGroup
              value={selected}
              type="multiple"
              className="flex-col gap-0.5"
              onValueChange={(e) => {
                onChange(e);
              }}
            >
              {tags.map((tag, index) => {
                const isSelected = selected.includes(tag);
                return (
                  <ToggleGroupItem
                    className="h-8 min-h-fit w-full justify-start rounded-sm py-1 pl-4 text-left font-normal"
                    value={tag}
                    key={index}
                    data-state={isSelected ? 'on' : 'off'}
                  >
                    {tag}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-3">
        <TagsDisplay
          tags={selected.filter((member) => member != '')}
          selected={selected}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
