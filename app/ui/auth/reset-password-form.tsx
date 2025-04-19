'use client';

import { z } from 'zod';
import Link from 'next/link';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../shadcn/components/ui/tabs';
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Card,
} from '../shadcn/components/ui/card';
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
import { useEffect, useState } from 'react';
import { SubmitButton } from '../submit-button';
import { getUsersByEmail } from '@/app/lib/data';
import { resetPassword } from '@/app/lib/actions';
import { zodResolver } from '@hookform/resolvers/zod';
import { Label } from '../shadcn/components/ui/label';
import { generateSixDigitCode } from '@/app/lib/utils';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { ResetPasswordFormSchema } from '@/app/lib/definitions';
import SubmitButtonWithLoader from '../submit-button-with-loader';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '../shadcn/components/ui/input-otp';

export default function ResetPasswordForm() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [tabsValue, setTabsValue] = useState('email');
  const [isLoading, setIsLoading] = useState(false);
  const [state, action] = useFormState(
    resetPassword.bind(null, email, code),
    undefined,
  );

  useEffect(() => {
    setErrors([]);
    setCode(null);
  }, [email]);

  const EmailSchema = z.object({
    email: z.string().email({ message: 'Please enter a valid email address.' }),
  });

  const form = useForm<z.infer<typeof ResetPasswordFormSchema>>({
    resolver: zodResolver(ResetPasswordFormSchema),
    defaultValues: {
      password: '',
    },
  });

  const handleSendCode = async () => {
    setErrors([]);
    setIsLoading(true);

    try {
      const validation = EmailSchema.safeParse({ email: email });
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message);
      }

      const userExists = !!(await getUsersByEmail(email));

      if (!userExists) {
        throw new Error('User with this email does not exist.');
      }

      const generatedCode = generateSixDigitCode();
      setCode(generatedCode.toString());

      const response = await fetch('/api/send', {
        method: 'POST',
        body: JSON.stringify({
          from: 'RMS Fitness',
          to: email,
          subject: 'Reset password code',
          body: '',
          template: 'resetPassword',
          data: JSON.stringify({
            code: generatedCode,
          }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error sending code:', errorData);
        throw new Error(errorData.message || 'Failed to send code via API.');
      }

      setTabsValue('password');
    } catch (error) {
      console.error('Error sending code:', error);

      setErrors([
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.',
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Tabs
        value={tabsValue}
        onValueChange={(value) => {
          setTabsValue(value);
        }}
        className="mt-6 mb-1.5 md:w-[400px]"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="password" disabled={code === null}>
            New password
          </TabsTrigger>
        </TabsList>
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Enter email</CardTitle>
              <CardDescription>
                Enter your email address to receive a password reset code.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="block">Email</Label>
              <Input
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
              {errors.map((error, index) => (
                <p key={index} className="text-sm text-red-500">
                  {error}
                </p>
              ))}
            </CardContent>
            <CardFooter>
              <SubmitButtonWithLoader
                onClick={handleSendCode}
                disabled={code != null}
                loading={isLoading}
                loadingText="Sending code..."
              >
                Send code
              </SubmitButtonWithLoader>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="password">
          <Form {...form}>
            <form action={action}>
              <Card>
                <CardHeader>
                  <CardTitle>Create new password</CardTitle>
                  <CardDescription>
                    Enter your new password and code received in your email.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block">New password</FormLabel>
                        <FormControl>
                          <Input placeholder="" type="password" {...field} />
                        </FormControl>
                        <FormMessage>
                          {state?.errors?.password && (
                            <div>
                              <ul>
                                {state.errors.password.map((error) => (
                                  <li
                                    key={error}
                                    className="text-sm text-red-500"
                                  >
                                    {error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </FormMessage>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block">6 digit code</FormLabel>
                        <FormControl>
                          <InputOTP maxLength={6} {...field}>
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage>
                          {state?.errors?.code && (
                            <div>
                              <ul>
                                {state.errors.code.map((error) => (
                                  <li
                                    key={error}
                                    className="text-sm text-red-500"
                                  >
                                    {error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </FormMessage>
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter>
                  <SubmitButton disabled={isLoading}>
                    Save password
                  </SubmitButton>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
      <Link href="/login" className="text-muted-foreground text-sm underline">
        Back to login
      </Link>
    </div>
  );
}
