import { useMemo } from "react";
import type { CacheContainerEntry, CachePkRangeEntry, CacheSnapshot } from "../api/types";

/**
 * `CachesDiff` shows what changed between a pre-run and post-run cache snapshot —
 * i.e. what the workload warmed (or triggered a split/merge for).
 *
 * Per-container row: pre PK range count, post PK range count, delta, RID change
 * flag. Rows whose pre and post are identical are folded away by default.
 *
 * Diff semantics:
 * - delta > 0 → workload (or its initial container.read fan-out) warmed new
 *   logical ranges into the SDK cache, or a split happened mid-run.
 * - delta < 0 → merge or eviction (rare on the local emulator; flagged amber so
 *   it's hard to miss).
 * - RID changed → container was recreated between snapshots (shouldn't happen
 *   inside a single workload run; flagged red).
 *
 * `containerFilter` restricts the table to the containers the workload's steps
 * actually touched. Unfiltered diff (e.g. when displayed on `/admin`) shows all
 * allow-listed containers.
 */
export function CachesDiff({
  before,
  after,
  containerFilter,
  title = "Cache diff (pre vs post)"
}: {
  before: CacheSnapshot | null;
  after: CacheSnapshot | null;
  containerFilter?: string[];
  title?: string;
}) {
  const rows = useMemo(
    () => computeDiff(before, after, containerFilter),
    [before, after, containerFilter]
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="text-xs text-slate-500">
          {!before && !after && "(no snapshots captured yet)"}
          {before && !after && "(awaiting post-run snapshot…)"}
          {before && after && `${rows.length} container${rows.length === 1 ? "" : "s"}`}
        </span>
      </header>
      <p className="mt-1 text-xs text-slate-500">
        PK-range count delta is what the workload (or its initial fan-out) warmed.
        Splits land as <code>+N</code>; merges as <code>-N</code>; container recreations
        flag a RID change. RID change inside a single workload run is anomalous.
      </p>

      {before && after && rows.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">No cache changes between snapshots.</p>
      )}

      {before && after && rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 pr-3">Container</th>
                <th className="py-1 pr-3 text-right">Pre ranges</th>
                <th className="py-1 pr-3 text-right">Post ranges</th>
                <th className="py-1 pr-3 text-right">Δ</th>
                <th className="py-1 pr-3">RID</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <DiffRow key={r.container} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface DiffRowData {
  container: string;
  preRanges: number | null;
  postRanges: number | null;
  ridChanged: boolean;
  preRid: string | null;
  postRid: string | null;
  preError: string | null;
  postError: string | null;
}

function computeDiff(
  before: CacheSnapshot | null,
  after: CacheSnapshot | null,
  containerFilter: string[] | undefined
): DiffRowData[] {
  if (!before || !after) return [];

  const preByName = byContainer(before.containerCache);
  const postByName = byContainer(after.containerCache);
  const preRangesByRid = ridRangeCount(before.pkRangeCache);
  const postRangesByRid = ridRangeCount(after.pkRangeCache);

  const allNames = new Set<string>();
  for (const c of preByName.keys()) allNames.add(c);
  for (const c of postByName.keys()) allNames.add(c);

  const filter =
    containerFilter && containerFilter.length > 0 ? new Set(containerFilter) : null;

  const result: DiffRowData[] = [];
  for (const name of Array.from(allNames).sort()) {
    if (filter && !filter.has(name)) continue;
    const pre = preByName.get(name) ?? null;
    const post = postByName.get(name) ?? null;
    const preRid = pre?.rid ?? null;
    const postRid = post?.rid ?? null;
    const preRanges = preRid ? preRangesByRid.get(preRid) ?? null : null;
    const postRanges = postRid ? postRangesByRid.get(postRid) ?? null : null;
    const ridChanged = !!preRid && !!postRid && preRid !== postRid;

    const noChange =
      preRanges === postRanges &&
      !ridChanged &&
      (pre?.error ?? null) === (post?.error ?? null);
    if (noChange) continue;

    result.push({
      container: name,
      preRanges,
      postRanges,
      ridChanged,
      preRid,
      postRid,
      preError: pre?.error ?? null,
      postError: post?.error ?? null
    });
  }
  return result;
}

function byContainer(
  entries: CacheContainerEntry[]
): Map<string, CacheContainerEntry> {
  const m = new Map<string, CacheContainerEntry>();
  for (const e of entries) m.set(e.container, e);
  return m;
}

function ridRangeCount(entries: CachePkRangeEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    if (e.containerRid) m.set(e.containerRid, e.ranges.length);
  }
  return m;
}

function DiffRow({ row }: { row: DiffRowData }) {
  const delta =
    row.preRanges != null && row.postRanges != null
      ? row.postRanges - row.preRanges
      : null;
  const deltaCls =
    delta == null
      ? "text-slate-500"
      : delta > 0
        ? "text-emerald-700"
        : delta < 0
          ? "text-amber-700"
          : "text-slate-500";
  const rowCls = row.ridChanged ? "bg-red-50" : "";
  const notes: string[] = [];
  if (row.ridChanged) notes.push("RID changed (container recreated)");
  if (delta != null && delta > 0) notes.push("split / warmed");
  if (delta != null && delta < 0) notes.push("merge / evicted");
  if (row.preError && !row.postError) notes.push("error cleared");
  if (!row.preError && row.postError) notes.push("error appeared");

  return (
    <tr className={`border-t border-slate-100 ${rowCls}`}>
      <td className="py-1 pr-3 font-mono">{row.container}</td>
      <td className="py-1 pr-3 text-right tabular-nums">{row.preRanges ?? "—"}</td>
      <td className="py-1 pr-3 text-right tabular-nums">{row.postRanges ?? "—"}</td>
      <td className={`py-1 pr-3 text-right tabular-nums font-semibold ${deltaCls}`}>
        {delta == null ? "—" : delta > 0 ? `+${delta}` : String(delta)}
      </td>
      <td className="py-1 pr-3 font-mono text-[11px] break-all">
        {row.ridChanged ? (
          <span>
            <span className="text-slate-400 line-through">{row.preRid}</span>{" "}
            <span className="text-slate-700">→ {row.postRid}</span>
          </span>
        ) : (
          row.postRid ?? row.preRid ?? "—"
        )}
      </td>
      <td className="py-1 text-[11px] text-slate-600">{notes.join(", ") || "—"}</td>
    </tr>
  );
}
