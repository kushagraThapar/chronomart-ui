import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { WorkloadAnomaly, WorkloadProgress, WorkloadSpec } from "../api/types";
import { useSelectedSdk } from "./useCapabilities";

const TERMINAL_STATUSES = new Set(["COMPLETED", "STOPPED", "FAILED"]);

/**
 * `POST /api/v1/workloads/run` — starts a run, returns `{runId,name,status}`.
 * Invalidates the runs list and active-run query on success so the UI immediately
 * shows the new entry.
 */
export function useStartWorkload() {
  const sdk = useSelectedSdk();
  const qc = useQueryClient();
  return useMutation<{ runId: string; name: string; status: string }, Error, WorkloadSpec>({
    mutationFn: (spec) =>
      api<{ runId: string; name: string; status: string }>("/workloads/run", {
        sdk,
        method: "POST",
        body: JSON.stringify(spec)
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workloads", sdk] });
    }
  });
}

/**
 * `GET /api/v1/workloads/{runId}` — live progress. Polls at `pollMs` until the
 * response itself reports a terminal status (`COMPLETED`, `STOPPED`, `FAILED`),
 * so polling stops as soon as the run ends without waiting for a separate list refresh.
 */
export function useWorkloadProgress(runId: string | null, pollMs: number) {
  const sdk = useSelectedSdk();
  return useQuery<WorkloadProgress>({
    queryKey: ["workload-progress", sdk, runId],
    enabled: !!runId,
    queryFn: () => api<WorkloadProgress>(`/workloads/${runId}`, { sdk }),
    refetchInterval: (query) =>
      !runId || TERMINAL_STATUSES.has(query.state.data?.status ?? "") ? false : pollMs,
    staleTime: 0
  });
}

/**
 * `GET /api/v1/workloads` — most-recent-first list of all runs in the ring buffer.
 * Lightweight enough to refresh every 5s without flooding the backend.
 */
export function useWorkloadRuns() {
  const sdk = useSelectedSdk();
  return useQuery<WorkloadProgress[]>({
    queryKey: ["workloads", sdk],
    queryFn: () => api<WorkloadProgress[]>("/workloads", { sdk }),
    staleTime: 5_000
  });
}

export function useStopWorkload() {
  const sdk = useSelectedSdk();
  const qc = useQueryClient();
  return useMutation<{ runId: string; stopped: boolean }, Error, string>({
    mutationFn: (runId) =>
      api<{ runId: string; stopped: boolean }>(`/workloads/${runId}/stop`, {
        sdk,
        method: "POST"
      }),
    onSuccess: (_data, runId) => {
      qc.invalidateQueries({ queryKey: ["workload-progress", sdk, runId] });
      qc.invalidateQueries({ queryKey: ["workloads", sdk] });
    }
  });
}

/**
 * `GET /api/v1/workloads/{runId}/anomalies` — a page of correctness anomalies for a
 * verification run. Enabled only when the run reported at least one anomaly (`hasAny`),
 * so a clean run never fetches. Anomalies are append-only during a run, so we re-fetch
 * while it's live and stop once it ends.
 */
export function useWorkloadAnomalies(
  runId: string | null,
  hasAny: boolean,
  isLive: boolean,
  limit = 100
) {
  const sdk = useSelectedSdk();
  return useQuery<WorkloadAnomaly[]>({
    queryKey: ["workload-anomalies", sdk, runId],
    enabled: !!runId && hasAny,
    queryFn: () => api<WorkloadAnomaly[]>(`/workloads/${runId}/anomalies?limit=${limit}`, { sdk }),
    refetchInterval: isLive ? 2000 : false,
    staleTime: 0
  });
}
