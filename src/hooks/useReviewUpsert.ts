import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Review } from "../api/types";
import { useSelectedSdk } from "./useCapabilities";

/**
 * `PUT /api/v1/reviews/{productId}/{id}`. Path values win server-side over body
 * fields, but we still pass the full record so the wire payload matches what a
 * curl-by-hand user would send. Invalidates the cached last-query result on success
 * so a Reviews page that just loaded reviews-for-product can refetch in the
 * background after the user submits a new review.
 */
export function useReviewUpsert() {
  const sdk = useSelectedSdk();
  const qc = useQueryClient();
  return useMutation<Review, Error, Review>({
    mutationFn: (review) =>
      api<Review>(
        `/reviews/${encodeURIComponent(review.productId)}/${encodeURIComponent(review.id)}`,
        {
          sdk,
          method: "PUT",
          body: JSON.stringify(review)
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["query-last", sdk] });
    }
  });
}
