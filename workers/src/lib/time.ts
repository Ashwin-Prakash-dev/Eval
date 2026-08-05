/**
 * Timestamps are stored as ISO-8601 UTC TEXT (2026-08-03T12:34:56.789Z) so they sort
 * lexicographically in chronological order and parse directly as a JS Date.
 *
 * SQLAlchemy applied `onupdate=func.now()` in Python rather than as a database trigger,
 * so D1 will not maintain `updated_at` for us — every UPDATE must set it explicitly.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

export function isoFromDate(date: Date): string {
  return date.toISOString();
}

export function addMinutes(minutes: number, from: Date = new Date()): Date {
  return new Date(from.getTime() + minutes * 60_000);
}

export function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/**
 * Parses a stored timestamp. Rows written by this Worker are ISO-8601 with a `Z`; the
 * `strftime` column defaults produce the same shape, so `Date.parse` handles both.
 */
export function parseStored(value: string): Date {
  return new Date(value);
}

export function secondsSince(value: string): number {
  return (Date.now() - parseStored(value).getTime()) / 1000;
}
