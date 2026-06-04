export interface CapabilityManifest {
  sdk: string;
  sdkVersion: string;
  apiVersions: string[];
  features: Record<string, boolean | string | string[]>;
  limits?: Record<string, number>;
  stub?: boolean;
  reason?: string;
}
