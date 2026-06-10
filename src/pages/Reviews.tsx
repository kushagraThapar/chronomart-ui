import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorPanel } from "../components/ErrorPanel";
import { PageShell } from "../components/PageShell";
import { useRunQuery } from "../hooks/useRunQuery";
import { useReviewUpsert } from "../hooks/useReviewUpsert";
import { setCustomerId, useCustomerId } from "../hooks/useCustomerId";
import type { QueryRequest, QueryResponse, Review } from "../api/types";

const PAGE_SIZES = [5, 10, 25, 50] as const;
const RATINGS = [1, 2, 3, 4, 5] as const;

export function ReviewsPage() {
  const [productId, setProductId] = useState<string>("prod-001");
  const [appliedProductId, setAppliedProductId] = useState<string>("prod-001");
  const [pageSize, setPageSize] = useState<number>(10);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [pages, setPages] = useState<{ items: number; rc?: number; cont: string | null }[]>([]);

  const runQuery = useRunQuery<Review>();

  function buildRequest(cont: string | null, pid: string): QueryRequest {
    return {
      container: "Reviews",
      query: "SELECT * FROM c WHERE c.productId = @pid",
      parameters: [{ name: "@pid", value: pid }],
      partitionKey: pid,
      pageSize,
      continuation: cont
    };
  }

  function loadFirstPage() {
    const pid = productId.trim();
    if (!pid) return;
    setAppliedProductId(pid);
    setReviews([]);
    setPages([]);
    setContinuation(null);
    runQuery.mutate(buildRequest(null, pid), {
      onSuccess: (res) => acceptPage(res, false)
    });
  }

  function loadNextPage() {
    if (!continuation) return;
    runQuery.mutate(buildRequest(continuation, appliedProductId), {
      onSuccess: (res) => acceptPage(res, true)
    });
  }

  function acceptPage(res: QueryResponse<Review>, append: boolean) {
    setReviews((prev) => (append ? [...prev, ...res.items] : res.items));
    setContinuation(res.continuation ?? null);
    setPages((prev) => [
      ...prev,
      { items: res.items.length, rc: res.requestCharge, cont: res.continuation ?? null }
    ]);
  }

  function refresh() {
    if (appliedProductId) loadFirstPageFor(appliedProductId);
  }

  function loadFirstPageFor(pid: string) {
    setReviews([]);
    setPages([]);
    setContinuation(null);
    runQuery.mutate(buildRequest(null, pid), {
      onSuccess: (res) => acceptPage(res, false)
    });
  }

  const stats = useMemo(() => computeStats(reviews), [reviews]);
  const totalRc = pages.reduce((sum, p) => sum + (p.rc ?? 0), 0);

  return (
    <PageShell title="Reviews" feature="queries">
      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_100px_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              loadFirstPage();
            }}
          >
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Product ID (PK)</span>
              <input
                type="text"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="e.g. prod-001"
                className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono"
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
              disabled={!productId.trim() || runQuery.isPending}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {runQuery.isPending && pages.length === 0 ? "Loading…" : "Load reviews"}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>container <code className="rounded bg-slate-100 px-1">Reviews</code></span>
            <span>routing <code className="rounded bg-slate-100 px-1">single PK partition (/productId)</code></span>
            <span>query <code className="rounded bg-slate-100 px-1">WHERE productId = @pid</code></span>
          </div>
        </section>

        {runQuery.error && (
          <ErrorPanel title="Query failed" message={String(runQuery.error.message)} />
        )}

        {pages.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-700">
                {reviews.length} review{reviews.length === 1 ? "" : "s"} for{" "}
                <code className="rounded bg-slate-100 px-1">{appliedProductId}</code>
                {stats && (
                  <>
                    {" "}
                    · avg{" "}
                    <span className="rounded bg-amber-100 px-1.5 text-amber-800">
                      ★ {stats.avg.toFixed(2)}
                    </span>
                  </>
                )}
              </h2>
              <span className="text-xs text-slate-500">
                total RU charge:{" "}
                <strong className="font-mono text-slate-800">{totalRc.toFixed(2)}</strong>
              </span>
            </header>

            {reviews.length > 0 && (
              <ul className="mt-3 grid gap-2">
                {reviews.map((r) => (
                  <ReviewRow key={r.id} review={r} />
                ))}
              </ul>
            )}
            {reviews.length === 0 && (
              <p className="mt-3 text-sm text-amber-700">
                No reviews for product <code>{appliedProductId}</code>.
              </p>
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
          </section>
        )}

        <WriteReviewSection
          productId={appliedProductId || productId.trim()}
          onCreated={refresh}
        />
      </div>
    </PageShell>
  );
}

function ReviewRow({ review }: { review: Review }) {
  return (
    <li className="rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            ★ {review.rating}
          </span>
          <strong className="text-sm text-slate-900">{review.title ?? "(untitled)"}</strong>
          <span className="text-xs text-slate-500">by {review.customerId}</span>
        </div>
        {review.createdAt && (
          <span className="text-xs text-slate-500">{review.createdAt}</span>
        )}
      </div>
      {review.body && (
        <p className="mt-1 text-sm text-slate-700">{review.body}</p>
      )}
      <p className="mt-1 text-[11px] font-mono text-slate-400">{review.id}</p>
    </li>
  );
}

function WriteReviewSection({
  productId,
  onCreated
}: {
  productId: string;
  onCreated: () => void;
}) {
  const customerId = useCustomerId();
  const [draftCustomerId, setDraftCustomerId] = useState(customerId);
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const upsert = useReviewUpsert();
  const canSubmit = productId.length > 0 && draftCustomerId.length > 0 && !upsert.isPending;

  function submit() {
    if (draftCustomerId !== customerId) setCustomerId(draftCustomerId);
    upsert.mutate(
      {
        id: generateReviewId(),
        productId,
        customerId: draftCustomerId,
        rating,
        title: title || undefined,
        body: body || undefined,
        createdAt: new Date().toISOString()
      },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
          onCreated();
        }
      }
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Write a review</h2>
      <p className="mt-1 text-xs text-slate-500">
        PUT <code className="rounded bg-slate-100 px-1">/api/v1/reviews/{productId || "(set product id above)"}/{`{generated-id}`}</code>
      </p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_120px] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) submit();
        }}
      >
        <label className="flex flex-col text-sm">
          <span className="text-slate-600 font-medium">Customer ID</span>
          <input
            type="text"
            value={draftCustomerId}
            onChange={(e) => setDraftCustomerId(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-slate-600 font-medium">Rating</span>
          <select
            value={rating}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 5) setRating(n);
            }}
            className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {RATINGS.map((n) => (
              <option key={n} value={n}>★ {n}</option>
            ))}
          </select>
        </label>
        <div />
        <label className="flex flex-col text-sm sm:col-span-3">
          <span className="text-slate-600 font-medium">Title (optional)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-sm sm:col-span-3">
          <span className="text-slate-600 font-medium">Body (optional)</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 h-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <div className="sm:col-span-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {upsert.isPending ? "Saving…" : "Submit review"}
          </button>
          {upsert.error && (
            <span className="text-sm text-red-700">
              <strong>Failed:</strong> {String(upsert.error.message)}
            </span>
          )}
          {upsert.isSuccess && !upsert.isPending && (
            <span className="text-sm text-emerald-700">Saved.</span>
          )}
          <Link to="/" className="ml-auto text-xs text-brand-700 hover:underline">
            ← Find more products
          </Link>
        </div>
      </form>
    </section>
  );
}

function computeStats(reviews: Review[]): { avg: number; count: number } | null {
  if (reviews.length === 0) return null;
  let sum = 0;
  for (const r of reviews) sum += r.rating;
  return { avg: sum / reviews.length, count: reviews.length };
}

function generateReviewId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `rev-${crypto.randomUUID()}`;
  }
  return `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
