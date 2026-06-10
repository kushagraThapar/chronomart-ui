import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "../api/client";
import type { Cart } from "../api/types";
import { useSelectedSdk } from "./useCapabilities";

/**
 * GET /api/v1/cart/{customerId}. Returns null on 404 so the page can render
 * an "empty cart" state without treating a missing doc as an error.
 */
export function useCart(customerId: string | undefined) {
  const sdk = useSelectedSdk();
  return useQuery<Cart | null>({
    queryKey: ["cart", sdk, customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      try {
        return await api<Cart>(`/cart/${encodeURIComponent(customerId!)}`, { sdk });
      } catch (e) {
        if (isApiError(e) && e.status === 404) return null;
        throw e;
      }
    },
    staleTime: 10_000
  });
}

/**
 * PUT /api/v1/cart/{customerId}. Invalidates the matching cart query on
 * success so the page refreshes against the persisted state (round-tripped
 * `updatedAt` / server-side normalisation of `id`).
 */
export function useCartUpsert(customerId: string | undefined) {
  const sdk = useSelectedSdk();
  const queryClient = useQueryClient();
  return useMutation<Cart, Error, Cart>({
    mutationFn: async (cart: Cart) => {
      return api<Cart>(`/cart/${encodeURIComponent(customerId!)}`, {
        sdk,
        method: "PUT",
        body: JSON.stringify(cart)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", sdk, customerId] });
    }
  });
}
