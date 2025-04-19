'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../shadcn/components/ui/dropdown-menu';
import { useState } from 'react';
import { updateIsMain } from '@/app/lib/actions';
import { EnvelopeIcon, PhoneIcon, StarIcon } from '@heroicons/react/24/outline';

type Phone = {
  id: number;
  contact_id: number;
  phone_number: string;
  is_main: boolean;
};

type Email = {
  id: number;
  contact_id: number;
  email: string;
  is_main: boolean;
};

export default function IsMainDropdown({
  contactDetail,
  infoType,
}: {
  contactDetail: Phone | Email;
  infoType: 'phone' | 'email';
}) {
  const [isMain, setIsMain] = useState(contactDetail.is_main?.toString());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="text-left outline-hidden transition-all hover:pl-1">
        {infoType === 'phone' && 'phone_number' in contactDetail ? (
          <div className="flex items-center gap-3">
            <PhoneIcon className="text-muted-foreground h-5 min-w-5" />
            <address className="overflow-hidden break-words text-black not-italic">
              {contactDetail.phone_number}
            </address>
            {isMain === 'true' && (
              <StarIcon
                fill="#facc15"
                className="h-5 min-w-5 text-yellow-400"
              />
            )}
          </div>
        ) : 'email' in contactDetail ? (
          <div className="flex items-center gap-3" key={contactDetail.id}>
            <EnvelopeIcon className="text-muted-foreground h-5 min-w-5" />
            <address className="overflow-hidden break-words text-black not-italic">
              {contactDetail.email}
            </address>
            {isMain === 'true' && (
              <StarIcon
                fill="#facc15"
                className="h-5 min-w-5 text-yellow-400"
              />
            )}
          </div>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>
          {infoType === 'phone' ? 'Phone' : 'Email'} type
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={isMain}
          onValueChange={async (value) => {
            setIsMain(value);
            await updateIsMain(contactDetail.id, value === 'true', infoType);
          }}
        >
          <DropdownMenuRadioItem value="true">
            Main {infoType}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="false" className="pr-4">
            Standard {infoType}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
