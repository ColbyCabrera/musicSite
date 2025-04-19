import { Client } from '@/app/lib/definitions';
import IsMainDropdown from './contact-info-dropdown';
import { Separator } from '../../shadcn/components/ui/separator';
import { UserCircleIcon } from '@heroicons/react/24/outline';

export default function Contact({
  contact,
}: {
  contact: Client['contacts'][0];
}) {
  return (
    <div className="pr-2">
      <div className="mb-1.5 flex gap-2">
        <div className="flex items-center gap-3">
          <UserCircleIcon className="h-5 min-w-5 text-muted-foreground" />
          <h3 className="text-nowrap">{contact.name}</h3>
        </div>

        {contact.position && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <p className="overflow-hidden text-ellipsis text-nowrap text-muted-foreground">
              {contact.position}
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <PhoneNumbers phoneNumbers={contact.phone_numbers} />
        <Emails emails={contact.emails} />
      </div>
    </div>
  );
}

function PhoneNumbers({
  phoneNumbers,
}: {
  phoneNumbers: Client['contacts'][0]['phone_numbers'];
}) {
  const elements = phoneNumbers?.map((phoneNumber) => {
    return (
      <IsMainDropdown
        contactDetail={phoneNumber}
        infoType="phone"
        key={phoneNumber.id}
      />
    );
  });

  return elements;
}

function Emails({ emails }: { emails: Client['contacts'][0]['emails'] }) {
  const elements = emails?.map((email) => {
    return (
      <IsMainDropdown contactDetail={email} infoType="email" key={email.id} />
    );
  });

  return elements;
}
