import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateAr(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-SA-u-ca-gregory', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}
