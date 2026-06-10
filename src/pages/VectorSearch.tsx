import { PageShell } from "../components/PageShell";
import { useMemo, useState } from "react";
import { useVectorSearch } from "../hooks/useVectorSearch";
import type { VectorMatch } from "../api/types";
import { Link } from "react-router-dom";

const DEFAULT_CONTAINER = "ProductVectors";
const DEFAULT_DIMENSION = 1024;
const DEFAULT_K = 5;

export function VectorSearchPage() {
  const [container, setContainer] = useState(DEFAULT_CONTAINER);
  const [dimension, setDimension] = useState<number>(DEFAULT_DIMENSION);
  const [k, setK] = useState<number>(DEFAULT_K);
  const [vectorJson, setVectorJson] = useState<string>(() =>
    JSON.stringify(zeros(DEFAULT_DIMENSION))
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const search = useVectorSearch();

  const vectorInfo = useMemo(() => parseVectorPreview(vectorJson), [vectorJson]);

  function runSearch() {
    setParseError(null);
    let vec: number[];
    try {
      vec = parseVector(vectorJson);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
      return;
    }
    if (vec.length !== dimension) {
      setParseError(
        `vector has ${vec.length} dimensions but container expects ${dimension}`
      );
      return;
    }
    search.mutate({ container, vector: vec, k });
  }

  function setRandomUnit() {
    setVectorJson(JSON.stringify(randomUnitVector(dimension)));
    setParseError(null);
  }

  function setZeros() {
    setVectorJson(JSON.stringify(zeros(dimension)));
    setParseError(null);
  }

  function useMatchAsQuery(match: VectorMatch) {
    const emb = extractEmbedding(match.document);
    if (!emb) {
      setParseError(
        "this match's document has no `embedding` field — can't reuse it as a query"
      );
      return;
    }
    setVectorJson(JSON.stringify(emb));
    setParseError(null);
  }

  return (
    <PageShell title="Vector Search" feature="vectorSearch">
      <div className="grid gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_140px_120px_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
          >
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Container</span>
              <input
                type="text"
                value={container}
                onChange={(e) => setContainer(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm font-mono"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">Dimension</span>
              <input
                type="number"
                min={1}
                value={dimension}
                onChange={(e) => {
                  const n = parsePositiveInt(e.target.value);
                  if (n !== null) setDimension(n);
                }}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 font-medium">k</span>
              <input
                type="number"
                min={1}
                max={100}
                value={k}
                onChange={(e) => {
                  const n = parsePositiveInt(e.target.value);
                  if (n !== null && n <= 100) setK(n);
                }}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={search.isPending}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {search.isPending ? "Searching…" : "Search"}
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700">Query vector</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={setRandomUnit}
                className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
              >
                Random unit vector
              </button>
              <button
                type="button"
                onClick={setZeros}
                className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
              >
                Zeros
              </button>
              <span className={`rounded px-2 py-1 ${vectorInfo.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {vectorInfo.ok
                  ? `parsed: ${vectorInfo.length} dims · |v|=${vectorInfo.norm?.toFixed(3) ?? "—"}`
                  : `parse error: ${vectorInfo.error}`}
              </span>
            </div>
          </div>
          <textarea
            value={vectorJson}
            onChange={(e) => setVectorJson(e.target.value)}
            spellCheck={false}
            className="mt-2 h-32 w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] font-mono"
          />
          <p className="mt-2 text-xs text-slate-500">
            Paste a JSON array of {dimension} floats. The harness ships with
            a one-vector seed in <code>{container}</code>; click a result's
            <em> Use as query</em> below for similarity exploration.
          </p>
          {parseError && (
            <p className="mt-2 text-xs text-red-700"><strong>Error:</strong> {parseError}</p>
          )}
        </section>

        {search.error && (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Search failed:</strong> {String(search.error.message)}
          </section>
        )}

        {search.data && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-700">
                {search.data.matches.length} match{search.data.matches.length === 1 ? "" : "es"}
              </h2>
              <span className="text-xs text-slate-500">
                RU charge:{" "}
                <strong className="font-mono text-slate-800">
                  {search.data.requestCharge.toFixed(2)}
                </strong>
              </span>
            </header>
            {search.data.matches.length === 0 && (
              <p className="mt-3 text-sm text-amber-700">
                No matches. The container may be empty — seed it via the workload
                runner or check the diagnostics endpoint.
              </p>
            )}
            <ul className="mt-3 grid gap-2">
              {search.data.matches.map((m, idx) => (
                <MatchRow
                  key={`${m.id ?? "noid"}-${idx}`}
                  rank={idx + 1}
                  match={m}
                  onReuse={() => useMatchAsQuery(m)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function MatchRow({
  rank,
  match,
  onReuse
}: {
  rank: number;
  match: VectorMatch;
  onReuse: () => void;
}) {
  return (
    <li className="rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="rounded bg-slate-300 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
            #{rank}
          </span>
          <strong className="text-sm text-slate-900">
            {match.name ?? match.productId ?? match.id}
          </strong>
          {match.sellerId && match.productId && (
            <Link
              to={`/products/${encodeURIComponent(match.sellerId)}/${encodeURIComponent(match.productId)}`}
              className="text-xs text-brand-700 hover:underline"
            >
              open product →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {typeof match.score === "number" && (
            <span className="rounded bg-brand-100 px-2 py-0.5 font-mono text-brand-800">
              score {match.score.toFixed(4)}
            </span>
          )}
          <button
            type="button"
            onClick={onReuse}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-100"
          >
            Use as query
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        <span className="font-mono">{match.id}</span>
        {match.sellerId && <> · seller <code className="rounded bg-white px-1">{match.sellerId}</code></>}
      </p>
      {match.document && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-slate-600 hover:text-slate-900">Raw document</summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">
            {JSON.stringify(redactEmbedding(match.document), null, 2)}
          </pre>
        </details>
      )}
    </li>
  );
}

function zeros(n: number): number[] {
  return new Array(n).fill(0);
}

function randomUnitVector(n: number): number[] {
  const v = new Array(n);
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 2 - 1;
    v[i] = x;
    sumSq += x * x;
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < n; i++) v[i] = Number((v[i] / norm).toFixed(6));
  return v;
}

function parseVector(json: string): number[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("expected a JSON array of numbers");
  }
  const out: number[] = new Array(parsed.length);
  for (let i = 0; i < parsed.length; i++) {
    const x = parsed[i];
    if (typeof x !== "number" || !Number.isFinite(x)) {
      throw new Error(`element ${i} is not a finite number`);
    }
    out[i] = x;
  }
  return out;
}

function parseVectorPreview(json: string): {
  ok: boolean;
  length?: number;
  norm?: number;
  error?: string;
} {
  try {
    const v = parseVector(json);
    let sumSq = 0;
    for (const x of v) sumSq += x * x;
    return { ok: true, length: v.length, norm: Math.sqrt(sumSq) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractEmbedding(doc: Record<string, unknown> | undefined): number[] | null {
  if (!doc) return null;
  const candidates = ["embedding", "vector"];
  for (const key of candidates) {
    const v = doc[key];
    if (Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x))) {
      return v as number[];
    }
  }
  return null;
}

function redactEmbedding(doc: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (Array.isArray(v) && v.length > 16 && v.every((x) => typeof x === "number")) {
      redacted[k] = `[${v.length} numbers, first 4: ${v.slice(0, 4).map((x) => Number(x).toFixed(4)).join(", ")} …]`;
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}
