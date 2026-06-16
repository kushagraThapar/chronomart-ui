import { Link, useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { useProduct } from "../hooks/useProducts";
import { useCart, useCartUpsert } from "../hooks/useCart";
import { useCustomerId } from "../hooks/useCustomerId";
import { formatPrice } from "../lib/format";
import { useState } from "react";

export function ProductDetailPage() {
  const { sellerId, id } = useParams<{ sellerId: string; id: string }>();
  const { data: product, error, isLoading } = useProduct(sellerId, id);
  const customerId = useCustomerId();
  const cartQuery = useCart(customerId);
  const cartUpsert = useCartUpsert(customerId);
  const [addQty, setAddQty] = useState<number>(1);

  function addToCart() {
    if (!product) return;
    const existing = cartQuery.data?.items ?? [];
    const idx = existing.findIndex((it) => it.productId === product.id);
    // Snapshot price + seller from the product at add-time so checkout can pre-fill the
    // order line (OrderItem requires unitPriceUsd). Refresh the snapshot on re-add so an
    // item added before this field existed gets healed to the current catalog price.
    const snapshot = {
      sellerId: product.sellerId,
      unitPriceUsd: product.priceUsd
    };
    const items =
      idx >= 0
        ? existing.map((it, i) =>
            i === idx ? { ...it, qty: it.qty + addQty, ...snapshot } : it
          )
        : [
            ...existing,
            {
              productId: product.id,
              qty: addQty,
              addedAt: new Date().toISOString(),
              ...snapshot
            }
          ];
    cartUpsert.mutate({
      id: customerId,
      customerId,
      items,
      updatedAt: new Date().toISOString()
    });
  }

  return (
    <PageShell title="Product Detail" feature="pointCrud">
      <div className="grid gap-4">
        <nav className="text-sm">
          <Link to="/" className="text-brand-700 hover:underline">← Back to catalog</Link>
        </nav>

        {isLoading && (
          <section className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Loading product…
          </section>
        )}

        {error && (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Error loading product:</strong> {String((error as Error).message)}
          </section>
        )}

        {!isLoading && !error && !product && (
          <section className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-8 text-center text-amber-800">
            <p className="font-semibold">Product not found</p>
            <p className="mt-1 text-sm">
              No product with PK <code className="rounded bg-amber-100 px-1">{sellerId}</code> and id{" "}
              <code className="rounded bg-amber-100 px-1">{id}</code>.
            </p>
          </section>
        )}

        {product && (
          <article className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-6">
              <header className="flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{product.name}</h2>
                  <p className="text-sm text-slate-500">
                    {product.brand ?? "—"} · {product.model ?? "—"}
                    {product.categoryId && (
                      <>
                        {" · "}
                        <span className="uppercase tracking-wide">{product.categoryId}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-brand-700">
                    {formatPrice(product.priceUsd, product.currency)}
                  </div>
                </div>
              </header>

              {product.tags && product.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1">
                  {product.tags.map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {product.attributes && Object.keys(product.attributes).length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-slate-700">Attributes</h3>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {Object.entries(product.attributes).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-100 py-1">
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="font-medium text-slate-800 text-right">{formatAttr(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-end gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <label className="flex flex-col text-xs">
                  <span className="text-slate-600 font-medium">Qty</span>
                  <input
                    type="number"
                    min={1}
                    value={addQty}
                    onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={addToCart}
                  disabled={cartUpsert.isPending}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {cartUpsert.isPending ? "Adding…" : "Add to cart"}
                </button>
                <div className="text-xs text-slate-500">
                  customer <code className="rounded bg-white px-1">{customerId}</code>
                </div>
                {cartUpsert.isSuccess && !cartUpsert.isPending && (
                  <Link to="/cart" className="text-xs text-brand-700 hover:underline">
                    View cart →
                  </Link>
                )}
                {cartUpsert.error && (
                  <span className="text-xs text-red-700">
                    {String(cartUpsert.error.message)}
                  </span>
                )}
              </div>
            </section>

            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
              <h3 className="font-semibold text-slate-700">Cosmos document</h3>
              <dl className="mt-2 grid gap-1">
                <Row label="Container">Products</Row>
                <Row label="Partition key">/sellerId</Row>
                <Row label="PK value"><code className="bg-white px-1 rounded">{product.sellerId}</code></Row>
                <Row label="Document id"><code className="bg-white px-1 rounded">{product.id}</code></Row>
                {product.createdAt && <Row label="Created">{product.createdAt}</Row>}
                {product.updatedAt && <Row label="Updated">{product.updatedAt}</Row>}
              </dl>
              <details className="mt-4">
                <summary className="cursor-pointer text-slate-600 hover:text-slate-900">Raw JSON</summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">
                  {JSON.stringify(product, null, 2)}
                </pre>
              </details>
            </aside>
          </article>
        )}
      </div>
    </PageShell>
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

function formatAttr(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

