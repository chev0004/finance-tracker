import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeNumInputLeading(s: string): string {
  return s.replace(/^0+(?=\d)/, '');
}

export function normalizeNumInputBlur(s: string): string {
  if (s === '' || s.endsWith('.')) return s;
  const n = parseFloat(s);
  return Number.isNaN(n) ? s : String(n);
}
