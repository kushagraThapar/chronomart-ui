import { PageShell } from "../components/PageShell";
import { useCapabilities } from "../hooks/useCapabilities";

export function AdminPage() {
  const { data } = useCapabilities();
  return (
    <PageShell title="Admin">
      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-700">Capability manifest</h2>
          <pre className="mt-2 text-xs bg-slate-50 p-3 rounded overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </section>
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-slate-500">
          Workloads / Diagnostics / Cache inspector will land in Phase 4.
        </section>
      </div>
    </PageShell>
  );
}
