import { useState } from "react";
import { api, getSelectedSdk } from "../api/client";
import { useWorkloadAnomalies } from "../hooks/useWorkloads";
import type { WorkloadProgress } from "../api/types";

/**
 * Correctness-oracle view for a verification run: a summary card (level + anomaly counts by
 * code), a paged anomalies table (severity-coded, with the offending key/seqs), and a
 * "download history" button that pages the op-history artifact for the offline analyzer.
 *
 * Renders nothing when the run had verification disabled (`verificationLevel` absent) so the
 * panel is invisible for plain performance runs.
 */
export function VerificationPanel({ run }: { run: WorkloadProgress }) {
  const level = run.verificationLevel;
  const summary = run.anomalySummary;
  const isLive = run.status === "RUNNING" || run.status === "PENDING";
  const hasAny = (summary?.total ?? 0) > 0;
  const anomalies = useWorkloadAnomalies(run.runId, hasAny, isLive);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!level) return null;

  const errorCount = summary?.errorCount ?? 0;
  const warnCount = summary?.warnCount ?? 0;
  const clean = (summary?.total ?? 0) === 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Correctness verification</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          level <code>{level}</code>
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            clean
              ? "bg-emerald-100 text-emerald-800"
              : errorCount > 0
                ? "bg-red-100 text-red-800"
                : "bg-amber-100 text-amber-800"
          }`}
        >
          {clean ? "✓ no anomalies" : `${errorCount} error${errorCount === 1 ? "" : "s"}` + (warnCount ? `, ${warnCount} warn` : "")}
        </span>
        <button
          type="button"
          onClick={() => downloadHistory(run.runId, setDownloading, setDownloadError)}
          disabled={downloading}
          className="ml-auto rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {downloading ? "Downloading…" : "Download op history (JSON)"}
        </button>
      </header>

      {downloadError && (
        <p className="mt-2 text-xs text-red-700">history download failed: {downloadError}</p>
      )}

      {summary?.byCode && Object.keys(summary.byCode).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(summary.byCode)
            .sort((a, b) => b[1] - a[1])
            .map(([code, n]) => (
              <span
                key={code}
                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700"
                title={code}
              >
                {code} · {n}
              </span>
            ))}
        </div>
      )}

      {clean && (
        <p className="mt-3 text-xs text-slate-500">
          Every checked op satisfied the oracle (self-consistency, {level} temporal rules, and
          domain invariants). Download the op history to re-verify offline.
        </p>
      )}

      {hasAny && (
        <div className="mt-3 overflow-x-auto">
          {anomalies.isLoading && <p className="text-xs text-slate-500">Loading anomalies…</p>}
          {anomalies.error && (
            <p className="text-xs text-red-700">failed to load anomalies: {String(anomalies.error.message)}</p>
          )}
          {anomalies.data && anomalies.data.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-1">Severity</th>
                  <th className="py-1">Code</th>
                  <th className="py-1">Op</th>
                  <th className="py-1">Container</th>
                  <th className="py-1">Key</th>
                  <th className="py-1">Obs/Exp seq</th>
                  <th className="py-1">Detail</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.data.map((a, i) => (
                  <tr key={`${a.opSeqGlobal}-${i}`} className="border-t border-slate-100 align-top">
                    <td className="py-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          a.severity === "ERROR" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {a.severity}
                      </span>
                    </td>
                    <td className="py-1 font-mono">{a.code}</td>
                    <td className="py-1">{a.op}</td>
                    <td className="py-1">{a.container}</td>
                    <td className="py-1 font-mono">{a.key ?? "—"}</td>
                    <td className="py-1 font-mono tabular-nums">
                      {a.observedSeq ?? "—"}/{a.expectedSeq ?? "—"}
                    </td>
                    <td className="py-1 text-slate-600">{a.detail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {summary && summary.total > (anomalies.data?.length ?? 0) && (
            <p className="mt-2 text-[11px] text-slate-500">
              showing first {anomalies.data?.length ?? 0} of {summary.total} — download the history
              for the full record.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * How long to wait before revoking a blob URL created for a programmatic download.
 * Browsers queue the download asynchronously after click(); revoking too soon (i.e.
 * synchronously) races that queue in Firefox/Safari and can silently abort the download.
 * 250 ms is well within the observed browser scheduling window across all major browsers.
 */
const DOWNLOAD_REVOKE_DELAY_MS = 250;

/** Page the op-history artifact and save it as a JSON file (input to the offline analyzer). */
async function downloadHistory(
  runId: string,
  setDownloading: (b: boolean) => void,
  setError: (s: string | null) => void
) {
  setDownloading(true);
  setError(null);
  try {
    const sdk = getSelectedSdk();
    const all: unknown[] = [];
    let offset = 0;
    const limit = 5000;
    // Cap pages to avoid an infinite loop if the backend misbehaves (200 × 5 000 = 1 M records).
    const MAX_PAGES = 200;
    for (let page = 0; page < MAX_PAGES; page++) {
      const chunk = await api<unknown[]>(
        `/workloads/${runId}/history?offset=${offset}&limit=${limit}`,
        { sdk }
      );
      all.push(...chunk);
      if (chunk.length < limit) break;
      offset += chunk.length;
    }
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${runId}-history.json`;
    // Append to the document before clicking — Firefox requires the element to be in the
    // DOM for a programmatic click to trigger a file-save dialog.
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revocation: a synchronous revoke after click() races the browser's download
    // queue in Safari/Firefox and can silently abort the download.
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_REVOKE_DELAY_MS);
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setDownloading(false);
  }
}
