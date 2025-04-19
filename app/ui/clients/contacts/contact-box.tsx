import Contact from './contact';
import { Client } from '@/app/lib/definitions';
import AddContactDialog from './add-contact-dialog';
import EditContactDialog from './edit-contact-dialog';
import { Separator } from '../../shadcn/components/ui/separator';

export default function ContactBox({
  contacts,
  clientId,
}: {
  contacts: Client['contacts'];
  clientId: number;
}) {
  const contactsList = contacts.map((contact, index) => {
    return (
      <div key={contact.id} className="group flex flex-col">
        <Contact contact={contact} />
        <EditContactDialog clientId={clientId} contact={contact} />
        {index != contacts.length - 1 && (
          <Separator className="mx-auto my-3 w-1/2 md:mx-0 md:w-1/2" />
        )}
      </div>
    );
  });

  return (
    <div className="min-w-1/3 grow overflow-hidden">
      <div className="mb-4 flex items-center justify-between gap-6">
        <h2 className="text-nowrap text-xl font-semibold">Contact info</h2>
        <AddContactDialog clientId={clientId} />
      </div>
      <div>{contactsList}</div>
    </div>
  );
}
