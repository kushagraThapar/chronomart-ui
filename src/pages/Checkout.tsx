import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { formatPrice } from "../lib/format";
import { useCart, useCartUpsert } from "../hooks/useCart";
import { useOrderUpsert } from "../hooks/useOrder";
import { setCustomerId, useCustomerId } from "../hooks/useCustomerId";
import type { Order, OrderItem } from "../api/types";

export function CheckoutPage() {
  const customerId = useCustomerId();
  const [draftCustomerId, setDraftCustomerId] = useState(customerId);
  useEffect(() => setDraftCustomerId(customerId), [customerId]);

  const cartQuery = useCart(customerId);
  const cartUpsert = useCartUpsert(customerId);
  const orderUpsert = useOrderUpsert();

  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [sellerIds, setSellerIds] = useState<Record<string, string>>({});
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (cartQuery.data) {
      setUnitPrices((prev) => {
        const next: Record<string, number> = {};
        for (const item of cartQuery.data!.items) {
          next[item.productId] = prev[item.productId] ?? 0;
        }
        return next;
      });
      setSellerIds((prev) => {
        const next: Record<string, string> = {};
        for (const item of cartQuery.data!.items) {
          next[item.productId] = prev[item.productId] ?? "";
        }
        return next;
      });
    }
  }, [cartQuery.data]);

  const items: OrderItem[] = useMemo(() => {
    if (!cartQuery.data) return [];
    return cartQuery.data.items.map((ci) => ({
      productId: ci.productId,
      sellerId: sellerIds[ci.productId]?.trim() || undefined,
      qty: ci.qty,
      unitPriceUsd: unitPrices[ci.productId] ?? 0
    }));
  }, [cartQuery.data, unitPrices, sellerIds]);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.qty * i.unitPriceUsd, 0),
    [items]
  );

  const yearMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, []);
  const [orderId, setOrderId] = useState<string>(() => generateOrderId());

  const canPlace =
    customerId.trim().length > 0 &&
    items.length > 0 &&
    items.every((i) => i.unitPriceUsd > 0) &&
    !orderUpsert.isPending;

  function placeOrder() {
    const order: Order = {
      id: orderId,
      customerId,
      yearMonth,
      status: "pending",
      items,
      totalUsd: total,
      createdAt: new Date().toISOString()
    };
    orderUpsert.mutate(
      { tuple: { customerId, yearMonth, id: orderId }, order },
      {
        onSuccess: (created) => setLastOrder(created)
      }
    );
  }

  function clearCart() {
    if (!cartQuery.data) return;
    cartUpsert.mutate({
      id: customerId,
      customerId,
      items: [],
      updatedAt: new Date().toISOString()
    });
  }

  return (
    <PageShell title="Checkout" feature="hierarchicalPk">
      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setCustomerId(draftCustomerId);
            }}
          >
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Customer ID (PK level 1)</span>
              <input
                type="text"
                value={draftCustomerId}
                onChange={(e) => setDraftCustomerId(e.target.value)}
                className="mt-1 w-64 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              Switch customer
            </button>
            <div className="ml-auto text-xs text-slate-500">
              container <code className="rounded bg-slate-100 px-1">Orders</code>
              {" · HPK "}<code className="rounded bg-slate-100 px-1">/customerId · /yearMonth · /id</code>
            </div>
          </form>
        </section>

        {cartQuery.error && (
          <ErrorPanel title="Error loading cart" message={String(cartQuery.error.message)} />
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <header className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700">Cart contents</h2>
            <Link to="/cart" className="text-xs text-brand-700 hover:underline">
              Edit cart →
            </Link>
          </header>
          {cartQuery.isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
          {!cartQuery.isLoading && (!cartQuery.data || cartQuery.data.items.length === 0) && (
            <p className="mt-2 text-sm text-amber-700">
              Cart is empty. Add items in the <Link to="/cart" className="underline">Cart</Link> page first.
            </p>
          )}
          {cartQuery.data && cartQuery.data.items.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="py-1">Product ID</th>
                  <th className="py-1 w-20">Qty</th>
                  <th className="py-1 w-44">Seller ID (optional)</th>
                  <th className="py-1 w-32">Unit price (USD)</th>
                  <th className="py-1 w-28 text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {cartQuery.data.items.map((ci) => {
                  const price = unitPrices[ci.productId] ?? 0;
                  return (
                    <tr key={ci.productId} className="border-t border-slate-100">
                      <td className="py-2 font-mono text-xs">{ci.productId}</td>
                      <td className="py-2">{ci.qty}</td>
                      <td className="py-2">
                        <input
                          type="text"
                          value={sellerIds[ci.productId] ?? ""}
                          onChange={(e) =>
                            setSellerIds((p) => ({ ...p, [ci.productId]: e.target.value }))
                          }
                          placeholder="(omit)"
                          className="w-40 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={price}
                          onChange={(e) =>
                            setUnitPrices((p) => ({
                              ...p,
                              [ci.productId]: parseUnitPrice(e.target.value)
                            }))
                          }
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatPrice(price * ci.qty, "USD")}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-200 font-semibold">
                  <td colSpan={4} className="py-2 text-right">Total</td>
                  <td className="py-2 text-right tabular-nums text-brand-700">
                    {formatPrice(total, "USD")}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {cartQuery.data && cartQuery.data.items.length > 0 && items.some((i) => i.unitPriceUsd <= 0) && (
            <p className="mt-3 text-xs text-amber-700">
              Set a unit price &gt; 0 for every line before placing the order. The harness
              cart doesn't store prices — fill them in here.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Order destination (HPK tuple)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="customerId (PK lvl 1)" value={customerId} mono />
            <Field label="yearMonth (PK lvl 2)" value={yearMonth} mono />
            <div>
              <span className="block text-xs font-medium text-slate-600">id (PK lvl 3, leaf)</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setOrderId(generateOrderId())}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                >
                  New
                </button>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            The leaf <code>/id</code> level makes a fully-qualified read single-partition;
            queries scoped to a customer (or customer+month) still get HPK prefix routing.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canPlace}
              onClick={placeOrder}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {orderUpsert.isPending ? "Placing…" : "Place order"}
            </button>
            <button
              type="button"
              disabled={!cartQuery.data || cartQuery.data.items.length === 0 || cartUpsert.isPending}
              onClick={clearCart}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Clear cart
            </button>
            {orderUpsert.error && (
              <span className="text-sm text-red-700">
                <strong>Order failed:</strong> {String(orderUpsert.error.message)}
              </span>
            )}
          </div>
        </section>

        {lastOrder && (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="text-sm font-semibold text-emerald-800">
              Order placed — document persisted
            </h2>
            <p className="mt-1 text-xs text-emerald-700">
              GET <code className="rounded bg-white/70 px-1">
                /api/v1/orders/{lastOrder.customerId}/{lastOrder.yearMonth}/{lastOrder.id}
              </code>
            </p>
            <details className="mt-3 text-xs" open>
              <summary className="cursor-pointer font-semibold text-emerald-800">
                Raw Order JSON (server)
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">
                {JSON.stringify(lastOrder, null, 2)}
              </pre>
            </details>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <code className={`mt-1 block rounded bg-slate-100 px-2 py-1 text-sm ${mono ? "font-mono" : ""}`}>
        {value}
      </code>
    </div>
  );
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <strong>{title}:</strong> {message}
    </section>
  );
}

function generateOrderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `ord-${crypto.randomUUID()}`;
  }
  return `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseUnitPrice(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
