import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type {
  CacheSnapshot,
  DiagnosticsEntry,
  FeedRangeDto
} from "../api/types";
import { useSelectedSdk } from "./useCapabilities";

/**
 * `GET /api/v1/_meta/diagnostics?last=N`. `refetchIntervalMs` enables polling when
 * the Admin tray's auto-refresh toggle is on; passing `false` disables it. Keyed on
 * (sdk, last) so the SDK switcher invalidates and the limit drives a refetch.
 */
export function useDiagnostics(last: number, refetchIntervalMs: number | false) {
  const sdk = useSelectedSdk();
  return useQuery<DiagnosticsEntry[]>({
    queryKey: ["diagnostics", sdk, last],
    queryFn: () => api<DiagnosticsEntry[]>(`/_meta/diagnostics?last=${last}`, { sdk }),
    refetchInterval: refetchIntervalMs,
    staleTime: 0
  });
}

/**
 * `GET /api/v1/_meta/feed-ranges?container=X`. `enabled` is gated on a non-empty
 * container name to avoid a 400 round-trip when the user hasn't picked one yet.
 */
export function useFeedRanges(container: string) {
  const sdk = useSelectedSdk();
  const trimmed = container.trim();
  return useQuery<FeedRangeDto[]>({
    queryKey: ["feed-ranges", sdk, trimmed],
    enabled: trimmed.length > 0,
    queryFn: () => api<FeedRangeDto[]>(`/_meta/feed-ranges?container=${encodeURIComponent(trimmed)}`, { sdk }),
    staleTime: 30_000
  });
}

/**
 * `GET /api/v1/_meta/caches`. Single snapshot — manual refresh via
 * `queryClient.invalidateQueries` from a button (the snapshot is expensive so we
 * don't poll by default).
 */
export function useCacheSnapshot() {
  const sdk = useSelectedSdk();
  return useQuery<CacheSnapshot>({
    queryKey: ["cache-snapshot", sdk],
    queryFn: () => api<CacheSnapshot>("/_meta/caches", { sdk }),
    staleTime: 30_000
  });
}
