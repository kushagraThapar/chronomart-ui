import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { VectorSearchRequest, VectorSearchResponse } from "../api/types";
import { useSelectedSdk } from "./useCapabilities";

/**
 * `POST /api/v1/vector/search`. Implemented as a mutation (not a query) because the
 * search is user-initiated — there's no stable URL to put the vector in, and every
 * click should round-trip a fresh `requestCharge` so RU regressions are visible.
 *
 * Caches the last response under `["vector-search-last", sdk]` so adjacent components
 * (e.g. a sidebar with "RU consumed so far") can read it without re-querying. The
 * cached entry is set via `queryClient.setQueryData` in `onSuccess`.
 */
export function useVectorSearch() {
  const sdk = useSelectedSdk();
  const qc = useQueryClient();
  return useMutation<VectorSearchResponse, Error, VectorSearchRequest>({
    mutationFn: (req) => api<VectorSearchResponse>("/vector/search", {
      sdk,
      method: "POST",
      body: JSON.stringify(req)
    }),
    onSuccess: (data) => {
      qc.setQueryData(["vector-search-last", sdk], data);
    }
  });
}
