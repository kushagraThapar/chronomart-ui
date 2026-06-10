import { useSyncExternalStore } from "react";

/**
 * Customer identity for cart/checkout/orders pages. There is no real auth in
 * the harness — the customer id is a single string the user enters once and
 * we persist to localStorage. Cart and Checkout subscribe to the same store
 * via {@link useCustomerId} so a change on one page reflects on the other.
 */
const STORAGE_KEY = "chronomart.customerId";
const EVENT = "chronomart:customer-changed";
const DEFAULT_ID = "demo-customer";

function read(): string {
  if (typeof localStorage === "undefined") return DEFAULT_ID;
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ID;
}

export function setCustomerId(id: string) {
  const trimmed = id.trim() || DEFAULT_ID;
  localStorage.setItem(STORAGE_KEY, trimmed);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: trimmed }));
}

function subscribe(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function useCustomerId(): string {
  return useSyncExternalStore(subscribe, read, read);
}
