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
