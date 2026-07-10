import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const STATUS_LABELS: Record<string, string> = {
  complete: 'Complete',
  in_season: 'Live',
  pre_draft: 'Pre-Draft',
  drafting: 'Drafting',
  pre_season: 'Pre-Season',
  post_season: 'Post-Season',
}

export function formatStatus(status: string): string {
  return STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
