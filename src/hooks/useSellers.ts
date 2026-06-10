import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "../api/client";
import type { Seller } from "../api/types";
import { useSelectedSdk } from "./useCapabilities";

/**
 * List sellers (single page, no continuation — the container is small and the backend
 * already caps `limit` at 1000). Keyed on (sdk, limit) so SDK switching refetches.
 */
export function useSellers(limit: number = 100) {
  const sdk = useSelectedSdk();
  return useQuery<Seller[]>({
    queryKey: ["sellers", sdk, limit],
    queryFn: () => api<Seller[]>(`/sellers?limit=${limit}`, { sdk }),
    staleTime: 30_000
  });
}

/**
 * Point read by id. Returns null on 404 so the detail page can render a "not found"
 * surface instead of treating it as a hard error — mirrors `useProduct`.
 */
export function useSeller(id: string | undefined) {
  const sdk = useSelectedSdk();
  return useQuery<Seller | null>({
    queryKey: ["seller", sdk, id],
    enabled: !!id,
    queryFn: async () => {
      try {
        return await api<Seller>(`/sellers/${encodeURIComponent(id!)}`, { sdk });
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null;
        throw e;
      }
    },
    staleTime: 30_000
  });
}
