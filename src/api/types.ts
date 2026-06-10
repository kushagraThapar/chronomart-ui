export interface CapabilityManifest {
  sdk: string;
  sdkVersion: string;
  apiVersions: string[];
  features: Record<string, boolean | string | string[]>;
  limits?: Record<string, number>;
  stub?: boolean;
  reason?: string;
}

/**
 * Product as returned by `GET /api/v1/products`. Mirrors
 * `chronomart-app/contracts/openapi.yaml#/components/schemas/Product`. Optional fields
 * may be omitted by the backend's NON_NULL Jackson serialization.
 */
export interface Product {
  id: string;
  sellerId: string;
  categoryId?: string;
  name: string;
  brand?: string;
  model?: string;
  priceUsd: number;
  currency?: string;
  attributes?: Record<string, unknown>;
  tags?: string[];
  images?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Generic paged response. Mirrors `chronomart-app/.../web/dto/Page.java` —
 * `continuation` is the opaque Cosmos continuation token for the next page, or null
 * when there are no more pages.
 */
export interface Page<T> {
  items: T[];
  continuation: string | null;
}

/**
 * Cart line item. Mirrors `chronomart-app/.../domain/CartItem.java`. The cart
 * itself is one document per customer; items are an inline array (no per-line PK).
 */
export interface CartItem {
  productId: string;
  qty: number;
  addedAt?: string;
}

/**
 * Cart document. PK = `/customerId`. One doc per customer; `id` is set to
 * `customerId` by the backend so reads are point reads. `ttl` is a per-doc
 * override: null/omitted inherits the 7-day container default, -1 disables TTL
 * on this doc, positive integer is seconds until expiry.
 */
export interface Cart {
  id: string;
  customerId: string;
  items: CartItem[];
  updatedAt?: string;
  ttl?: number | null;
}

/**
 * Order line item. Mirrors `Order.OrderItem`. `sellerId` is optional (denormalised
 * for analytics; we set it when the cart was populated from the catalog).
 */
export interface OrderItem {
  productId: string;
  sellerId?: string;
  qty: number;
  unitPriceUsd: number;
}

/**
 * Order document. PK is the 3-level hierarchical tuple `(/customerId, /yearMonth, /id)`
 * so customer-month queries get prefix routing while full-tuple point reads route to a
 * single physical partition. `yearMonth` must match the YYYY-MM pattern; `status` is
 * one of pending|paid|shipped|delivered|cancelled.
 */
export interface Order {
  id: string;
  customerId: string;
  yearMonth: string;
  status?: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
  items: OrderItem[];
  totalUsd: number;
  createdAt?: string;
  shippedAt?: string;
}

/**
 * Marketplace seller. PK = `/id`. Mirrors `chronomart-app/.../domain/Seller.java`.
 * `rating` is 0..5 (one decimal). `joinedAt` is ISO-8601.
 */
export interface Seller {
  id: string;
  name: string;
  country?: string;
  rating?: number;
  joinedAt?: string;
}

/**
 * Request body for `POST /api/v1/vector/search`. Mirrors `VectorSearchRequest`.
 * `vector.length` must equal the container's embedding dimension (1024 for
 * `ProductVectors`). `k` is 1..100; backend applies a default if omitted.
 */
export interface VectorSearchRequest {
  container: string;
  vector: number[];
  k?: number;
}

/**
 * One row in `VectorSearchResponse.matches`. `score` is the raw `VectorDistance()`
 * value — its meaning depends on the container's distance function. For COSINE
 * (used by `ProductVectors`) it is cosine similarity (~1.0 for an exact match);
 * results are always ordered most-similar-first regardless of the underlying sign.
 * `document` includes the full raw record (including the embedding) for inspection.
 */
export interface VectorMatch {
  id: string;
  productId?: string;
  sellerId?: string;
  name?: string;
  score?: number;
  document?: Record<string, unknown>;
}

/**
 * Response body for `POST /api/v1/vector/search`. `requestCharge` is the RU consumed
 * by the underlying `byPage().next()` call — a wildly higher value than expected for
 * a small container is a signal the DiskANN index was not used.
 */
export interface VectorSearchResponse {
  matches: VectorMatch[];
  requestCharge: number;
}

/**
 * Product review. PK = `/productId`. Mirrors `chronomart-app/.../domain/Review.java`.
 * `rating` is an integer 1..5. The container is queried via `/api/v1/queries/run`
 * (no list endpoint); writes go through `PUT /api/v1/reviews/{productId}/{id}`.
 */
export interface Review {
  id: string;
  productId: string;
  customerId: string;
  rating: number;
  title?: string;
  body?: string;
  createdAt?: string;
}

/**
 * Request body for `POST /api/v1/queries/run`. Mirrors `QueryRequest`. `partitionKey`
 * accepts either a single string (single-level PK) or an array of strings/numbers/
 * booleans for hierarchical PKs. `enableCrossPartition` is opt-in (default false);
 * the backend rejects requests with neither `partitionKey` nor `enableCrossPartition=true`.
 */
export interface QueryRequest {
  container: string;
  query: string;
  parameters?: { name: string; value: unknown }[];
  partitionKey?: string | (string | number | boolean)[];
  pageSize?: number;
  continuation?: string | null;
  enableCrossPartition?: boolean;
  maxConcurrency?: number;
}

/**
 * Response body for `POST /api/v1/queries/run`. `items` is `Object[]` on the wire
 * (the backend types it as `Object` so it can return both document-shaped maps and
 * scalar projections like `SELECT VALUE COUNT(1) FROM c`); callers narrow per query.
 * `requestCharge` is the RU consumed by this single round-trip page.
 */
export interface QueryResponse<T = unknown> {
  items: T[];
  continuation?: string | null;
  requestCharge?: number;
  diagnostics?: Record<string, unknown>;
}
