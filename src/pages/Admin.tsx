import { useState } from "react";
import { PageShell } from "../components/PageShell";
import { ErrorPanel } from "../components/ErrorPanel";
import { CachesPanel } from "../components/CachesPanel";
import { DiagnosticsPanel } from "../components/DiagnosticsPanel";
import { useCapabilities } from "../hooks/useCapabilities";
import { useFeedRanges } from "../hooks/useDiagnostics";

// Static allow-list mirroring the backend; no containers-list endpoint exists.
const FEED_RANGE_CONTAINERS = [
  "Products", "ProductsHpk", "Sellers", "Customers", "Orders",
  "Reviews", "Cart", "Inventory", "ProductVectors", "ChangeFeedLease"
] as const;

export function AdminPage() {
  return (
    <PageShell title="Admin">
      <div className="grid gap-4">
        <CapabilitiesPanel />
        <DiagnosticsPanel />
        <FeedRangesPanel />
        <CachesPanel />
      </div>
    </PageShell>
  );
}

function CapabilitiesPanel() {
  const { data, error, isLoading } = useCapabilities();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Capability manifest</h2>
        {data && (
          <span className="text-xs text-slate-500">
            <code className="rounded bg-slate-100 px-1">{data.sdk}</code> ·{" "}
            <code className="rounded bg-slate-100 px-1">{data.sdkVersion}</code>
          </span>
        )}
      </header>
      {isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
      {error && <ErrorPanel title="Capabilities" message={String(error.message)} />}
      {data && (
        <div className="mt-3 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Features
            </h3>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {Object.entries(data.features).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between border-b border-slate-100 py-1">
                  <span className="text-slate-700">{k}</span>
                  <FeatureBadge value={v} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            {data.limits && (
              <>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Limits
                </h3>
                <ul className="mt-2 text-sm">
                  {Object.entries(data.limits).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between border-b border-slate-100 py-1">
                      <span className="text-slate-700">{k}</span>
                      <code className="text-slate-900 font-mono">{v}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {data.apiVersions?.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                api versions:{" "}
                {data.apiVersions.map((v) => (
                  <code key={v} className="ml-1 rounded bg-slate-100 px-1">{v}</code>
                ))}
              </p>
            )}
            {data.stub && (
              <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Backend is a stub. <em>{data.reason ?? "no reason provided"}</em>
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FeatureBadge({ value }: { value: boolean | string | string[] }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
        true
      </span>
    ) : (
      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
        false
      </span>
    );
  }
  if (Array.isArray(value)) {
    return (
      <code className="text-[11px] text-slate-700">
        {value.length === 0 ? "[]" : `[${value.join(", ")}]`}
      </code>
    );
  }
  return <code className="text-[11px] text-slate-700">{value}</code>;
}

function FeedRangesPanel() {
  const [container, setContainer] = useState<string>("Products");
  const query = useFeedRanges(container);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Feed ranges</h2>
        <span className="text-xs text-slate-500">
          GET <code className="rounded bg-slate-100 px-1">/_meta/feed-ranges?container={container}</code>
        </span>
      </header>

      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
        <label className="flex flex-col text-sm">
          <span className="text-slate-600 font-medium">Container</span>
          <select
            value={container}
            onChange={(e) => setContainer(e.target.value)}
            className="mt-1 w-56 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-mono"
          >
          {FEED_RANGE_CONTAINERS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </form>

      {query.isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
      {query.error && (
        <div className="mt-3">
          <ErrorPanel title="Feed ranges" message={String(query.error.message)} />
        </div>
      )}

      {query.data && (
        <>
          <p className="mt-3 text-xs text-slate-500">
            <strong>{query.data.length}</strong> range{query.data.length === 1 ? "" : "s"}{" "}
            (SDK-known feed-range count = physical partition count of <code>{container}</code>)
          </p>
          <ul className="mt-2 grid gap-1 text-[11px]">
            {query.data.map((r, i) => (
              <li key={i} className="rounded bg-slate-50 p-2 font-mono break-all">
                {r.opaque ?? "(opaque token unavailable)"}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
