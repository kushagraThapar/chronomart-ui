import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Page, Product } from "../api/types";
import { useSelectedSdk } from "./useCapabilities";

export interface UseProductsArgs {
  sellerId?: string;
  pageSize: number;
}

/**
 * Paginated product list keyed on (sdk, sellerId, pageSize). Each TanStack page maps
 * 1:1 to a backend `Page<Product>` so the UI can show every continuation token
 * delivered by the SDK — the whole point of this surface. Empty/blank sellerId
 * collapses to "no filter" (cross-partition scan).
 */
export function useProductsInfinite({ sellerId, pageSize }: UseProductsArgs) {
  const sdk = useSelectedSdk();
  const filter = sellerId?.trim() || undefined;
  return useInfiniteQuery<Page<Product>>({
    queryKey: ["products", sdk, filter ?? "*", pageSize],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("pageSize", String(pageSize));
      if (filter) params.set("sellerId", filter);
      if (typeof pageParam === "string" && pageParam) {
        params.set("continuation", pageParam);
      }
      return api<Page<Product>>(`/products?${params.toString()}`, { sdk });
    },
    getNextPageParam: (lastPage) => lastPage.continuation ?? undefined,
    staleTime: 30_000
  });
}

/**
 * Point read by (sellerId, id). Returns undefined data on 404 so the UI can render
 * a "not found" surface instead of treating it as a hard error.
 */
export function useProduct(sellerId: string | undefined, id: string | undefined) {
  const sdk = useSelectedSdk();
  return useQuery<Product | null>({
    queryKey: ["product", sdk, sellerId, id],
    enabled: Boolean(sellerId && id),
    queryFn: async () => {
      try {
        return await api<Product>(`/products/${encodeURIComponent(sellerId!)}/${encodeURIComponent(id!)}`, { sdk });
      } catch (e) {
        // ApiError thrown by api() carries .status; treat 404 as "no product" so the
        // detail page can render its own empty state rather than a generic error.
        const err = e as { status?: number };
        if (err?.status === 404) return null;
        throw e;
      }
    },
    staleTime: 30_000
  });
}
