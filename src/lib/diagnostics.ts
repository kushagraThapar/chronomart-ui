import type { DiagnosticsEntry } from "../api/types";

/**
 * True when the SDK marked the op as a failure (`diagnostics.isFailure`) or when the
 * HTTP status is ≥ 400. Used by Diagnostics rendering to highlight problem rows in red.
 */
export function isFailure(e: DiagnosticsEntry): boolean {
  if (e.diagnostics && typeof e.diagnostics.isFailure === "boolean") {
    return e.diagnostics.isFailure;
  }
  return typeof e.statusCode === "number" && e.statusCode >= 400;
}

/**
 * Tailwind palette for an HTTP status code chip. Matches the same severity buckets
 * the SDK + gateway already use (≥500 red, ≥400 amber, ≥300 blue, ≥200 emerald).
 */
export function statusPalette(status?: number): string {
  if (status == null) return "bg-slate-200 text-slate-700";
  if (status >= 500) return "bg-red-200 text-red-800";
  if (status >= 400) return "bg-amber-200 text-amber-800";
  if (status >= 300) return "bg-blue-200 text-blue-800";
  return "bg-emerald-200 text-emerald-800";
}

/**
 * Human-readable "Ns / Nm / Nh ago" formatter — falls back to "—" when `t` is
 * falsy (e.g. an unfetched TanStack Query `dataUpdatedAt` is 0).
 */
export function timeAgo(t: number): string {
  if (!t) return "—";
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}
