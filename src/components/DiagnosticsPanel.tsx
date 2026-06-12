import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorPanel } from "./ErrorPanel";
import { Stat } from "./Stat";
import { useDiagnostics } from "../hooks/useDiagnostics";
import { useSelectedSdk } from "../hooks/useCapabilities";
import type { DiagnosticsEntry } from "../api/types";
import { isFailure, statusPalette, timeAgo } from "../lib/diagnostics";

const LAST_OPTIONS = [10, 25, 50, 100, 250, 500, 1000] as const;
const REFRESH_INTERVAL_MS = 5_000;

/**
 * `DiagnosticsPanel` renders the SDK's most-recent ops from
 * `/api/v1/_meta/diagnostics`.
 *
 * Two modes:
 * - `mode="interactive"` (default, used by `/admin`) — full filter form, last-N
 *   selector, auto-refresh toggle, manual refresh button.
 * - `mode="compact"` (used embedded inside a workload run panel) — no controls,
 *   fixed `last`, auto-refresh driven by `autoRefresh` prop, no header.
 *
 * `containerFilter` (any mode): when non-empty, hides rows whose entry container
 * isn't in the set. Used by the workloads page to focus the tray on just the
 * containers a workload step is hitting.
 */
export function DiagnosticsPanel({
  mode = "interactive",
  title = "SDK diagnostics tray",
  defaultLast = 50,
  compactLast = 20,
  autoRefresh = false,
  containerFilter
}: {
  mode?: "interactive" | "compact";
  title?: string;
  defaultLast?: number;
  compactLast?: number;
  autoRefresh?: boolean;
  containerFilter?: string[];
}) {
  const [last, setLast] = useState<number>(mode === "compact" ? compactLast : defaultLast);
  const [autoRefreshState, setAutoRefreshState] = useState<boolean>(autoRefresh);
  const [filter, setFilter] = useState<string>("");
  const [showFailuresOnly, setShowFailuresOnly] = useState<boolean>(false);

  const sdk = useSelectedSdk();
  const qc = useQueryClient();

  const effectiveAutoRefresh = mode === "compact" ? autoRefresh : autoRefreshState;
  const query = useDiagnostics(last, effectiveAutoRefresh ? REFRESH_INTERVAL_MS : false);

  const containerSet = useMemo(
    () => (containerFilter && containerFilter.length > 0 ? new Set(containerFilter) : null),
    [containerFilter]
  );

  const entries = useMemo(() => {
    const list = query.data ?? [];
    return list.filter((e) => {
      if (containerSet) {
        const c = (e.diagnostics?.container as string | undefined) ?? "";
        if (!containerSet.has(c)) return false;
      }
      if (showFailuresOnly && !isFailure(e)) return false;
      if (filter) {
        const text = `${e.operation} ${e.diagnostics?.container ?? ""}`.toLowerCase();
        if (!text.includes(filter.toLowerCase())) return false;
      }
      return true;
    });
  }, [query.data, filter, showFailuresOnly, containerSet]);

  const totalRu = entries.reduce((sum, e) => sum + (e.requestCharge ?? 0), 0);
  const failures = entries.filter(isFailure).length;
  const avgDuration =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + (e.durationMs ?? 0), 0) / entries.length
      : 0;

  const isCompact = mode === "compact";

  return (
    <section className={isCompact ? "" : "rounded-lg border border-slate-200 bg-white p-4"}>
      {!isCompact && (
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {query.isFetching && <span>refreshing…</span>}
            <span>last fetched: {timeAgo(query.dataUpdatedAt)}</span>
          </div>
        </header>
      )}

      {!isCompact && (
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => e.preventDefault()}
        >
          <label className="flex flex-col text-sm">
            <span className="text-slate-600 font-medium">Last N</span>
            <select
              value={last}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n > 0) setLast(n);
              }}
              className="mt-1 w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              {LAST_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span className="text-slate-600 font-medium">Filter</span>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="operation / container"
              className="mt-1 w-56 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showFailuresOnly}
              onChange={(e) => setShowFailuresOnly(e.target.checked)}
            />
            <span className="text-slate-700">Failures only</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefreshState}
              onChange={(e) => setAutoRefreshState(e.target.checked)}
            />
            <span className="text-slate-700">
              Auto-refresh ({REFRESH_INTERVAL_MS / 1000}s)
            </span>
          </label>
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ["diagnostics", sdk, last] })}
            disabled={query.isFetching}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
          >
            Refresh now
          </button>
        </form>
      )}

      {query.isLoading && (
        <p className={`text-sm text-slate-500 ${isCompact ? "" : "mt-3"}`}>Loading…</p>
      )}
      {query.error && (
        <div className={isCompact ? "" : "mt-3"}>
          <ErrorPanel title="Diagnostics" message={String(query.error.message)} />
        </div>
      )}

      {!isCompact && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
          <Stat label="Entries" value={String(entries.length)} />
          <Stat label="Failures" value={String(failures)} accent={failures > 0 ? "red" : undefined} />
          <Stat label="Total RU" value={totalRu.toFixed(2)} />
          <Stat label="Avg duration (ms)" value={avgDuration.toFixed(2)} />
        </div>
      )}

      <div className={`overflow-x-auto ${isCompact ? "" : "mt-3"}`}>
        <table className="w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1 pr-3">Time</th>
              <th className="py-1 pr-3">Operation</th>
              <th className="py-1 pr-3">Container</th>
              <th className="py-1 pr-3">Status</th>
              <th className="py-1 pr-3 text-right">RU</th>
              <th className="py-1 pr-3 text-right">Duration (ms)</th>
              <th className="py-1 pr-3 text-right">Retries</th>
              <th className="py-1">Regions</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && !query.isLoading && (
              <tr>
                <td colSpan={8} className="py-4 text-center text-slate-500">
                  {containerSet
                    ? "No diagnostic entries for the workload's containers yet."
                    : "No diagnostic entries match the current filters."}
                </td>
              </tr>
            )}
            {entries.map((e, i) => (
              <DiagnosticsRow key={`${e.timestamp}-${i}`} entry={e} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DiagnosticsRow({ entry }: { entry: DiagnosticsEntry }) {
  const container = (entry.diagnostics?.container as string | undefined) ?? "—";
  const regions = entry.diagnostics?.regions as string[] | undefined;
  const retryCount = entry.diagnostics?.retryCount as number | undefined;
  const failed = isFailure(entry);

  return (
    <tr className={`border-t border-slate-100 ${failed ? "bg-red-50" : ""}`}>
      <td className="py-1 pr-3 font-mono text-[11px] text-slate-600">
        {entry.timestamp.replace("T", " ").replace(/\.\d+Z$/, "Z")}
      </td>
      <td className="py-1 pr-3">{entry.operation}</td>
      <td className="py-1 pr-3 font-mono text-[11px]">{container}</td>
      <td className="py-1 pr-3">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusPalette(entry.statusCode)}`}>
          {entry.statusCode ?? "?"}
        </span>
      </td>
      <td className="py-1 pr-3 text-right tabular-nums font-mono">
        {entry.requestCharge?.toFixed(2) ?? "—"}
      </td>
      <td className="py-1 pr-3 text-right tabular-nums font-mono">
        {entry.durationMs?.toFixed(2) ?? "—"}
      </td>
      <td className="py-1 pr-3 text-right tabular-nums">{retryCount ?? 0}</td>
      <td className="py-1 text-[11px] text-slate-600">
        {regions?.join(", ") || "—"}
      </td>
    </tr>
  );
}
