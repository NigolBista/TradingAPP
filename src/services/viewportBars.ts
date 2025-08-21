import {
  aggregateCandles,
  fetchCandlesForTimeframeWindow,
  mapExtendedTimeframe,
  resolutionToMs,
  type Candle,
  type ExtendedTimeframe,
} from "./marketProviders";

type BarsKey = `${string}:${ExtendedTimeframe}`;

type Range = { min: number; max: number };

type Chunk = { start: number; end: number; data: Candle[] };

type Entry = {
  key: BarsKey;
  loadedRange: Range | null;
  chunks: Chunk[];
  status: "idle" | "fetching" | "live";
  abort?: AbortController | null;
};

const store = new Map<BarsKey, Entry>();

function keyFor(symbol: string, tf: ExtendedTimeframe): BarsKey {
  return `${symbol}:${tf}` as BarsKey;
}

function mergeChunks(chunks: Chunk[], newChunk: Chunk): Chunk[] {
  // Drop overlap and merge maintaining order
  const next: Chunk[] = [];
  for (const c of chunks) {
    // If newChunk is entirely before c
    if (newChunk.end <= c.start) {
      if (!next.some((x) => x === newChunk)) next.push(newChunk);
      next.push(c);
      // append remaining original chunks
      const rest = chunks.slice(chunks.indexOf(c) + 1);
      return next.concat(rest);
    }
    // If newChunk is entirely after c
    if (newChunk.start >= c.end) {
      next.push(c);
      continue;
    }
    // Overlap: expand newChunk to include and skip c
    newChunk = {
      start: Math.min(newChunk.start, c.start),
      end: Math.max(newChunk.end, c.end),
      data: mergeSeries(c.data, newChunk.data),
    };
  }
  // If we get here, either chunks were empty or newChunk is after all
  if (!next.some((x) => x === newChunk)) next.push(newChunk);
  return next;
}

function mergeSeries(a: Candle[], b: Candle[]): Candle[] {
  // both sorted asc by time; keep unique on time
  const out: Candle[] = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    const ca = a[i];
    const cb = b[j];
    if (cb == null || (ca && ca.time <= cb.time)) {
      if (!out.length || out[out.length - 1].time !== ca.time) out.push(ca);
      i++;
    } else {
      if (!out.length || out[out.length - 1].time !== cb.time) out.push(cb);
      j++;
    }
  }
  return out;
}

function clampRange(r: Range): Range {
  return { min: Math.min(r.min, r.max), max: Math.max(r.min, r.max) };
}

export type ViewportFetchPlan = {
  backfillFrom?: number;
  backfillTo?: number;
  prefetchFrom?: number;
  prefetchTo?: number;
};

export function getEntry(symbol: string, tf: ExtendedTimeframe): Entry {
  const k = keyFor(symbol, tf);
  let e = store.get(k);
  if (!e) {
    e = { key: k, loadedRange: null, chunks: [], status: "idle", abort: null };
    store.set(k, e);
  }
  return e;
}

export function getSeries(symbol: string, tf: ExtendedTimeframe): Candle[] {
  const e = getEntry(symbol, tf);
  const all = e.chunks.sort((a, b) => a.start - b.start).flatMap((c) => c.data);
  return all;
}

export function planViewportFetch(
  symbol: string,
  tf: ExtendedTimeframe,
  domain: Range,
  viewportBarsTarget = 350
): ViewportFetchPlan {
  const e = getEntry(symbol, tf);
  const r = clampRange(domain);
  const { base, group } = mapExtendedTimeframe(tf);
  const baseMs = resolutionToMs(base);
  const approxViewportSpanMs = Math.max(1, r.max - r.min);

  // Choose chunk span ~ 2.5x viewport span, snapped to base bars (fallback to bars target)
  const chunkSpanMs = Math.max(
    baseMs * group * viewportBarsTarget,
    Math.round(approxViewportSpanMs * 2.5)
  );

  const thresh = Math.round(approxViewportSpanMs * 0.2);

  const plan: ViewportFetchPlan = {};
  if (!e.loadedRange) {
    plan.backfillFrom = r.min - chunkSpanMs;
    plan.backfillTo = r.max;
    return plan;
  }

  // Backfill left
  if (r.min < e.loadedRange.min + thresh) {
    plan.backfillFrom = e.loadedRange.min - chunkSpanMs;
    plan.backfillTo = e.loadedRange.min - 1;
  }
  // Prefetch right
  if (r.max > e.loadedRange.max - thresh) {
    plan.prefetchFrom = e.loadedRange.max + 1;
    plan.prefetchTo = e.loadedRange.max + chunkSpanMs;
  }
  return plan;
}

export async function fetchWindow(
  symbol: string,
  tf: ExtendedTimeframe,
  fromMs: number,
  toMs: number,
  signal?: AbortSignal
): Promise<Candle[]> {
  // Delegate to provider; it internally aggregates from base resolution
  return fetchCandlesForTimeframeWindow(
    symbol,
    tf,
    fromMs,
    toMs,
    undefined,
    signal
  );
}

export async function ensureRange(
  symbol: string,
  tf: ExtendedTimeframe,
  fetchFrom: number,
  fetchTo: number,
  viewportDomain?: Range
): Promise<Candle[]> {
  const entry = getEntry(symbol, tf);
  if (entry.abort) {
    try {
      entry.abort.abort();
    } catch {}
  }
  const controller = new AbortController();
  entry.abort = controller;
  entry.status = "fetching";

  const data = await fetchWindow(
    symbol,
    tf,
    fetchFrom,
    fetchTo,
    controller.signal
  );
  const chunk: Chunk = {
    start: Math.min(fetchFrom, fetchTo),
    end: Math.max(fetchFrom, fetchTo),
    data: data.sort((a, b) => a.time - b.time),
  };
  entry.chunks = mergeChunks(entry.chunks, chunk);

  // Update loaded range
  const first = entry.chunks[0];
  const last = entry.chunks[entry.chunks.length - 1];
  entry.loadedRange =
    first && last ? { min: first.start, max: last.end } : chunk;
  entry.status = "idle";

  // Return a stitched series limited to viewport if provided
  const all = getSeries(symbol, tf);
  if (!viewportDomain) return all;
  const { min, max } = clampRange(viewportDomain);
  return all.filter((c) => c.time >= min && c.time <= max);
}

export function clearViewportCache(symbol?: string) {
  if (!symbol) {
    store.clear();
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(`${symbol}:`)) store.delete(k as BarsKey);
  }
}

export function getLoadedRange(
  symbol: string,
  tf: ExtendedTimeframe
): Range | null {
  return getEntry(symbol, tf).loadedRange;
}

export function getStatus(symbol: string, tf: ExtendedTimeframe) {
  return getEntry(symbol, tf).status;
}
