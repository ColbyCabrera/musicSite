import { z } from 'zod';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '../../shadcn/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateClientStatus } from '@/app/lib/actions';
import { Button } from '../../shadcn/components/ui/button';
import { Textarea } from '../../shadcn/components/ui/textarea';
import { useClientStatusContext } from '@/app/contexts/ClientStatusContext';

export default function EditNoteForm({
  onFormSubmit,
}: {
  onFormSubmit: () => void;
}) {
  const clientStatus = useClientStatusContext();

  const formSchema = z.object({
    note: z.string().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      note: clientStatus.note ? clientStatus.note : '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    onFormSubmit();
    if (values.note == undefined) {
    } else {
      await updateClientStatus(
        clientStatus.client_id,
        clientStatus.status,
        clientStatus.type,
        values.note,
      );
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem className="my-3">
              <FormControl>
                <Textarea {...field} placeholder="Edit status note"></Textarea>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button variant={'outline'}>Edit note</Button>
      </form>
    </Form>
  );
}
