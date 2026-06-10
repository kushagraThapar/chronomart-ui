export const SDKS = ["java", "dotnet", "python", "rust", "go"] as const;
export type Sdk = (typeof SDKS)[number];

const STORAGE_KEY = "chronomart.sdk";

export function getSelectedSdk(): Sdk {
  const v = (typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null) as Sdk | null;
  return v && SDKS.includes(v) ? v : "java";
}

export function setSelectedSdk(sdk: Sdk) {
  localStorage.setItem(STORAGE_KEY, sdk);
  window.dispatchEvent(new CustomEvent("chronomart:sdk-changed", { detail: sdk }));
}

const GATEWAY_BASE = "/api/v1";

export interface ApiError extends Error {
  status: number;
  body: unknown;
  sdk: Sdk;
}

export function isApiError(e: unknown): e is ApiError {
  return (
    e instanceof Error &&
    typeof (e as ApiError).status === "number" &&
    "sdk" in (e as ApiError)
  );
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { sdk?: Sdk } = {}
): Promise<T> {
  const sdk = init.sdk ?? getSelectedSdk();
  const headers = new Headers(init.headers);
  headers.set("X-Cosmos-SDK", sdk);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${GATEWAY_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body: unknown = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText}`) as ApiError;
    err.status = res.status;
    err.body = body;
    err.sdk = sdk;
    throw err;
  }
  return body as T;
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
