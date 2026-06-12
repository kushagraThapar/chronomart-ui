import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorPanel } from "./ErrorPanel";
import { useCacheSnapshot } from "../hooks/useDiagnostics";
import { useSelectedSdk } from "../hooks/useCapabilities";
import type { CacheContainerEntry, CachePkRangeEntry, CacheSnapshot } from "../api/types";

/**
 * `CachesPanel` renders the gateway-mode SDK's best-effort cache snapshot from
 * `/api/v1/_meta/caches`. By default it fetches via TanStack Query and shows a
 * refresh button. When given an explicit `snapshot` prop, it skips fetching and
 * just renders the snapshot you passed in — used by the workloads page so a
 * captured pre/post-run snapshot can be displayed without colliding with the
 * Admin page's live cache state.
 */
export function CachesPanel({
  title = "Cache snapshot",
  snapshot,
  hideRefresh = false,
  containerFilter
}: {
  title?: string;
  snapshot?: CacheSnapshot | null;
  hideRefresh?: boolean;
  containerFilter?: string[];
}) {
  const sdk = useSelectedSdk();
  const qc = useQueryClient();
  const query = useCacheSnapshot();

  const useExternal = snapshot !== undefined;
  const data = useExternal ? snapshot : query.data;
  const isLoading = !useExternal && query.isLoading;
  const isFetching = !useExternal && query.isFetching;
  const error = useExternal ? null : query.error;

  const rangeMap = useMemo(() => buildRangeMap(data?.pkRangeCache), [data]);

  const containerSet = useMemo(
    () => (containerFilter && containerFilter.length > 0 ? new Set(containerFilter) : null),
    [containerFilter]
  );

  const rows = useMemo(() => {
    const list = data?.containerCache ?? [];
    return containerSet ? list.filter((c) => containerSet.has(c.container)) : list;
  }, [data, containerSet]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {!hideRefresh && !useExternal && (
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ["cache-snapshot", sdk] })}
            disabled={isFetching}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </header>
      <p className="mt-1 text-xs text-slate-500">
        Best-effort: derived from <code>container.read()</code> + <code>getFeedRanges()</code> per
        allow-listed container — the SDK doesn&apos;t expose its internal caches publicly.
      </p>

      {isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
      {error && (
        <div className="mt-3">
          <ErrorPanel title="Cache snapshot" message={String(error.message)} />
        </div>
      )}

      {data && (
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
              {rows.map((c) => (
                <CacheRow
                  key={c.container}
                  entry={c}
                  rangeCount={c.rid ? rangeMap.get(c.rid)?.ranges.length : undefined}
                />
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

function buildRangeMap(
  entries: CachePkRangeEntry[] | undefined
): Map<string, CachePkRangeEntry> {
  const m = new Map<string, CachePkRangeEntry>();
  if (!entries) return m;
  for (const e of entries) {
    if (e.containerRid) m.set(e.containerRid, e);
  }
  return m;
}
