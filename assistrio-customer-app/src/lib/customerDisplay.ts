import type { CustomerMe } from '../api/types';

export function customerInitials(customer: Pick<CustomerMe, 'email' | 'firstName' | 'lastName'>): string {
  const f = customer.firstName?.trim();
  const l = customer.lastName?.trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f && f.length >= 2) return f.slice(0, 2).toUpperCase();
  if (f) return f.slice(0, 1).toUpperCase();
  const local = customer.email.split('@')[0] || '';
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return (local[0] || '?').toUpperCase();
}
