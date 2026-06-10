import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { QueryRequest, QueryResponse } from "../api/types";
import { useSelectedSdk } from "./useCapabilities";

/**
 * `POST /api/v1/queries/run`. Implemented as a mutation (not a query) because the
 * SQL text is user-controlled and round-trips a fresh `requestCharge` that the UI
 * should always surface for the latest click — no automatic re-execution on focus.
 *
 * Result type is generic so callers can narrow `items` to a domain shape:
 * `useRunQuery<Order>()`, `useRunQuery<Review>()`, etc. Caches the last response
 * under `["query-last", sdk]` so adjacent components can read it without re-querying.
 */
export function useRunQuery<T = unknown>() {
  const sdk = useSelectedSdk();
  const qc = useQueryClient();
  return useMutation<QueryResponse<T>, Error, QueryRequest>({
    mutationFn: (req) =>
      api<QueryResponse<T>>("/queries/run", {
        sdk,
        method: "POST",
        body: JSON.stringify(req)
      }),
    onSuccess: (data) => {
      qc.setQueryData(["query-last", sdk], data);
    }
  });
}
