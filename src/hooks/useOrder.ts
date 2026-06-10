import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Order } from "../api/types";
import { useSelectedSdk } from "./useCapabilities";

export interface OrderTuple {
  customerId: string;
  yearMonth: string;
  id: string;
}

/**
 * PUT /api/v1/orders/{customerId}/{yearMonth}/{id}. Used by the checkout
 * flow to materialise a cart into a 3-level-HPK order document. The path's
 * (customerId, yearMonth, id) wins server-side so the body's HPK fields are
 * authoritative-by-construction but the server defends regardless.
 *
 * On success we invalidate the matching cart query so the user sees their
 * cart re-fetched after the order is placed (the checkout page typically
 * follows up by clearing or shortening the cart's TTL).
 */
export function useOrderUpsert() {
  const sdk = useSelectedSdk();
  const queryClient = useQueryClient();
  return useMutation<Order, Error, { tuple: OrderTuple; order: Order }>({
    mutationFn: async ({ tuple, order }) => {
      const path =
        `/orders/${encodeURIComponent(tuple.customerId)}` +
        `/${encodeURIComponent(tuple.yearMonth)}` +
        `/${encodeURIComponent(tuple.id)}`;
      return api<Order>(path, {
        sdk,
        method: "PUT",
        body: JSON.stringify(order)
      });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["cart", sdk, vars.tuple.customerId] });
    }
  });
}
