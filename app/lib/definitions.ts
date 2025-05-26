export type UserRole = 'USER' | 'ADMIN' | 'CLIENT';

export type User = {
  id: string;
  name?: string | null; // Made optional as it's used for display
  email?: string | null; // Made optional as it's used for display
  color?: string | null;
  role: UserRole;
};
