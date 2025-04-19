'use client';

import { z } from 'zod';
import {
  Form,
  FormItem,
  FormField,
  FormMessage,
  FormControl,
} from '../shadcn/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { trimText } from '@/app/lib/utils';
import { getCurrentUser } from '@/app/lib/data';
import { Input } from '../shadcn/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../shadcn/components/ui/button';
import { Textarea } from '../shadcn/components/ui/textarea';
import { useToast } from '../shadcn/components/ui/use-toast';
import {
  addClientActivity,
  addEntityActivity,
  addNote,
} from '@/app/lib/actions';

export default function AddNoteForm({
  entity,
  entityId,
  visibility,
}: {
  entity: string;
  entityId: number;
  visibility: 'public' | 'internal';
}) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);

  const formSchema = z
    .object({
      note: z.string().optional(),
      files: z
        .instanceof(File, { message: 'Please upload a file.' })
        .array()
        .optional(),
    })
    .refine(
      (data) => {
        if (data.files) {
          for (const file of data.files) {
            // Bytes in binary
            if (file.size > 10485760) {
              return false; // Stop validation if ANY file is too large
            }
          }
        }
        return true;
      },
      {
        message: 'Max 10Mb upload size.',
        path: ['files'],
      },
    )
    .refine((data) => data.note || (data.files && data.files.length > 0), {
      message: 'Note cannot be empty if no file is uploaded.',
      path: ['note'],
    });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      note: '',
      files: undefined,
    },
  });

  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);

    const currentUser = await getCurrentUser();
    let blobs: any[] = [];

    try {
      if (values.files) {
        // Prepare FormData objects for each file
        const formDataArray = values.files.map((file) => {
          const formData = new FormData();
          formData.append('file', file);
          return formData;
        });

        // Use Promise.all to handle uploads concurrently
        await Promise.all([
          ...formDataArray.map((formData) =>
            fetch('/api/upload-file', {
              method: 'POST',
              body: formData,
            }).then(async (response) => {
              const resJSON = await response.json();

              if (!response.ok) {
                throw new Error(
                  `Failed to upload file: ${response.statusText}`,
                );
              }

              blobs.push(resJSON.blob); // Store blob objects
            }),
          ),
        ]);

        // Create a JSON stringified array of blob objects with pathname and url
        const fileString = JSON.stringify(
          blobs.map((blob) => ({
            pathname: blob.pathname,
            url: blob.url,
          })),
        );

        // Call addNote with the JSON stringified fileString
        await addNote(
          entity,
          entityId,
          visibility,
          values.note || '',
          fileString,
        );

        // Clear the file input
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      } else {
        await addNote(entity, entityId, visibility, values.note || '', '');
      }

      if (entity === 'client')
        await addClientActivity(entityId, `Note added by ${currentUser.name}`);
      else {
        addEntityActivity(entityId, entity, 'Note added');
      }

      toast({
        title: 'New note added',
        description: trimText(values.note || '', 40),
      });

      form.reset({ note: '', files: undefined });
    } catch (err) {
      console.log('Error uploading files:', err);
      toast({
        title: 'Error',
        description: 'There was an error adding the note.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mb-3">
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormMessage />
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Create new note"
                      className="field-sizing-content rounded-b-none"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="files"
              render={({ field }) => (
                <FormItem>
                  <FormControl className="h-fit rounded-t-none border-t-0 px-3 py-1.5">
                    <Input
                      type="file"
                      multiple
                      ref={inputRef}
                      onChange={(e) => {
                        const files = e.target.files as FileList;
                        if (files) {
                          field.onChange(Array.from(files));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button variant={'outline'} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add note'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
