'use client';

import { z } from 'zod';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/ui/shadcn/components/ui/form';
import { register } from '@/app/lib/actions';
import { SubmitButton } from '../submit-button';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterFormSchema } from '@/app/lib/definitions';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import Link from 'next/link';

export default function RegisterForm() {
  const [state, action] = useFormState(register, undefined);

  const form = useForm<z.infer<typeof RegisterFormSchema>>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  return (
    <Form {...form}>
      <form action={action} className="w-4/5 space-y-6 md:w-2/3">
        <div>
          <h1 className="mt-6 text-2xl font-bold leading-none mb-1.5">Register</h1>
          <p className="text-muted-foreground text-sm">
            Or log in{' '}
            <Link href="/login" className="text-sm underline">
              here
            </Link>
          </p>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="block">Full name</FormLabel>
              <FormControl>
                <Input placeholder="John Smith" type="text" {...field} />
              </FormControl>
              {state?.errors?.name && (
                <p className="text-sm text-red-500">{state.errors.email}</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="block">Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="example@gmail.com"
                  type="email"
                  {...field}
                />
              </FormControl>
              {state?.errors?.email && (
                <p className="text-sm text-red-500">{state.errors.email}</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="block">Password</FormLabel>
              <FormControl>
                <Input placeholder="" type="password" {...field} />
              </FormControl>

              <FormMessage />
              {state?.errors?.password && (
                <div>
                  <ul>
                    {state.errors.password.map((error) => (
                      <li key={error} className="text-sm text-red-500">
                        {' '}
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </FormItem>
          )}
        />
        <SubmitButton>Submit</SubmitButton>
      </form>
    </Form>
  );
}
