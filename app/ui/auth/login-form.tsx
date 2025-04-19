'use client';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/ui/shadcn/components/ui/form';
import { z } from 'zod';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { SubmitButton } from '../submit-button';
import { authenticate } from '@/app/lib/actions';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginFormSchema } from '@/app/lib/definitions';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import Link from 'next/link';

function isJson(string: any) {
  try {
    JSON.parse(string);
  } catch (e) {
    return false;
  }
  return true;
}

export default function LoginForm() {
  const [state, action] = useFormState(authenticate, undefined);

  const form = useForm<z.infer<typeof LoginFormSchema>>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  return (
    <Form {...form}>
      <form action={action} className="w-4/5 space-y-6 md:w-2/3">
        <div>
          <h1 className="mt-6 mb-1.5 text-2xl leading-none font-bold">
            Log In
          </h1>
          <p className="text-muted-foreground text-sm">
            Or create an account{' '}
            <Link href="/register" className="text-sm underline">
              here
            </Link>
          </p>
        </div>
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

              <>
                {isJson(state) && typeof state === 'string' && (
                  <>
                    {JSON.parse(state).email && (
                      <p className="text-sm text-red-500">
                        {JSON.parse(state).email}
                      </p>
                    )}
                  </>
                )}
              </>

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
              <p className="text-muted-foreground text-sm">
                
                <Link href="/reset-password" className="text-sm underline">
                 Forgot password?
                </Link>
              </p>
              <FormMessage />
              <>
                {isJson(state) && typeof state === 'string' && (
                  <div>
                    {JSON.parse(state)?.password && (
                      <ul>
                        {JSON.parse(state).password.map((error: any) => (
                          <li key={error} className="text-sm text-red-500">
                            {' '}
                            {error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
              {!isJson(state) && typeof state === 'string' && (
                <p className="text-sm text-red-500">{state}</p>
              )}
            </FormItem>
          )}
        />
        <SubmitButton>Submit</SubmitButton>
      </form>
    </Form>
  );
}
