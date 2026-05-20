import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The whole app displays times in Riyadh (Asia/Riyadh = UTC+3, no DST).
 * Use the helpers below instead of bare `toLocaleString` so the value is
 * consistent whether the renderer is the Cloudflare edge (UTC) or a browser
 * in another timezone.
 */
export const RIYADH_TZ = 'Asia/Riyadh';

function toDateOrNull(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** Format a date as DD/MM/YYYY in Riyadh time, Arabic numerals. */
export function formatDateAr(date: string | number | Date | null | undefined): string {
  const d = toDateOrNull(date);
  if (!d) return '—';
  return d.toLocaleDateString('ar-SA-u-ca-gregory', {
    timeZone: RIYADH_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

/** Format a date+time in Riyadh time, Arabic numerals. */
export function formatDateTimeAr(date: string | number | Date | null | undefined): string {
  const d = toDateOrNull(date);
  if (!d) return '—';
  return d.toLocaleString('ar-SA-u-ca-gregory', {
    timeZone: RIYADH_TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Just the time portion (HH:MM) in Riyadh time. */
export function formatTimeAr(date: string | number | Date | null | undefined): string {
  const d = toDateOrNull(date);
  if (!d) return '—';
  return d.toLocaleTimeString('ar-SA-u-ca-gregory', {
    timeZone: RIYADH_TZ,
    hour: '2-digit', minute: '2-digit',
  });
}

/** Today's date in Riyadh as ISO YYYY-MM-DD. Use for form defaults / "now" baselines. */
export function todayIso(): string {
  // Use Intl with the Riyadh tz so the user sees the date that's "today" in Saudi Arabia,
  // not UTC today (which can be a day behind for very late evening Riyadh time).
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value ?? '0000';
  const m = parts.find(p => p.type === 'month')?.value ?? '01';
  const d = parts.find(p => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

/** Riyadh-tz day-of-the-week (Saturday is the first weekday in SA). Used for "is this overdue today". */
export function nowInRiyadhMs(): number {
  // Riyadh has no DST; UTC+3. We don't actually need a separate "Riyadh ms" — Date.now() is fine
  // for comparing absolute instants. This helper exists so callers can be explicit about intent.
  return Date.now();
}
