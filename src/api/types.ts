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
