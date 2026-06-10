import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorPanel } from "../components/ErrorPanel";
import { PageShell } from "../components/PageShell";
import { useCart, useCartUpsert } from "../hooks/useCart";
import { useSelectedSdk } from "../hooks/useCapabilities";
import { setCustomerId, useCustomerId } from "../hooks/useCustomerId";
import type { Cart as CartDoc, CartItem } from "../api/types";

export function CartPage() {
  const customerId = useCustomerId();
  const sdk = useSelectedSdk();
  const queryClient = useQueryClient();
  const [draftCustomerId, setDraftCustomerId] = useState(customerId);
  useEffect(() => setDraftCustomerId(customerId), [customerId]);

  const cartQuery = useCart(customerId);
  const upsert = useCartUpsert(customerId);

  const [items, setItems] = useState<CartItem[]>([]);
  const [ttl, setTtl] = useState<string>("");
  const [newProductId, setNewProductId] = useState("");
  const [newQty, setNewQty] = useState(1);

  useEffect(() => {
    if (cartQuery.data) {
      setItems(cartQuery.data.items);
      setTtl(cartQuery.data.ttl == null ? "" : String(cartQuery.data.ttl));
    } else if (cartQuery.data === null) {
      setItems([]);
      setTtl("");
    }
  }, [cartQuery.data]);

  const dirty = useMemo(() => {
    if (!cartQuery.data) return items.length > 0 || ttl !== "";
    const sameTtl = (cartQuery.data.ttl == null ? "" : String(cartQuery.data.ttl)) === ttl;
    return !sameTtl || !sameItems(cartQuery.data.items, items);
  }, [cartQuery.data, items, ttl]);

  function addItem() {
    const pid = newProductId.trim();
    if (!pid || newQty < 1) return;
    setItems((prev) => {
      const existing = prev.findIndex((i) => i.productId === pid);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], qty: next[existing].qty + newQty };
        return next;
      }
      return [...prev, { productId: pid, qty: newQty, addedAt: new Date().toISOString() }];
    });
    setNewProductId("");
    setNewQty(1);
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function setQty(productId: string, qty: number) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty } : i)));
  }

  function save() {
    const parsedTtl = ttl.trim() === "" ? null : Number(ttl);
    if (ttl.trim() !== "" && !Number.isFinite(parsedTtl)) return;
    const doc: CartDoc = {
      id: customerId,
      customerId,
      items,
      updatedAt: new Date().toISOString(),
      ttl: parsedTtl ?? undefined
    };
    upsert.mutate(doc);
  }

  return (
    <PageShell title="Cart" feature="ttl">
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
              <span className="text-slate-600 font-medium">Customer ID (PK)</span>
              <input
                type="text"
                value={draftCustomerId}
                onChange={(e) => setDraftCustomerId(e.target.value)}
                placeholder="e.g. demo-customer"
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
              container <code className="rounded bg-slate-100 px-1">Cart</code>
              {" · PK "}<code className="rounded bg-slate-100 px-1">/customerId</code>
              {" · doc id = customerId (1 doc per customer)"}
            </div>
          </form>
        </section>

        {cartQuery.error && (
          <ErrorPanel title="Error loading cart" message={String(cartQuery.error.message)} />
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Items</h2>
          {cartQuery.isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
          {!cartQuery.isLoading && cartQuery.data === null && items.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              No cart document exists for this customer yet. Add an item and save to create one.
            </p>
          )}
          {items.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="py-1">Product ID</th>
                  <th className="py-1 w-32">Qty</th>
                  <th className="py-1">Added</th>
                  <th className="py-1 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productId} className="border-t border-slate-100">
                    <td className="py-2 font-mono text-xs">{item.productId}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) => {
                          const nextQty = parsePositiveInt(e.target.value);
                          if (nextQty !== null) setQty(item.productId, nextQty);
                        }}
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 text-xs text-slate-500">{item.addedAt ?? "—"}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form
            className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              addItem();
            }}
          >
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Add product ID</span>
              <input
                type="text"
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                placeholder="e.g. prod-001"
                className="mt-1 w-56 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Qty</span>
              <input
                type="number"
                min={1}
                value={newQty}
                onChange={(e) => setNewQty(Number(e.target.value))}
                className="mt-1 w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={!newProductId.trim()}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Add to cart
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Per-document TTL (seconds)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Container default is 7&nbsp;days. Set to a positive integer to override; <code>-1</code>{" "}
            disables TTL for this doc; leave blank to inherit the container default on save.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <input
              type="text"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              placeholder="(inherit)"
              className="w-40 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setTtl("60")}
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            >
              60s
            </button>
            <button
              type="button"
              onClick={() => setTtl("604800")}
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            >
              7d
            </button>
            <button
              type="button"
              onClick={() => setTtl("-1")}
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            >
              -1 (off)
            </button>
            <button
              type="button"
              onClick={() => setTtl("")}
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
            >
              (inherit)
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!dirty || upsert.isPending}
              onClick={save}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {upsert.isPending ? "Saving…" : dirty ? "Save cart" : "No changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["cart", sdk, customerId] });
              }}
              disabled={cartQuery.isFetching}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              Reload from Cosmos
            </button>
            {cartQuery.data?.updatedAt && (
              <span className="text-xs text-slate-500">
                last server updatedAt: <code>{cartQuery.data.updatedAt}</code>
              </span>
            )}
            <Link to="/checkout" className="ml-auto text-sm text-brand-700 hover:underline">
              Proceed to checkout →
            </Link>
          </div>
          {upsert.error && (
            <p className="mt-3 text-sm text-red-700">
              <strong>Save failed:</strong> {String(upsert.error.message)}
            </p>
          )}
        </section>

        {cartQuery.data && (
          <details className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700">
              Raw Cart JSON (server)
            </summary>
            <pre className="mt-2 max-h-96 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">
              {JSON.stringify(cartQuery.data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </PageShell>
  );
}

function sameItems(a: CartItem[], b: CartItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].productId !== b[i].productId || a[i].qty !== b[i].qty) return false;
  }
  return true;
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
