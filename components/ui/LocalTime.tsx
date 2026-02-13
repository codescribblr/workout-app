"use client";

import { format } from "date-fns";

interface LocalTimeProps {
  /** ISO 8601 date string (e.g. from Supabase) */
  iso: string;
  /** date-fns format string */
  formatStr: string;
  className?: string;
}

/**
 * Renders a timestamp in the user's local timezone.
 * Use this in server-rendered pages so times match the client-side list view.
 */
export default function LocalTime({ iso, formatStr, className }: LocalTimeProps) {
  const date = new Date(iso);
  return <span className={className}>{format(date, formatStr)}</span>;
}
