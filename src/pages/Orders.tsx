import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { useRunQuery } from "../hooks/useRunQuery";
import { setCustomerId, useCustomerId } from "../hooks/useCustomerId";
import { formatPrice } from "../lib/format";
import type { Order, QueryRequest, QueryResponse } from "../api/types";

const PAGE_SIZES = [5, 10, 25, 50] as const;
const YM_PATTERN = /^[0-9]{4}-[0-9]{2}$/;

export function OrdersPage() {
  const customerId = useCustomerId();
  const [draftCustomerId, setDraftCustomerId] = useState(customerId);
  useEffect(() => setDraftCustomerId(customerId), [customerId]);

  const [yearMonth, setYearMonth] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(10);

  // Accumulated rows across continuation-driven pages.
  const [orders, setOrders] = useState<Order[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [pages, setPages] = useState<{ items: number; rc?: number; cont: string | null }[]>([]);

  const runQuery = useRunQuery<Order>();

  const ymValid = yearMonth === "" || YM_PATTERN.test(yearMonth);
  const customerValid = customerId.trim().length > 0;

  const routing = useMemo(() => {
    if (yearMonth && ymValid) return "HPK prefix (customerId + yearMonth)";
    return "HPK prefix (customerId)";
  }, [yearMonth, ymValid]);

  function buildRequest(cont: string | null): QueryRequest {
    const params: QueryRequest["parameters"] = [{ name: "@cid", value: customerId }];
    let sql = "SELECT * FROM c WHERE c.customerId = @cid";
    let pk: (string | number | boolean)[] = [customerId];
    if (yearMonth) {
      sql += " AND c.yearMonth = @ym";
      params.push({ name: "@ym", value: yearMonth });
      pk = [customerId, yearMonth];
    }
    return {
      container: "Orders",
      query: sql,
      parameters: params,
      partitionKey: pk,
      pageSize,
      continuation: cont
    };
  }

  function loadFirstPage() {
    if (!customerValid || !ymValid) return;
    setOrders([]);
    setPages([]);
    setContinuation(null);
    runQuery.mutate(buildRequest(null), {
      onSuccess: (res) => acceptPage(res, false)
    });
  }

  function loadNextPage() {
    if (!continuation) return;
    runQuery.mutate(buildRequest(continuation), {
      onSuccess: (res) => acceptPage(res, true)
    });
  }

  function acceptPage(res: QueryResponse<Order>, append: boolean) {
    setOrders((prev) => (append ? [...prev, ...res.items] : res.items));
    setContinuation(res.continuation ?? null);
    setPages((prev) => [
      ...prev,
      { items: res.items.length, rc: res.requestCharge, cont: res.continuation ?? null }
    ]);
  }

  const totalRc = pages.reduce((sum, p) => sum + (p.rc ?? 0), 0);

  return (
    <PageShell title="Orders" feature="hierarchicalPk">
      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_140px_100px_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (draftCustomerId !== customerId) setCustomerId(draftCustomerId);
              loadFirstPage();
            }}
          >
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Customer ID (PK lvl 1)</span>
              <input
                type="text"
                value={draftCustomerId}
                onChange={(e) => setDraftCustomerId(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">yearMonth (optional)</span>
              <input
                type="text"
                placeholder="YYYY-MM"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
                className={`mt-1 rounded-md border px-2 py-1 text-sm font-mono ${ymValid ? "border-slate-300" : "border-red-400"}`}
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Page size</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n > 0) setPageSize(n);
                }}
                className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={!customerValid || !ymValid || runQuery.isPending}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {runQuery.isPending && pages.length === 0 ? "Loading…" : "Load orders"}
            </button>
          </form>
          {!ymValid && (
            <p className="mt-2 text-xs text-red-700">
              yearMonth must match <code>YYYY-MM</code> (or be empty).
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>
              container <code className="rounded bg-slate-100 px-1">Orders</code>
            </span>
            <span>
              routing <code className="rounded bg-slate-100 px-1">{routing}</code>
            </span>
            <span>
              query{" "}
              <code className="rounded bg-slate-100 px-1">
                {yearMonth ? "WHERE customerId = @cid AND yearMonth = @ym" : "WHERE customerId = @cid"}
              </code>
            </span>
          </div>
        </section>

        {runQuery.error && (
          <ErrorPanel title="Query failed" message={String(runQuery.error.message)} />
        )}

        {pages.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-700">
                {orders.length} order{orders.length === 1 ? "" : "s"} loaded across{" "}
                {pages.length} page{pages.length === 1 ? "" : "s"}
              </h2>
              <span className="text-xs text-slate-500">
                total RU charge:{" "}
                <strong className="font-mono text-slate-800">{totalRc.toFixed(2)}</strong>
              </span>
            </header>

            {orders.length === 0 && (
              <p className="mt-3 text-sm text-amber-700">
                No orders for customer <code>{customerId}</code>
                {yearMonth && (
                  <> in <code>{yearMonth}</code></>
                )}.
              </p>
            )}

            {orders.length > 0 && (
              <ul className="mt-3 grid gap-2">
                {orders.map((o) => (
                  <OrderRow key={`${o.customerId}/${o.yearMonth}/${o.id}`} order={o} />
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                disabled={!continuation || runQuery.isPending}
                onClick={loadNextPage}
                className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {runQuery.isPending && pages.length > 0
                  ? "Loading…"
                  : continuation
                    ? "Load next page"
                    : "No more pages"}
              </button>
              <div className="ml-auto flex flex-col text-xs text-slate-600 max-w-[60ch]">
                <span className="font-medium">Last continuation token</span>
                <code className="mt-0.5 rounded bg-slate-50 px-2 py-1 text-[11px] break-all">
                  {continuation ?? "(null — end of results)"}
                </code>
              </div>
            </div>

            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-slate-600 hover:text-slate-900">
                Per-page RU breakdown ({pages.length} page{pages.length === 1 ? "" : "s"})
              </summary>
              <table className="mt-2 w-full text-xs">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-1 w-10">#</th>
                    <th className="py-1 w-16">items</th>
                    <th className="py-1 w-16">RU</th>
                    <th className="py-1">continuation</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1">{p.items}</td>
                      <td className="py-1 font-mono">{p.rc?.toFixed(2) ?? "—"}</td>
                      <td className="py-1 break-all font-mono text-[11px]">
                        {p.cont ?? "(null)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>
        )}

        <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
          <strong>Place a new order:</strong>{" "}
          <Link to="/checkout" className="text-brand-700 hover:underline">go to Checkout →</Link>
        </section>
      </div>
    </PageShell>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <li className="rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <StatusBadge status={order.status} />
          <strong className="text-sm text-slate-900">{order.id}</strong>
          <span className="text-xs text-slate-500">
            {order.yearMonth} · {order.items.length} item
            {order.items.length === 1 ? "" : "s"}
          </span>
        </div>
        <span className="font-mono tabular-nums text-brand-700">
          {formatPrice(order.totalUsd, "USD")}
        </span>
      </div>
      {order.createdAt && (
        <p className="mt-1 text-xs text-slate-500">created {order.createdAt}</p>
      )}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-slate-600 hover:text-slate-900">Items + raw JSON</summary>
        <ul className="mt-1 ml-4 list-disc text-[11px] text-slate-700">
          {order.items.map((it, i) => (
            <li key={i}>
              <code>{it.productId}</code> × {it.qty} @ {formatPrice(it.unitPriceUsd, "USD")}
              {it.sellerId && <> (seller <code>{it.sellerId}</code>)</>}
            </li>
          ))}
        </ul>
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">
          {JSON.stringify(order, null, 2)}
        </pre>
      </details>
    </li>
  );
}

function StatusBadge({ status }: { status?: Order["status"] }) {
  const palette: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    paid: "bg-blue-100 text-blue-800",
    shipped: "bg-indigo-100 text-indigo-800",
    delivered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-slate-200 text-slate-700"
  };
  const cls = (status && palette[status]) || "bg-slate-200 text-slate-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {status ?? "?"}
    </span>
  );
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <strong>{title}:</strong> {message}
    </section>
  );
}
