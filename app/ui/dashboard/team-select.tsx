import { Plus } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../shadcn/components/ui/toggle-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/ui/shadcn/components/ui/popover';
import { TeamMember } from '@/app/lib/definitions';
import { Button } from '@/app/ui/shadcn/components/ui/button';

export default function TeamSelect({
  teamMembers,
  selected,
  onChange,
}: {
  teamMembers: Array<TeamMember>;
  selected: string[];
  onChange: (teamMembers: string[]) => void;
}) {
  const Content = () => (
    <>
      <h3 className="my-1 pl-3 text-sm font-bold">Team</h3>
      <ToggleGroup
        value={selected}
        type="multiple"
        className="flex-col gap-0.5"
        onValueChange={(e) => {
          onChange(e);
        }}
      >
        {teamMembers.map((member) => {
          const isSelected = selected.includes(member.name);
          return (
            <ToggleGroupItem
              className="h-8 w-full justify-start rounded-sm pr-6 font-normal"
              value={member.name}
              key={member.name}
              data-state={isSelected ? 'on' : 'off'}
            >
              {member.name}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </>
  );

  return (
    <>
      <div className="hidden md:block">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="mt-0!">
              Assign <Plus className="ml-1 h-5 text-slate-600" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-fit p-1"
            sticky="partial"
            side="right"
            align="start"
          >
            <Content />
          </PopoverContent>
        </Popover>
      </div>
      <div className="block md:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" className="mt-0!">
              Assign <Plus className="ml-1 h-5 text-slate-600" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="p-2 hide-handle">
            <Content />
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
