export type UserRole = 'admin' | 'client';

export const USER_ROLE_OPTIONS: ReadonlyArray<{ value: UserRole; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'client', label: 'Client' },
];

export interface AllowedUser {
  email: string;
  name: string;
  role: UserRole;
}

export function parseUserRole(value: unknown): UserRole | null {
  if (value === 'admin' || value === 'client') {
    return value;
  }
  if (value === 'patient') {
    return 'client';
  }
  return null;
}

export function roleLabel(role: UserRole | null | undefined): string {
  return USER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? 'Admin';
}

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'client';
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
