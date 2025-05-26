// src/definitions.ts

/**
 * Defines the possible roles a user can have within the system.
 * - `USER`: A standard user with basic permissions.
 * - `ADMIN`: An administrator with elevated permissions.
 * - `CLIENT`: A client user, possibly with specific client-level access.
 */
export type UserRole = 'USER' | 'ADMIN' | 'CLIENT';

/**
 * Represents a user in the system.
 */
export type User = {
  /** The unique identifier for the user (e.g., UUID). */
  id: string;
  /** The user's display name. Optional. */
  name?: string | null;
  /** The user's email address. Optional. */
  email?: string | null;
  /** A color preference associated with the user (e.g., for UI theming). Optional. */
  color?: string | null;
  /** The role assigned to the user, determining their permissions. */
  role: UserRole;
};
