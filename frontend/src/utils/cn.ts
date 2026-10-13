import { clsx, type ClassValue } from 'clsx';
import { THEME } from './theme';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind + conditional class names */
export function cx(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format large numbers with K/M/B suffixes */
export function fmtNum(n: number | string): string {
  const v = Number(n);
  if (isNaN(v)) return '0';
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

/** Format relative time from ISO string */
export function fmtRelTime(isoStr: string): string {
  if (!isoStr) return 'N/A';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Format duration from seconds */
export function fmtDuration(totalSec: number): string {
  if (!totalSec || totalSec < 0) return '0s';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Tremor-inspired chart color palette */
export const chartColors = {
  blue: THEME.primaryLight,
  emerald: THEME.secondaryDark,
  violet: THEME.ai,
  amber: THEME.warning,
  rose: THEME.danger,
  cyan: THEME.info,
  slate: THEME.textMuted,
  indigo: THEME.primary,
  teal: THEME.secondaryDark,
  fuchsia: THEME.purple,
} as const;