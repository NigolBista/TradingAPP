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
  lastFetchTime?: number;
  recentFetchRanges?: Array<{ start: number; end: number; timestamp: number }>;
  lastViewportRange?: Range;
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

// Check if a range was recently fetched (within last 30 seconds)
function wasRecentlyFetched(entry: Entry, start: number, end: number): boolean {
  if (!entry.recentFetchRanges) return false;

  const now = Date.now();
  const recentThreshold = 30000; // 30 seconds

  // Clean up old entries
  entry.recentFetchRanges = entry.recentFetchRanges.filter(
    (range) => now - range.timestamp < recentThreshold
  );

  // Check if requested range overlaps with any recent fetch
  return entry.recentFetchRanges.some((range) => {
    const overlapStart = Math.max(start, range.start);
    const overlapEnd = Math.min(end, range.end);
    return overlapStart < overlapEnd; // Has overlap
  });
}

// Record a fetch attempt
function recordFetchAttempt(entry: Entry, start: number, end: number): void {
  if (!entry.recentFetchRanges) entry.recentFetchRanges = [];

  entry.recentFetchRanges.push({
    start,
    end,
    timestamp: Date.now(),
  });

  entry.lastFetchTime = Date.now();
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
    e = {
      key: k,
      loadedRange: null,
      chunks: [],
      status: "idle",
      abort: null,
      lastFetchTime: 0,
      recentFetchRanges: [],
      lastViewportRange: undefined,
    };
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
  viewportBarsTarget = 1000 // Increased from 350 to 1000 for larger chunks
): ViewportFetchPlan {
  const e = getEntry(symbol, tf);

  // Early exit if already fetching
  if (e.status === "fetching") {
    console.log(
      `📊 Skipping fetch planning - already fetching for ${symbol}:${tf}`
    );
    return {};
  }

  const r = clampRange(domain);

  // Check if viewport has changed significantly (more than 5% of span)
  if (e.lastViewportRange) {
    const lastSpan = e.lastViewportRange.max - e.lastViewportRange.min;
    const currentSpan = r.max - r.min;
    const minChange = Math.max(lastSpan, currentSpan) * 0.05; // 5% threshold

    const minDiff = Math.abs(r.min - e.lastViewportRange.min);
    const maxDiff = Math.abs(r.max - e.lastViewportRange.max);

    if (minDiff < minChange && maxDiff < minChange) {
      console.log(
        `📊 Skipping fetch planning - viewport change too small for ${symbol}:${tf}`
      );
      return {};
    }
  }

  // Update last viewport range
  e.lastViewportRange = { min: r.min, max: r.max };
  const { base, group } = mapExtendedTimeframe(tf);
  const baseMs = resolutionToMs(base);
  const approxViewportSpanMs = Math.max(1, r.max - r.min);

  // Choose much larger chunk span ~ 5x viewport span for fewer API calls
  const chunkSpanMs = Math.max(
    baseMs * group * viewportBarsTarget,
    Math.round(approxViewportSpanMs * 5.0) // Increased from 2.5x to 5x
  );

  // Less aggressive threshold - only trigger when much closer to edge
  const thresh = Math.round(approxViewportSpanMs * 0.25); // Increased from 0.1 to 0.25

  const plan: ViewportFetchPlan = {};

  console.log(`📊 Planning viewport fetch for ${symbol}:${tf}`, {
    viewport: {
      min: new Date(r.min).toISOString(),
      max: new Date(r.max).toISOString(),
    },
    loadedRange: e.loadedRange
      ? {
          min: new Date(e.loadedRange.min).toISOString(),
          max: new Date(e.loadedRange.max).toISOString(),
        }
      : null,
    threshold: thresh,
  });

  if (!e.loadedRange) {
    plan.backfillFrom = r.min - chunkSpanMs;
    plan.backfillTo = r.max + chunkSpanMs; // Extend to the right as well for initial load
    console.log(`📊 Initial load planned:`, {
      from: new Date(plan.backfillFrom).toISOString(),
      to: new Date(plan.backfillTo).toISOString(),
    });
    return plan;
  }

  // Backfill left - trigger when viewport approaches left edge
  if (r.min < e.loadedRange.min + thresh) {
    const backfillFrom = e.loadedRange.min - chunkSpanMs;
    const backfillTo = e.loadedRange.min - 1;

    // Check if this range was recently fetched
    if (!wasRecentlyFetched(e, backfillFrom, backfillTo)) {
      plan.backfillFrom = backfillFrom;
      plan.backfillTo = backfillTo;
      console.log(`📊 Left backfill planned:`, {
        from: new Date(plan.backfillFrom).toISOString(),
        to: new Date(plan.backfillTo).toISOString(),
      });
    } else {
      console.log(`📊 Left backfill skipped - recently fetched`);
    }
  }

  // Prefetch right - trigger when viewport approaches right edge
  if (r.max > e.loadedRange.max - thresh) {
    const prefetchFrom = e.loadedRange.max + 1;
    const prefetchTo = e.loadedRange.max + chunkSpanMs;

    // Check if this range was recently fetched
    if (!wasRecentlyFetched(e, prefetchFrom, prefetchTo)) {
      plan.prefetchFrom = prefetchFrom;
      plan.prefetchTo = prefetchTo;
      console.log(`📊 Right prefetch planned:`, {
        from: new Date(plan.prefetchFrom).toISOString(),
        to: new Date(plan.prefetchTo).toISOString(),
      });
    } else {
      console.log(`📊 Right prefetch skipped - recently fetched`);
    }
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
  console.log(`📡 Fetching viewport window for ${symbol}:${tf}`, {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    spanDays: Math.round(Math.abs(toMs - fromMs) / (24 * 60 * 60 * 1000)),
  });

  try {
    const candles = await fetchCandlesForTimeframeWindow(
      symbol,
      tf,
      fromMs,
      toMs,
      undefined,
      signal
    );

    console.log(`✅ Viewport fetch successful for ${symbol}:${tf}`, {
      candlesReceived: candles.length,
      firstCandle:
        candles.length > 0 ? new Date(candles[0].time).toISOString() : null,
      lastCandle:
        candles.length > 0
          ? new Date(candles[candles.length - 1].time).toISOString()
          : null,
    });

    return candles;
  } catch (error) {
    console.error(`❌ Viewport fetch failed for ${symbol}:${tf}`, {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function ensureRange(
  symbol: string,
  tf: ExtendedTimeframe,
  fetchFrom: number,
  fetchTo: number,
  viewportDomain?: Range
): Promise<Candle[]> {
  const entry = getEntry(symbol, tf);

  // Abort any existing request for this entry
  if (entry.abort) {
    try {
      entry.abort.abort();
    } catch {}
  }

  const controller = new AbortController();
  entry.abort = controller;
  entry.status = "fetching";

  // Record this fetch attempt to prevent duplicate requests
  recordFetchAttempt(entry, fetchFrom, fetchTo);

  try {
    const data = await fetchWindow(
      symbol,
      tf,
      fetchFrom,
      fetchTo,
      controller.signal
    );

    // Check if request was aborted
    if (controller.signal.aborted) {
      console.log("📊 Viewport fetch aborted for", symbol, tf);
      return getSeries(symbol, tf);
    }

    const chunk: Chunk = {
      start: Math.min(fetchFrom, fetchTo),
      end: Math.max(fetchFrom, fetchTo),
      data: data.sort((a, b) => a.time - b.time),
    };
    entry.chunks = mergeChunks(entry.chunks, chunk);

    // Update loaded range based on actual data boundaries
    const allData = getSeries(symbol, tf);
    if (allData.length > 0) {
      entry.loadedRange = {
        min: allData[0].time,
        max: allData[allData.length - 1].time,
      };
    } else {
      entry.loadedRange = { min: chunk.start, max: chunk.end };
    }
    entry.status = "idle";

    // Return a stitched series limited to viewport if provided
    const all = getSeries(symbol, tf);
    if (!viewportDomain) return all;
    const { min, max } = clampRange(viewportDomain);
    return all.filter((c) => c.time >= min && c.time <= max);
  } catch (error) {
    entry.status = "idle";
    entry.abort = null;

    // If aborted, return existing data
    if (controller.signal.aborted) {
      console.log(
        "📊 Viewport fetch aborted, returning cached data for",
        symbol,
        tf
      );
      return getSeries(symbol, tf);
    }

    console.warn("📊 Viewport fetch failed for", symbol, tf, error);
    // Return existing data on error
    return getSeries(symbol, tf);
  }
}

export function clearViewportCache(
  symbol?: string,
  timeframe?: ExtendedTimeframe
) {
  if (!symbol) {
    // Clear all entries and abort ongoing requests
    for (const [key, entry] of store.entries()) {
      if (entry.abort) {
        try {
          entry.abort.abort();
        } catch {}
      }
    }
    store.clear();
    return;
  }

  if (timeframe) {
    // Clear specific symbol:timeframe entry
    const key = keyFor(symbol, timeframe);
    const entry = store.get(key);
    if (entry) {
      if (entry.abort) {
        try {
          entry.abort.abort();
        } catch {}
      }
      store.delete(key);
    }
    return;
  }

  // Clear all entries for this symbol
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(`${symbol}:`)) {
      const entry = store.get(k as BarsKey);
      if (entry?.abort) {
        try {
          entry.abort.abort();
        } catch {}
      }
      store.delete(k as BarsKey);
    }
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
