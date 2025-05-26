'use client';

import * as z from 'zod';
import { useForm } from 'react-hook-form';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/ui/shadcn/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/ui/shadcn/components/ui/form';
import DeleteButton from '../delete-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/ui/shadcn/components/ui/select';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/ui/shadcn/components/ui/alert-dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, UserRole } from '@/app/lib/definitions';
import { Switch } from '@/app/ui/shadcn/components/ui/switch';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Label } from '@/app/ui/shadcn/components/ui/label';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import React, { useState, useTransition, useEffect } from 'react';
import SubmitButtonWithLoader from '../submit-button-with-loader';
import { Separator } from '@/app/ui/shadcn/components/ui/separator';
import { updateUserColor, updateUserRole, deleteUser, updateUserAiAccompaniment } from '@/app/lib/actions';

const settingsFormSchema = z.object({
  color: z
    .string()
    .regex(
      /^#[0-9a-fA-F]{6}$/,
      'Color must be a valid hex code (e.g., #RRGGBB)',
    )
    .or(z.literal('')),

  role: z.enum(['USER', 'ADMIN', 'CLIENT']).optional(),
  enableAiAccompaniment: z.boolean().optional(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

// Add sonner component for notifications
export default function SettingsForm({
  currentUser,
  users,
}: {
  currentUser: User;
  users: User[];
}) {
  const [selectedUser, setSelectedUser] = useState<User>(currentUser);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const targetUser = selectedUser || currentUser;

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      color: targetUser.color || '#000000',
      role: targetUser.role,
      enableAiAccompaniment: targetUser.enableAiAccompaniment || false,
    },
  });

  useEffect(() => {
    const userToEdit = selectedUser;
    form.reset({
      color: userToEdit.color || '#000000',
      role: userToEdit.role,
      enableAiAccompaniment: userToEdit.enableAiAccompaniment || false,
    });
  }, [selectedUser, form]);

  const handleUserSelect = (userId: string) => {
    const userToEdit = users.find((u) => u.id === userId);
    setSelectedUser(userToEdit || currentUser);
  };

  async function onSubmit(data: SettingsFormValues) {
    setIsLoading(true);

    try {
      await updateUserColor(targetUser.id, data.color);

      if (currentUser.role === 'ADMIN' && selectedUser && data.role) {
        await updateUserRole(selectedUser.id, data.role as UserRole);
      }

      // Update AI accompaniment setting
      await updateUserAiAccompaniment(targetUser.id, data.enableAiAccompaniment ?? false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>User Settings</CardTitle>
      </CardHeader>
      <CardContent>
        {currentUser.role === 'ADMIN' && (
          <div className="mb-6 space-y-2">
            <Label htmlFor="userSelect" className="block">
              Edit Settings For
            </Label>
            <Select
              value={selectedUser?.id || currentUser.id}
              onValueChange={handleUserSelect}
              disabled={isLoading}
            >
              <SelectTrigger id="userSelect">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={currentUser.id}>
                  {currentUser.name}{' '}
                  <span className="text-muted-foreground">(Yourself)</span>
                </SelectItem>
                {users
                  .filter((u) => u.id !== currentUser.id)
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}{' '}
                      <span className="text-muted-foreground">
                        ({user.email})
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block">
                    {selectedUser.email === currentUser.email
                      ? 'Your Color'
                      : `${selectedUser.name}'s Color`}
                  </FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        type="color"
                        {...field}
                        disabled={isLoading}
                        className="block h-10 w-10 rounded-md p-1"
                      />
                    </FormControl>
                    {/* Color preview event */}
                    <div
                      style={{ backgroundColor: field.value || '#000000' }}
                      className={
                        'event-content flex gap-1 rounded-md px-2 py-0.5 text-sm text-white'
                      }
                    >
                      <b className="time-text">3p</b>

                      <p className="max-w-full">
                        <span className="hidden sm:inline">(1.5)</span> Sample
                        event
                      </p>
                    </div>
                  </div>
                  <FormMessage /> {/* Shows validation errors */}
                </FormItem>
              )}
            />

            {currentUser.role === 'ADMIN' && selectedUser && (
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">User Role</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isLoading || selectedUser.id === currentUser.id} // Cannot change own role here
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="CLIENT">Client</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="enableAiAccompaniment"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>AI Accompaniment</FormLabel>
                    {/* Optional: <FormDescription>Enable or disable AI-generated music accompaniment.</FormDescription> */}
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <SubmitButtonWithLoader loading={isLoading} loadingText="Saving...">
              Save changes
            </SubmitButtonWithLoader>
          </form>
        </Form>

        {currentUser.role === 'ADMIN' && selectedUser && (
          <>
            <Separator className="my-6" />
            <div className="border-destructive rounded-lg border p-4">
              <h3 className="text-destructive text-sm font-medium">
                Delete user
              </h3>
              <p className="text-muted-foreground mb-4 text-xs">
                Permanently delete {selectedUser.name} ({selectedUser.email}).
                This action cannot be undone.
              </p>
              <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isLoading}>
                    Delete {selectedUser.name}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the user ({selectedUser.name}) and remove their associated
                      data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>
                      Cancel
                    </AlertDialogCancel>
                    <div>
                      <DeleteButton
                        entity={'user'}
                        className="bg-destructive hover:bg-destructive/90 inline-flex w-full max-w-full"
                        deleteFunction={() => {
                          setSelectedUser(currentUser);
                          setOpen(false);
                          return deleteUser(selectedUser.id);
                        }}
                      />
                    </div>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
