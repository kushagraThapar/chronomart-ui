import { SDKS, setSelectedSdk, type Sdk } from "../api/client";
import { useCapabilities, useSelectedSdk } from "../hooks/useCapabilities";

const LABELS: Record<Sdk, string> = {
  java: "Java",
  dotnet: ".NET",
  python: "Python",
  rust: "Rust",
  go: "Go"
};

export function SdkSwitcher() {
  const sdk = useSelectedSdk();
  const { data, isFetching } = useCapabilities();
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-slate-600">Backend SDK</label>
      <select
        value={sdk}
        onChange={(e) => setSelectedSdk(e.target.value as Sdk)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:outline-none focus:border-brand-500"
      >
        {SDKS.map((s) => (
          <option key={s} value={s}>{LABELS[s]}</option>
        ))}
      </select>
      <span className="text-xs text-slate-500" title={data?.reason ?? ""}>
        {isFetching ? "…" : data?.stub ? "stub" : (data?.sdkVersion ?? "")}
      </span>
    </div>
  );
}
