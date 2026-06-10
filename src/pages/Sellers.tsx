import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "../components/PageShell";
import { useSellers } from "../hooks/useSellers";
import { useSelectedSdk } from "../hooks/useCapabilities";
import type { Seller } from "../api/types";

const LIMITS = [25, 50, 100, 250, 1000] as const;

export function SellersPage() {
  const [limit, setLimit] = useState<number>(100);
  const { data, error, isLoading, isFetching } = useSellers(limit);
  const sdk = useSelectedSdk();
  const qc = useQueryClient();

  return (
    <PageShell title="Sellers" feature="pointCrud">
      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Limit</span>
              <select
                value={limit}
                onChange={(e) => setLimit(parseLimit(e.target.value))}
                className="mt-1 w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                {LIMITS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: ["sellers", sdk, limit] })}
              disabled={isFetching}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
            <div className="ml-auto text-xs text-slate-500">
              container <code className="rounded bg-slate-100 px-1">Sellers</code>
              {" · PK "}<code className="rounded bg-slate-100 px-1">/id</code>
            </div>
          </form>
        </section>

        {error && (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Error loading sellers:</strong> {String(error.message)}
          </section>
        )}

        {isLoading && (
          <section className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Loading sellers…
          </section>
        )}

        {data && data.length === 0 && (
          <section className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-8 text-center text-amber-800">
            No sellers found.
          </section>
        )}

        {data && data.length > 0 && (
          <>
            <p className="text-xs text-slate-500">
              {data.length} seller{data.length === 1 ? "" : "s"} returned
            </p>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((s) => (
                <SellerCard key={s.id} seller={s} />
              ))}
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}

function SellerCard({ seller }: { seller: Seller }) {
  return (
    <Link
      to={`/sellers/${encodeURIComponent(seller.id)}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{seller.name}</h3>
        {typeof seller.rating === "number" && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            ★ {seller.rating.toFixed(1)}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {seller.country ?? "—"}
        {seller.joinedAt && (
          <> · joined {seller.joinedAt.slice(0, 10)}</>
        )}
      </p>
      <p className="mt-3 text-xs font-mono text-slate-400">{seller.id}</p>
    </Link>
  );
}

function parseLimit(value: string): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 100;
}
