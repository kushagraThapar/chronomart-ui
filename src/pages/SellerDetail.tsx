import { Link, useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { useSeller } from "../hooks/useSellers";

export function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: seller, error, isLoading } = useSeller(id);

  return (
    <PageShell title="Seller Detail" feature="pointCrud">
      <div className="grid gap-4">
        <nav className="text-sm">
          <Link to="/sellers" className="text-brand-700 hover:underline">← Back to sellers</Link>
        </nav>

        {isLoading && (
          <section className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Loading seller…
          </section>
        )}

        {error && (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Error loading seller:</strong> {String(error.message)}
          </section>
        )}

        {!isLoading && !error && !seller && (
          <section className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-8 text-center text-amber-800">
            <p className="font-semibold">Seller not found</p>
            <p className="mt-1 text-sm">
              No seller with id <code className="rounded bg-amber-100 px-1">{id}</code>.
            </p>
          </section>
        )}

        {seller && (
          <article className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-6">
              <header className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900">{seller.name}</h2>
                {typeof seller.rating === "number" && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800">
                    ★ {seller.rating.toFixed(1)}
                  </span>
                )}
              </header>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Field label="Country" value={seller.country ?? "—"} />
                <Field label="Joined" value={seller.joinedAt ?? "—"} />
              </dl>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={`/?sellerId=${encodeURIComponent(seller.id)}`}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
                >
                  View this seller's catalog →
                </Link>
              </div>
            </section>

            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
              <h3 className="font-semibold text-slate-700">Cosmos document</h3>
              <dl className="mt-2 grid gap-1">
                <Row label="Container">Sellers</Row>
                <Row label="Partition key">/id</Row>
                <Row label="PK value"><code className="bg-white px-1 rounded">{seller.id}</code></Row>
                <Row label="Document id"><code className="bg-white px-1 rounded">{seller.id}</code></Row>
              </dl>
              <details className="mt-4">
                <summary className="cursor-pointer text-slate-600 hover:text-slate-900">Raw JSON</summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">
                  {JSON.stringify(seller, null, 2)}
                </pre>
              </details>
            </aside>
          </article>
        )}
      </div>
    </PageShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800 text-right">{value}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800 text-right break-all">{children}</dd>
    </div>
  );
}
