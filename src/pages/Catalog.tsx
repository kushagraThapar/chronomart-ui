import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { useProductsInfinite } from "../hooks/useProducts";
import type { Product } from "../api/types";

const PAGE_SIZES = [5, 10, 25, 50, 100] as const;

export function CatalogPage() {
  const [sellerFilter, setSellerFilter] = useState("");
  const [appliedSeller, setAppliedSeller] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);

  const query = useProductsInfinite({ sellerId: appliedSeller, pageSize });
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, refetch, error } = query;

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const pageCount = data?.pages.length ?? 0;
  const lastContinuation = data?.pages[data.pages.length - 1]?.continuation ?? null;

  return (
    <PageShell title="Catalog" feature="queries">
      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedSeller(sellerFilter);
            }}
          >
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Seller ID (optional)</span>
              <input
                type="text"
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                placeholder="e.g. seller-001 (blank = cross-partition)"
                className="mt-1 w-72 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Page size</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setSellerFilter("");
                setAppliedSeller("");
                refetch();
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
            <div className="ml-auto flex flex-col items-end text-xs text-slate-500">
              <span>
                <strong>{items.length}</strong> items loaded · <strong>{pageCount}</strong> page
                {pageCount === 1 ? "" : "s"}
              </span>
              {appliedSeller && (
                <span>
                  filter: <code className="bg-slate-100 px-1 rounded">sellerId={appliedSeller}</code>
                </span>
              )}
            </div>
          </form>
        </section>

        {error && (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Error loading products:</strong> {String((error as Error).message)}
          </section>
        )}

        {!error && items.length === 0 && !isFetching && (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No products returned for this query.
          </section>
        )}

        {items.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <ProductCard key={`${p.sellerId}/${p.id}`} product={p} />
            ))}
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              disabled={!hasNextPage || isFetchingNextPage}
              onClick={() => fetchNextPage()}
              className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isFetchingNextPage ? "Loading…" : hasNextPage ? "Load next page" : "No more pages"}
            </button>
            {isFetching && !isFetchingNextPage && <span className="text-slate-500">Loading…</span>}
            <div className="ml-auto flex flex-col text-xs text-slate-600 max-w-[60ch]">
              <span className="font-medium">Last continuation token</span>
              <code className="mt-0.5 rounded bg-slate-50 px-2 py-1 text-[11px] break-all">
                {lastContinuation ?? "(null — end of results)"}
              </code>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      to={`/products/${encodeURIComponent(product.sellerId)}/${encodeURIComponent(product.id)}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-500 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{product.name}</h3>
          <p className="truncate text-xs text-slate-500">
            {product.brand ?? "—"} · {product.model ?? "—"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold text-brand-700">
            {formatPrice(product.priceUsd, product.currency)}
          </div>
          {product.categoryId && (
            <div className="text-[11px] text-slate-500 uppercase tracking-wide">
              {product.categoryId}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span title="Partition key">
          PK <code className="bg-slate-100 px-1 rounded">{product.sellerId}</code>
        </span>
        <span title="Document id">
          id <code className="bg-slate-100 px-1 rounded">{product.id}</code>
        </span>
      </div>
      {product.tags && product.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {product.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
              {t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function formatPrice(amount: number, currency: string | undefined): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency ?? "USD"} ${amount.toFixed(2)}`;
  }
}

