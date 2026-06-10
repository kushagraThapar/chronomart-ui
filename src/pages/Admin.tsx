import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "../components/PageShell";
import { ErrorPanel } from "../components/ErrorPanel";
import { useCapabilities, useSelectedSdk } from "../hooks/useCapabilities";
import {
  useCacheSnapshot,
  useDiagnostics,
  useFeedRanges
} from "../hooks/useDiagnostics";
import type {
  CacheContainerEntry,
  CachePkRangeEntry,
  DiagnosticsEntry
} from "../api/types";

const LAST_OPTIONS = [10, 25, 50, 100, 250, 500, 1000] as const;
const REFRESH_INTERVAL_MS = 5_000;

export function AdminPage() {
  return (
    <PageShell title="Admin">
      <div className="grid gap-4">
        <CapabilitiesPanel />
        <DiagnosticsPanel />
        <FeedRangesPanel />
        <CachesPanel />
      </div>
    </PageShell>
  );
}

function CapabilitiesPanel() {
  const { data, error, isLoading } = useCapabilities();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Capability manifest</h2>
        {data && (
          <span className="text-xs text-slate-500">
            <code className="rounded bg-slate-100 px-1">{data.sdk}</code> ·{" "}
            <code className="rounded bg-slate-100 px-1">{data.sdkVersion}</code>
          </span>
        )}
      </header>
      {isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
      {error && <ErrorPanel title="Capabilities" message={String(error.message)} />}
      {data && (
        <div className="mt-3 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Features
            </h3>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {Object.entries(data.features).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-700">{k}</span>
                  <FeatureBadge value={v} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            {data.limits && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Limits
                </h3>
                <ul className="mt-2 text-sm">
                  {Object.entries(data.limits).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between border-b border-slate-100 py-1">
                      <span className="text-slate-700">{k}</span>
                      <code className="text-slate-900 font-mono">{v}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {data.apiVersions?.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                api versions:{" "}
                {data.apiVersions.map((v) => (
                  <code key={v} className="ml-1 rounded bg-slate-100 px-1">{v}</code>
                ))}
              </p>
            )}
            {data.stub && (
              <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Backend is a stub. <em>{data.reason ?? "no reason provided"}</em>
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FeatureBadge({ value }: { value: boolean | string | string[] }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
        true
      </span>
    ) : (
      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
        false
      </span>
    );
  }
  if (Array.isArray(value)) {
    return (
      <code className="text-[11px] text-slate-700">
        {value.length === 0 ? "[]" : `[${value.join(", ")}]`}
      </code>
    );
  }
  return <code className="text-[11px] text-slate-700">{value}</code>;
}

function DiagnosticsPanel() {
  const [last, setLast] = useState<number>(50);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [filter, setFilter] = useState<string>("");
  const [showFailuresOnly, setShowFailuresOnly] = useState<boolean>(false);

  const sdk = useSelectedSdk();
  const qc = useQueryClient();
  const query = useDiagnostics(last, autoRefresh ? REFRESH_INTERVAL_MS : false);

  const entries = useMemo(() => {
    const list = query.data ?? [];
    return list.filter((e) => {
      if (showFailuresOnly && !isFailure(e)) return false;
      if (filter) {
        const text = `${e.operation} ${e.diagnostics?.container ?? ""}`.toLowerCase();
        if (!text.includes(filter.toLowerCase())) return false;
      }
      return true;
    });
  }, [query.data, filter, showFailuresOnly]);

  const totalRu = entries.reduce((sum, e) => sum + (e.requestCharge ?? 0), 0);
  const failures = entries.filter(isFailure).length;
  const avgDuration =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + (e.durationMs ?? 0), 0) / entries.length
      : 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">SDK diagnostics tray</h2>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {query.isFetching && <span>refreshing…</span>}
          <span>last fetched: {timeAgo(query.dataUpdatedAt)}</span>
        </div>
      </header>

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
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
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

      {query.error && (
        <div className="mt-3">
          <ErrorPanel title="Diagnostics" message={String(query.error.message)} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <Stat label="Entries" value={String(entries.length)} />
        <Stat label="Failures" value={String(failures)} accent={failures > 0 ? "red" : undefined} />
        <Stat label="Total RU" value={totalRu.toFixed(2)} />
        <Stat label="Avg duration (ms)" value={avgDuration.toFixed(2)} />
      </div>

      <div className="mt-3 overflow-x-auto">
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
                  No diagnostic entries match the current filters.
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
    <>
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
    </>
  );
}

function FeedRangesPanel() {
  const { data: caps } = useCapabilities();
  const containers = useMemo(() => {
    // We don't have a containers list endpoint; the capabilities manifest doesn't
    // either. Seed common ones — the backend allow-list rejects anything else.
    return [
      "Products", "ProductsHpk", "Sellers", "Customers", "Orders",
      "Reviews", "Cart", "Inventory", "ProductVectors", "ChangeFeedLease"
    ];
  }, [caps]);
  const [container, setContainer] = useState<string>("Products");
  const query = useFeedRanges(container);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Feed ranges</h2>
        <span className="text-xs text-slate-500">
          GET <code className="rounded bg-slate-100 px-1">/_meta/feed-ranges?container={container}</code>
        </span>
      </header>

      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
        <label className="flex flex-col text-sm">
          <span className="text-slate-600 font-medium">Container</span>
          <select
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            className="mt-1 w-56 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-mono"
          >
            {containers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </form>

      {query.error && (
        <div className="mt-3">
          <ErrorPanel title="Feed ranges" message={String(query.error.message)} />
        </div>
      )}

      {query.data && (
        <>
          <p className="mt-3 text-xs text-slate-500">
            <strong>{query.data.length}</strong> range{query.data.length === 1 ? "" : "s"}{" "}
            (SDK-known feed-range count = physical partition count of <code>{container}</code>)
          </p>
          <ul className="mt-2 grid gap-1 text-[11px]">
            {query.data.map((r, i) => (
              <li key={i} className="rounded bg-slate-50 p-2 font-mono break-all">
                {r.opaque ?? "(opaque token unavailable)"}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function CachesPanel() {
  const sdk = useSelectedSdk();
  const qc = useQueryClient();
  const query = useCacheSnapshot();
  const rangeMap = useMemo(() => {
    const m = new Map<string, CachePkRangeEntry>();
    for (const e of query.data?.pkRangeCache ?? []) {
      if (e.containerRid) m.set(e.containerRid, e);
    }
    return m;
  }, [query.data]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Cache snapshot</h2>
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: ["cache-snapshot", sdk] })}
          disabled={query.isFetching}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
        >
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </header>
      <p className="mt-1 text-xs text-slate-500">
        Best-effort: derived from <code>container.read()</code> + <code>getFeedRanges()</code> per
        allow-listed container — the SDK doesn't expose its internal caches publicly.
      </p>

      {query.error && (
        <div className="mt-3">
          <ErrorPanel title="Cache snapshot" message={String(query.error.message)} />
        </div>
      )}

      {query.data && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 pr-3">Container</th>
                <th className="py-1 pr-3">RID</th>
                <th className="py-1 pr-3 text-right">PK ranges</th>
                <th className="py-1 pr-3">Snapshot at</th>
                <th className="py-1">Error</th>
              </tr>
            </thead>
            <tbody>
              {query.data.containerCache.map((c) => (
                <CacheRow key={c.container} entry={c} rangeCount={c.rid ? rangeMap.get(c.rid)?.ranges.length : undefined} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CacheRow({
  entry,
  rangeCount
}: {
  entry: CacheContainerEntry;
  rangeCount: number | undefined;
}) {
  const failed = Boolean(entry.error);
  return (
    <tr className={`border-t border-slate-100 ${failed ? "bg-red-50" : ""}`}>
      <td className="py-1 pr-3 font-mono">{entry.container}</td>
      <td className="py-1 pr-3 font-mono text-[11px] break-all">{entry.rid ?? "—"}</td>
      <td className="py-1 pr-3 text-right tabular-nums">{rangeCount ?? "—"}</td>
      <td className="py-1 pr-3 font-mono text-[11px] text-slate-600">{entry.snapshotAt ?? "—"}</td>
      <td className="py-1 text-[11px] text-red-700">{entry.error ?? ""}</td>
    </tr>
  );
}

function Stat({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent?: "red";
}) {
  const valueCls =
    accent === "red" ? "text-red-700" : "text-slate-800";
  return (
    <span className="inline-flex flex-col rounded bg-slate-50 px-2 py-1">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`font-mono text-sm ${valueCls}`}>{value}</span>
    </span>
  );
}

function isFailure(e: DiagnosticsEntry): boolean {
  if (e.diagnostics && typeof e.diagnostics.isFailure === "boolean") {
    return e.diagnostics.isFailure;
  }
  return typeof e.statusCode === "number" && e.statusCode >= 400;
}

function statusPalette(status?: number): string {
  if (status == null) return "bg-slate-200 text-slate-700";
  if (status >= 500) return "bg-red-200 text-red-800";
  if (status >= 400) return "bg-amber-200 text-amber-800";
  if (status >= 300) return "bg-blue-200 text-blue-800";
  return "bg-emerald-200 text-emerald-800";
}

function timeAgo(t: number): string {
  if (!t) return "—";
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}
