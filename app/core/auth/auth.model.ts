export type UserRole = 'user' | 'admin' | 'patient';

export interface AllowedUser {
  email: string;
  name: string;
  role: UserRole;
}

export function parseUserRole(value: unknown): UserRole {
  if (value === 'admin' || value === 'patient') {
    return value;
  }
  return 'user';
}

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'patient';
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
