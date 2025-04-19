'use client';

import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../shadcn/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../shadcn/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../shadcn/components/ui/drawer';
import EmailForm from '../email/email-form';
import DeleteButton from '../delete-button';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '../shadcn/components/ui/badge';
import { deleteFormResponse } from '@/app/lib/actions';
import { Button } from '../shadcn/components/ui/button';
import { EmailTemplate } from '../email/email-template';
import { LabeledResponse, User } from '@/app/lib/definitions';
import { get24hrTime, to12hrTimeString } from '@/app/lib/utils';

export default function FormResponse({
  response,
  currentUser,
  autofillOptions,
}: {
  response: LabeledResponse | null;
  currentUser: User;
  autofillOptions?: string[];
}) {
  const [openDialog, setOpenDialog] = useState(false);
  const [openDrawer, setOpenDrawer] = useState(false);

  const DEFAULT_SUBJECT = 'Summary of Work from RMS Fitness';
  const DEFAULT_BODY =
    "Hello Valued Customer,\n\nThe form(s) related to your appointment are now available. You can save or print a copy to keep for your records.\n\nIf you have any questions or concerns, please don't hesitate to get in touch with us at support@rmsfitness.com.\n\nSincerely,\nRMS Fitness";

  if (!response || !response.responses) {
    return <div>No response found.</div>;
  }

  const modifiedResponse = {
    ...response,
    createdAt: to12hrTimeString(get24hrTime(response.createdAt.toString())), // Set to the desired fixed time
  };

  const onSend = (
    uuid: string,
    sender: string,
    recipient: string,
    subject: string,
    body: string,
  ) => {
    setOpenDialog(false);
    setOpenDrawer(false);
  };

  return (
    <div className="space-y-4">
      <Card key={response.id}>
        <CardHeader>
          <CardTitle>{response.formName}</CardTitle>
          <CardDescription>
            Submitted by {response.userName} at{' '}
            {to12hrTimeString(get24hrTime(response.createdAt.toString()))}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {response.responses.map((response) => {
            const { fieldId, fieldType, label, value } = response;

            if (fieldType === 'SECTION-HEADER') {
              return null;
            }

            const renderResponseValue = () => {
              switch (fieldType) {
                case 'CHECKBOX':
                  return response.value === true ? (
                    <CheckCircle2 className="my-0.5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="my-0.5 h-5 text-red-500" />
                  );
                default:
                  return <p>{value === '' ? 'No response' : String(value)}</p>;
              }
            };

            return (
              <div key={fieldId} className="flex flex-col gap-1">
                <Badge variant="secondary">{label}</Badge>
                <div className="pl-2">{renderResponseValue()}</div>
              </div>
            );
          })}
        </CardContent>

        {(currentUser.name == response.userName ||
          currentUser.role === 'ADMIN') && (
          <CardFooter className="flex justify-between">
            <>
              <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogTrigger asChild className="hidden md:block">
                  <Button variant={'outline'}>Email response</Button>
                </DialogTrigger>
                <DialogContent className="gap-2">
                  <DialogHeader>
                    <DialogTitle>Email job form response</DialogTitle>
                    <DialogDescription>
                      The message body will appear in the emailed form
                    </DialogDescription>
                  </DialogHeader>
                  <EmailForm
                    data={JSON.stringify(modifiedResponse)}
                    autofillOptions={autofillOptions}
                    template={'jobFormResponse' as EmailTemplate}
                    onSend={onSend}
                    defaultSubject={DEFAULT_SUBJECT}
                    defaultBody={DEFAULT_BODY}
                  />
                </DialogContent>
              </Dialog>
              <Drawer open={openDrawer} onOpenChange={setOpenDrawer}>
                <DrawerTrigger asChild className="md:hidden">
                  <Button variant={'outline'}>Email response</Button>
                </DrawerTrigger>
                <DrawerContent className="hide-handle gap-2 px-4 py-2">
                  <DrawerHeader>
                    <DrawerTitle>Email job form response</DrawerTitle>
                    <DrawerDescription>
                      The message body will appear in the emailed form
                    </DrawerDescription>
                  </DrawerHeader>
                  <EmailForm
                    data={JSON.stringify(modifiedResponse)}
                    autofillOptions={autofillOptions}
                    template={'jobFormResponse' as EmailTemplate}
                    onSend={onSend}
                    defaultSubject={DEFAULT_SUBJECT}
                    defaultBody={DEFAULT_BODY}
                  />
                </DrawerContent>
              </Drawer>
            </>

            <DeleteButton
              entity={'formResponse'}
              deleteFunction={() => deleteFormResponse(response.id)}
              displayString="Delete response"
            />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
