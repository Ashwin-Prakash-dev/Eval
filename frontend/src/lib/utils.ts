import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(digits);
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  if (minutes === 0) return `${remaining}s`;
  return `${minutes}m ${remaining}s`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
