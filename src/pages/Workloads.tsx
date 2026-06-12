import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { CachesDiff } from "../components/CachesDiff";
import { CachesPanel } from "../components/CachesPanel";
import { DiagnosticsPanel } from "../components/DiagnosticsPanel";
import { ErrorPanel } from "../components/ErrorPanel";
import { PageShell } from "../components/PageShell";
import { Stat } from "../components/Stat";
import { api, isApiError } from "../api/client";
import type { CacheSnapshot, WorkloadProgress, WorkloadSpec } from "../api/types";
import { useSelectedSdk } from "../hooks/useCapabilities";
import {
  useStartWorkload,
  useStopWorkload,
  useWorkloadProgress,
  useWorkloadRuns
} from "../hooks/useWorkloads";

const PROGRESS_POLL_MS = 1_000;
const TERMINAL_STATUSES = new Set(["COMPLETED", "STOPPED", "FAILED"]);
const POST_SNAPSHOT_MAX_RETRIES = 5;
const POST_SNAPSHOT_RETRY_DELAY_MS = 1_000;
// Last-N diagnostic entries to surface inside an ActiveRunPanel — small enough to keep
// the embedded view readable, large enough to catch the most recent failures or slow ops.
const EMBEDDED_DIAGNOSTICS_LAST = 20;

// Built-in presets — mirrors infra/workloads/*.json. The hpk-hotspot, vector-throughput,
// and bulk-ingest entries target ops PR2 will light up (hpkPointRead, vectorSearch, bulk);
// the runner returns a friendly "not yet implemented" 400 in PR1 so users see the wire
// surface before the engine lights up.
const PRESETS: Record<string, WorkloadSpec> = {
  "hot-seller-mix": {
    name: "hot-seller-mix",
    durationSeconds: 30,
    concurrency: 16,
    rampSeconds: 0,
    steps: [
      {
        op: "pointRead",
        container: "Products",
        weight: 70,
        params: { ids: ["prod-001", "prod-002", "prod-003"], partitionKeys: ["seller-001"] }
      },
      {
        op: "query",
        container: "Products",
        weight: 25,
        params: {
          query: "SELECT * FROM c WHERE c.sellerId = @s",
          parameters: [{ name: "@s", value: "seller-001" }],
          partitionKey: "seller-001",
          pageSize: 20
        }
      },
      {
        op: "cartUpsert",
        container: "Cart",
        weight: 5,
        params: { customerIds: ["load-cust-A", "load-cust-B", "load-cust-C", "load-cust-D"] }
      }
    ]
  },
  "cart-ttl-churn": {
    name: "cart-ttl-churn",
    durationSeconds: 30,
    concurrency: 16,
    rampSeconds: 0,
    steps: [
      {
        op: "cartUpsert",
        container: "Cart",
        weight: 80,
        params: {
          customerIds: [
            "churn-A", "churn-B", "churn-C", "churn-D", "churn-E",
            "churn-F", "churn-G", "churn-H", "churn-I", "churn-J"
          ]
        }
      },
      {
        op: "pointRead",
        container: "Cart",
        weight: 20,
        params: {
          ids: ["churn-A", "churn-B", "churn-C", "churn-D", "churn-E", "churn-F", "churn-G", "churn-H", "churn-I", "churn-J"],
          partitionKeys: ["churn-A", "churn-B", "churn-C", "churn-D", "churn-E", "churn-F", "churn-G", "churn-H", "churn-I", "churn-J"]
        }
      }
    ]
  }
};

export function WorkloadsPage() {
  const sdk = useSelectedSdk();
  const [specText, setSpecText] = useState<string>(() =>
    JSON.stringify(PRESETS["hot-seller-mix"], null, 2)
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Cache snapshots captured at run boundaries — see the "What this workload warmed"
  // diff in ActiveRunPanel. Tied to a specific runId so switching to a recent run from
  // RecentRunsPanel doesn't surface a stale diff from a previous run.
  const [snapshotRunId, setSnapshotRunId] = useState<string | null>(null);
  const [preRunSnapshot, setPreRunSnapshot] = useState<CacheSnapshot | null>(null);
  const [postRunSnapshot, setPostRunSnapshot] = useState<CacheSnapshot | null>(null);
  const postCapturedRef = useRef<string | null>(null);
  const postRetryCountRef = useRef(0);
  const postRetryTimerRef = useRef<number | null>(null);

  const startMut = useStartWorkload();
  const stopMut = useStopWorkload();
  const runs = useWorkloadRuns();

  const activeProgress = useWorkloadProgress(activeRunId, PROGRESS_POLL_MS);

  // Containers actually touched by this run — used to scope the embedded diagnostics
  // tray and cache diff so they ignore noise from other backends/pages.
  const activeContainers = useMemo<string[]>(() => {
    const fromSteps = activeProgress.data?.byStep.map((s) => s.container) ?? [];
    return Array.from(new Set(fromSteps));
  }, [activeProgress.data]);

  // Post-run snapshot capture: fires once when status transitions to terminal for
  // the run our pre-snapshot belongs to. `postCapturedRef` keeps it idempotent across
  // re-renders so we don't spam the /_meta/caches endpoint after completion.
  useEffect(() => {
    const status = activeProgress.data?.status;
    if (!status || !TERMINAL_STATUSES.has(status)) return;
    if (!activeRunId || activeRunId !== snapshotRunId) return;
    if (postRetryCountRef.current >= POST_SNAPSHOT_MAX_RETRIES) return;
    if (postCapturedRef.current === activeRunId) return;
    let cancelled = false;

    const capturePostSnapshot = () => {
      postCapturedRef.current = activeRunId;
      api<CacheSnapshot>("/_meta/caches", { sdk })
        .then((snap) => {
          if (cancelled) return;
          setPostRunSnapshot(snap);
          postRetryCountRef.current = 0;
        })
        .catch(() => {
          // Best-effort — diff just won't render if post-snapshot fails.
          postCapturedRef.current = null;
          if (cancelled) return;
          if (postRetryCountRef.current >= POST_SNAPSHOT_MAX_RETRIES - 1) return;
          postRetryCountRef.current += 1;
          if (postRetryTimerRef.current !== null) {
            window.clearTimeout(postRetryTimerRef.current);
          }
          postRetryTimerRef.current = window.setTimeout(capturePostSnapshot, POST_SNAPSHOT_RETRY_DELAY_MS);
        });
    };

    capturePostSnapshot();
    return () => {
      cancelled = true;
      if (postRetryTimerRef.current !== null) {
        window.clearTimeout(postRetryTimerRef.current);
        postRetryTimerRef.current = null;
      }
    };
  }, [activeProgress.data?.status, activeRunId, snapshotRunId, sdk]);

  useEffect(
    () => () => {
      if (postRetryTimerRef.current !== null) {
        window.clearTimeout(postRetryTimerRef.current);
        postRetryTimerRef.current = null;
      }
    },
    []
  );

  function loadPreset(name: string) {
    const preset = PRESETS[name];
    if (preset) {
      setSpecText(JSON.stringify(preset, null, 2));
      setParseError(null);
    }
  }

  async function start() {
    let spec: WorkloadSpec;
    try {
      spec = JSON.parse(specText) as WorkloadSpec;
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
      return;
    }
    setParseError(null);

    // Capture a fresh pre-run snapshot BEFORE the engine starts so the diff actually
    // reflects what the workload warmed (not the snapshot itself). Best-effort: on
    // failure we still start the run, just without a baseline for the diff.
    let pre: CacheSnapshot | null = null;
    try {
      pre = await api<CacheSnapshot>("/_meta/caches", { sdk });
    } catch {
      pre = null;
    }

    startMut.mutate(spec, {
      onSuccess: (resp) => {
        setActiveRunId(resp.runId);
        setSnapshotRunId(resp.runId);
        setPreRunSnapshot(pre);
        setPostRunSnapshot(null);
        postRetryCountRef.current = 0;
        postCapturedRef.current = null;
        if (postRetryTimerRef.current !== null) {
          window.clearTimeout(postRetryTimerRef.current);
          postRetryTimerRef.current = null;
        }
      }
    });
  }

  return (
    <PageShell title="Workloads" feature="workloads">
      <div className="grid gap-4">
        <SpecEditorPanel
          specText={specText}
          parseError={parseError}
          startError={startMut.error}
          isStarting={startMut.isPending}
          onChange={(t) => {
            setSpecText(t);
            setParseError(null);
          }}
          onLoadPreset={loadPreset}
          onStart={start}
        />

        <ActiveRunPanel
          activeRunId={activeRunId}
          progress={activeProgress.data ?? null}
          isLoading={activeProgress.isLoading}
          error={activeProgress.error}
          onStop={() => activeRunId && stopMut.mutate(activeRunId)}
          isStopping={stopMut.isPending}
          activeContainers={activeContainers}
          snapshotRunId={snapshotRunId}
          preRunSnapshot={preRunSnapshot}
          postRunSnapshot={postRunSnapshot}
        />

        <RecentRunsPanel
          runs={runs.data ?? []}
          isLoading={runs.isLoading}
          activeRunId={activeRunId}
          onSelect={setActiveRunId}
        />
      </div>
    </PageShell>
  );
}

function SpecEditorPanel({
  specText,
  parseError,
  startError,
  isStarting,
  onChange,
  onLoadPreset,
  onStart
}: {
  specText: string;
  parseError: string | null;
  startError: Error | null;
  isStarting: boolean;
  onChange: (t: string) => void;
  onLoadPreset: (name: string) => void;
  onStart: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Workload spec</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Presets:</span>
          {Object.keys(PRESETS).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onLoadPreset(p)}
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50"
            >
              {p}
            </button>
          ))}
        </div>
      </header>
      <textarea
        value={specText}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="mt-3 h-64 w-full rounded-md border border-slate-300 bg-slate-50 p-2 font-mono text-xs"
      />
      {parseError && (
        <div className="mt-2">
          <ErrorPanel title="JSON parse" message={parseError} />
        </div>
      )}
      {startError && (
        <div className="mt-2">
          <ErrorPanel title="Start workload" message={renderApiError(startError)} />
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onStart}
          disabled={isStarting || !!parseError}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          {isStarting ? "Starting…" : "Start workload"}
        </button>
        <span className="text-xs text-slate-500">
          Server caps: concurrency ≤ 64, duration ≤ 1800s.
        </span>
      </div>
    </section>
  );
}

function ActiveRunPanel({
  activeRunId,
  progress,
  isLoading,
  error,
  onStop,
  isStopping,
  activeContainers,
  snapshotRunId,
  preRunSnapshot,
  postRunSnapshot
}: {
  activeRunId: string | null;
  progress: WorkloadProgress | null;
  isLoading: boolean;
  error: Error | null;
  onStop: () => void;
  isStopping: boolean;
  activeContainers: string[];
  snapshotRunId: string | null;
  preRunSnapshot: CacheSnapshot | null;
  postRunSnapshot: CacheSnapshot | null;
}) {
  if (!activeRunId) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        No active workload selected. Start one above or pick a run from the history.
      </section>
    );
  }
  const isRunning = progress?.status === "RUNNING";
  // Cache diff is meaningful only for the run we captured pre-snapshot for; if the
  // user picked a different run from RecentRunsPanel, drop the diff entirely.
  const showCacheDiff = snapshotRunId === activeRunId && !!preRunSnapshot;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">
            Active run · <code className="font-mono text-xs">{activeRunId}</code>
          </h2>
          {progress && (
            <p className="mt-1 text-xs text-slate-500">
              <strong>{progress.name}</strong> · concurrency={progress.concurrency} ·{" "}
              elapsed {progress.elapsedSec}s / planned {progress.plannedDurationSec}s
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {progress && <StatusBadge status={progress.status} />}
          {isRunning && (
            <button
              type="button"
              onClick={onStop}
              disabled={isStopping}
              className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed"
            >
              {isStopping ? "Stopping…" : "Stop"}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mt-3">
          <ErrorPanel title="Progress" message={renderApiError(error)} />
        </div>
      )}

      {isLoading && !progress && (
        <p className="mt-3 text-sm text-slate-500">Loading…</p>
      )}

      {progress && (
        <>
          <SummaryStrip progress={progress} />
          <Charts progress={progress} />
          <PerStepTable progress={progress} />

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {showCacheDiff && (
              <CachesDiff
                before={preRunSnapshot}
                after={postRunSnapshot}
                containerFilter={activeContainers}
                title="What this run warmed (cache diff)"
              />
            )}
            {showCacheDiff && postRunSnapshot && (
              <CachesPanel
                title="Post-run cache snapshot"
                snapshot={postRunSnapshot}
                containerFilter={activeContainers}
                hideRefresh
              />
            )}
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <header className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700">
                Diagnostics (last {EMBEDDED_DIAGNOSTICS_LAST}, filtered to this run&apos;s containers)
              </h3>
              <span className="text-[11px] text-slate-500">
                {isRunning ? "auto-refreshes every 5s while running" : "snapshot at terminal state"}
              </span>
            </header>
            <div className="mt-3">
              <DiagnosticsPanel
                mode="compact"
                compactLast={EMBEDDED_DIAGNOSTICS_LAST}
                autoRefresh={isRunning}
                containerFilter={activeContainers}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SummaryStrip({ progress }: { progress: WorkloadProgress }) {
  const o = progress.overall;
  const errRate = o.count > 0 ? (o.errorCount / o.count) * 100 : 0;
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <Stat label="Ops" value={o.count.toLocaleString()} />
      <Stat label="Ops/sec" value={o.opsPerSec.toFixed(1)} />
      <Stat label="RU/sec" value={o.ruPerSec.toFixed(1)} />
      <Stat label="Total RU" value={o.totalRu.toFixed(0)} />
      <Stat label="p50 (ms)" value={o.latencyP50Ms.toFixed(2)} />
      <Stat label="p95 (ms)" value={o.latencyP95Ms.toFixed(2)} />
      <Stat
        label="Errors"
        value={`${o.errorCount} (${errRate.toFixed(1)}%)`}
        accent={o.errorCount > 0 ? "red" : undefined}
      />
    </div>
  );
}

function Charts({ progress }: { progress: WorkloadProgress }) {
  const data = useMemo(
    () =>
      progress.timeSeries.map((t) => ({
        elapsedSec: t.elapsedSec,
        ops: t.ops,
        errors: t.errors,
        ru: Number(t.ru.toFixed(2)),
        latencyMeanMs: Number(t.latencyMeanMs.toFixed(2))
      })),
    [progress.timeSeries]
  );
  if (data.length === 0) {
    return (
      <p className="mt-4 text-xs text-slate-500">
        Waiting for first 1-second sample…
      </p>
    );
  }
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Throughput (per second)
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="elapsedSec" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="ops" fill="#10b981" name="Ops" />
            <Bar dataKey="errors" fill="#ef4444" name="Errors" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          RU/sec & latency (mean, per second)
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="elapsedSec" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="ru" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="lat" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Line
              yAxisId="ru"
              type="monotone"
              dataKey="ru"
              stroke="#2563eb"
              dot={false}
              name="RU/s"
            />
            <Line
              yAxisId="lat"
              type="monotone"
              dataKey="latencyMeanMs"
              stroke="#f59e0b"
              dot={false}
              name="Latency mean (ms)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PerStepTable({ progress }: { progress: WorkloadProgress }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Per-step breakdown
      </h3>
      <table className="mt-2 w-full text-xs">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-1 pr-3">Op</th>
            <th className="py-1 pr-3">Container</th>
            <th className="py-1 pr-3 text-right">Count</th>
            <th className="py-1 pr-3 text-right">Errors</th>
            <th className="py-1 pr-3 text-right">Ops/s</th>
            <th className="py-1 pr-3 text-right">RU/s</th>
            <th className="py-1 pr-3 text-right">Total RU</th>
            <th className="py-1 pr-3 text-right">p50 (ms)</th>
            <th className="py-1 pr-3 text-right">p95 (ms)</th>
            <th className="py-1 text-right">p99 (ms)</th>
          </tr>
        </thead>
        <tbody>
          {progress.byStep.map((s) => (
            <tr key={`${s.op}:${s.container}`} className="border-t border-slate-100">
              <td className="py-1 pr-3 font-mono">{s.op}</td>
              <td className="py-1 pr-3 font-mono">{s.container}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{s.count.toLocaleString()}</td>
              <td className={`py-1 pr-3 text-right tabular-nums ${s.errorCount > 0 ? "text-red-700" : ""}`}>
                {s.errorCount}
              </td>
              <td className="py-1 pr-3 text-right tabular-nums">{s.opsPerSec.toFixed(1)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{s.ruPerSec.toFixed(1)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{s.totalRu.toFixed(0)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{s.latencyP50Ms.toFixed(2)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{s.latencyP95Ms.toFixed(2)}</td>
              <td className="py-1 text-right tabular-nums">{s.latencyP99Ms.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentRunsPanel({
  runs,
  isLoading,
  activeRunId,
  onSelect
}: {
  runs: WorkloadProgress[];
  isLoading: boolean;
  activeRunId: string | null;
  onSelect: (runId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Recent runs</h2>
        <span className="text-xs text-slate-500">{runs.length} in ring buffer (max 50)</span>
      </header>
      {isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
      {!isLoading && runs.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">No runs yet. Start one above.</p>
      )}
      {runs.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 pr-3">Run</th>
                <th className="py-1 pr-3">Name</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3">Started</th>
                <th className="py-1 pr-3 text-right">Ops</th>
                <th className="py-1 pr-3 text-right">Errors</th>
                <th className="py-1 pr-3 text-right">Ops/s</th>
                <th className="py-1 text-right">Total RU</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr
                  key={r.runId}
                  className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${r.runId === activeRunId ? "bg-blue-50" : ""}`}
                  onClick={() => onSelect(r.runId)}
                >
                  <td className="py-1 pr-3 font-mono">{r.runId}</td>
                  <td className="py-1 pr-3">{r.name}</td>
                  <td className="py-1 pr-3"><StatusBadge status={r.status} /></td>
                  <td className="py-1 pr-3 font-mono text-[11px] text-slate-600">
                    {r.startedAt.replace("T", " ").replace(/\.\d+Z$/, "Z")}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">{r.overall.count.toLocaleString()}</td>
                  <td className={`py-1 pr-3 text-right tabular-nums ${r.overall.errorCount > 0 ? "text-red-700" : ""}`}>
                    {r.overall.errorCount}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">{r.overall.opsPerSec.toFixed(1)}</td>
                  <td className="py-1 text-right tabular-nums">{r.overall.totalRu.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: WorkloadProgress["status"] }) {
  const palette: Record<WorkloadProgress["status"], string> = {
    PENDING: "bg-slate-200 text-slate-700",
    RUNNING: "bg-blue-200 text-blue-800",
    COMPLETED: "bg-emerald-200 text-emerald-800",
    STOPPED: "bg-amber-200 text-amber-800",
    FAILED: "bg-red-200 text-red-800"
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${palette[status] ?? palette.PENDING}`}>
      {status}
    </span>
  );
}

function renderApiError(e: Error): string {
  if (isApiError(e)) {
    const body = e.body as { error?: { message?: string } } | undefined;
    const msg = body?.error?.message;
    return msg ? `${e.message}: ${msg}` : e.message;
  }
  return e.message;
}
