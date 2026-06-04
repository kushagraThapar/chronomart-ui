import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { api, getSelectedSdk } from "../api/client";
import type { CapabilityManifest } from "../api/types";

function subscribeSdk(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("chronomart:sdk-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("chronomart:sdk-changed", handler);
    window.removeEventListener("storage", handler);
  };
}

export function useSelectedSdk() {
  return useSyncExternalStore(subscribeSdk, getSelectedSdk, getSelectedSdk);
}

export function useCapabilities() {
  const sdk = useSelectedSdk();
  return useQuery<CapabilityManifest>({
    queryKey: ["capabilities", sdk],
    queryFn: () => api<CapabilityManifest>("/_meta/capabilities"),
    staleTime: 60_000
  });
}

export function useHasFeature(feature: string): boolean {
  const { data } = useCapabilities();
  const v = data?.features?.[feature];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v !== "none" && v !== "off";
  return false;
}
