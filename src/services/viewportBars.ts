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

type PanVelocity = {
  direction: "left" | "right" | "none";
  speed: number; // pixels per second
  timestamp: number;
};

type Entry = {
  key: BarsKey;
  loadedRange: Range | null;
  chunks: Chunk[];
  status: "idle" | "fetching" | "live";
  abort?: AbortController | null;
  lastFetchTime?: number;

  // TradingView-style predictive loading
  bufferZones: {
    left: {
      start: number;
      end: number;
      status: "loaded" | "loading" | "needed";
    };
    right: {
      start: number;
      end: number;
      status: "loaded" | "loading" | "needed";
    };
  } | null;

  // Pan velocity tracking for predictive loading
  panHistory: PanVelocity[];
  lastViewportRange?: Range;

  // Seamless loading state
  pendingRequests: Set<string>;
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

// Calculate pan velocity for predictive loading
function calculatePanVelocity(entry: Entry, currentRange: Range): PanVelocity {
  const now = Date.now();

  if (!entry.lastViewportRange) {
    return { direction: "none", speed: 0, timestamp: now };
  }

  const lastRange = entry.lastViewportRange;
  const timeDelta =
    now - (entry.panHistory[entry.panHistory.length - 1]?.timestamp || now);

  if (timeDelta === 0) {
    return { direction: "none", speed: 0, timestamp: now };
  }

  const leftMovement = currentRange.min - lastRange.min;
  const rightMovement = currentRange.max - lastRange.max;

  // Determine primary direction and speed
  let direction: "left" | "right" | "none" = "none";
  let speed = 0;

  if (Math.abs(leftMovement) > Math.abs(rightMovement)) {
    direction = leftMovement < 0 ? "left" : "right";
    speed = Math.abs(leftMovement) / timeDelta;
  } else if (Math.abs(rightMovement) > 0) {
    direction = rightMovement > 0 ? "right" : "left";
    speed = Math.abs(rightMovement) / timeDelta;
  }

  return { direction, speed, timestamp: now };
}

// TradingView-style buffer zone calculation
function calculateBufferZones(
  symbol: string,
  tf: ExtendedTimeframe,
  viewportRange: Range,
  panVelocity: PanVelocity
) {
  const { base, group } = mapExtendedTimeframe(tf);
  const baseMs = resolutionToMs(base);
  const viewportSpanMs = Math.max(1, viewportRange.max - viewportRange.min);

  // Base buffer size: 3x viewport span (TradingView uses large buffers)
  let baseBufferSize = viewportSpanMs * 3;

  // Velocity-based adjustments (more aggressive loading in pan direction)
  let leftBufferSize = baseBufferSize;
  let rightBufferSize = baseBufferSize;

  if (panVelocity.speed > 0) {
    const velocityMultiplier = Math.min(3, 1 + panVelocity.speed / 1000); // Cap at 3x

    if (panVelocity.direction === "left") {
      leftBufferSize *= velocityMultiplier;
    } else if (panVelocity.direction === "right") {
      rightBufferSize *= velocityMultiplier;
    }
  }

  // Ensure minimum buffer sizes based on timeframe
  const minBufferBars = 500; // Minimum bars to buffer
  const minBufferMs = baseMs * group * minBufferBars;
  leftBufferSize = Math.max(leftBufferSize, minBufferMs);
  rightBufferSize = Math.max(rightBufferSize, minBufferMs);

  return {
    left: {
      start: viewportRange.min - leftBufferSize,
      end: viewportRange.min,
      status: "needed" as const,
    },
    right: {
      start: viewportRange.max,
      end: viewportRange.max + rightBufferSize,
      status: "needed" as const,
    },
  };
}

export type ViewportFetchPlan = {
  backfillFrom?: number;
  backfillTo?: number;
  prefetchFrom?: number;
  prefetchTo?: number;
  priority?: "left" | "right" | "both";
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
      bufferZones: null,
      panHistory: [],
      lastViewportRange: undefined,
      pendingRequests: new Set(),
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

// TradingView-style seamless viewport management
export function planSeamlessViewport(
  symbol: string,
  tf: ExtendedTimeframe,
  domain: Range
): ViewportFetchPlan {
  const e = getEntry(symbol, tf);
  const r = clampRange(domain);

  // Calculate pan velocity for predictive loading
  const panVelocity = calculatePanVelocity(e, r);

  // Update pan history (keep last 5 entries for trend analysis)
  e.panHistory.push(panVelocity);
  if (e.panHistory.length > 5) {
    e.panHistory.shift();
  }

  // Update last viewport range
  e.lastViewportRange = { min: r.min, max: r.max };

  // Calculate ideal buffer zones
  const idealBuffers = calculateBufferZones(symbol, tf, r, panVelocity);

  const plan: ViewportFetchPlan = {};

  console.log(`🚀 TradingView-style viewport planning for ${symbol}:${tf}`, {
    viewport: {
      min: new Date(r.min).toISOString(),
      max: new Date(r.max).toISOString(),
    },
    panVelocity: {
      direction: panVelocity.direction,
      speed: panVelocity.speed.toFixed(2),
    },
    bufferSizes: {
      left:
        Math.round(
          (idealBuffers.left.end - idealBuffers.left.start) /
            (24 * 60 * 60 * 1000)
        ) + " days",
      right:
        Math.round(
          (idealBuffers.right.end - idealBuffers.right.start) /
            (24 * 60 * 60 * 1000)
        ) + " days",
    },
  });

  // Initial load: load viewport + both buffers
  if (!e.loadedRange) {
    plan.backfillFrom = idealBuffers.left.start;
    plan.backfillTo = idealBuffers.right.end;
    plan.priority = "both";

    console.log(`🚀 Initial seamless load planned:`, {
      from: new Date(plan.backfillFrom).toISOString(),
      to: new Date(plan.backfillTo).toISOString(),
      spanDays: Math.round(
        (plan.backfillTo - plan.backfillFrom) / (24 * 60 * 60 * 1000)
      ),
    });

    return plan;
  }

  // Check if we need to extend buffers
  const needsLeftExtension = idealBuffers.left.start < e.loadedRange.min;
  const needsRightExtension = idealBuffers.right.end > e.loadedRange.max;

  // Prioritize based on pan direction and proximity to edges
  const leftProximity =
    (r.min - e.loadedRange.min) / (e.loadedRange.max - e.loadedRange.min);
  const rightProximity =
    (e.loadedRange.max - r.max) / (e.loadedRange.max - e.loadedRange.min);

  if (
    needsLeftExtension &&
    (panVelocity.direction === "left" || leftProximity < 0.3)
  ) {
    const requestId = `left-${idealBuffers.left.start}-${e.loadedRange.min}`;
    if (!e.pendingRequests.has(requestId)) {
      plan.backfillFrom = idealBuffers.left.start;
      plan.backfillTo = e.loadedRange.min - 1;
      plan.priority = "left";

      console.log(`🚀 Left buffer extension planned:`, {
        from: new Date(plan.backfillFrom).toISOString(),
        to: new Date(plan.backfillTo).toISOString(),
        reason:
          panVelocity.direction === "left" ? "pan-direction" : "proximity",
        proximity: leftProximity.toFixed(2),
      });
    }
  }

  if (
    needsRightExtension &&
    (panVelocity.direction === "right" || rightProximity < 0.3)
  ) {
    const requestId = `right-${e.loadedRange.max}-${idealBuffers.right.end}`;
    if (!e.pendingRequests.has(requestId) && !plan.backfillFrom) {
      // Don't overlap requests
      plan.prefetchFrom = e.loadedRange.max + 1;
      plan.prefetchTo = idealBuffers.right.end;
      plan.priority = plan.priority === "left" ? "both" : "right";

      console.log(`🚀 Right buffer extension planned:`, {
        from: new Date(plan.prefetchFrom).toISOString(),
        to: new Date(plan.prefetchTo).toISOString(),
        reason:
          panVelocity.direction === "right" ? "pan-direction" : "proximity",
        proximity: rightProximity.toFixed(2),
      });
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
  console.log(`🚀 Seamless fetch for ${symbol}:${tf}`, {
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

    console.log(`✅ Seamless fetch successful for ${symbol}:${tf}`, {
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
    console.error(`❌ Seamless fetch failed for ${symbol}:${tf}`, {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function ensureSeamlessRange(
  symbol: string,
  tf: ExtendedTimeframe,
  fetchFrom: number,
  fetchTo: number,
  priority: "left" | "right" | "both" = "both"
): Promise<Candle[]> {
  const entry = getEntry(symbol, tf);

  // Create request ID for deduplication
  const requestId = `${priority}-${fetchFrom}-${fetchTo}`;

  if (entry.pendingRequests.has(requestId)) {
    console.log(`🚀 Skipping duplicate seamless request:`, requestId);
    return getSeries(symbol, tf);
  }

  entry.pendingRequests.add(requestId);

  // Abort any conflicting requests (not all requests, just conflicting ones)
  if (entry.abort && entry.status === "fetching") {
    try {
      entry.abort.abort();
    } catch {}
  }

  const controller = new AbortController();
  entry.abort = controller;
  entry.status = "fetching";
  entry.lastFetchTime = Date.now();

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
      console.log("🚀 Seamless fetch aborted for", symbol, tf);
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
    entry.pendingRequests.delete(requestId);

    console.log(`🚀 Seamless range updated:`, {
      symbol,
      tf,
      totalBars: allData.length,
      loadedRange: entry.loadedRange
        ? {
            min: new Date(entry.loadedRange.min).toISOString(),
            max: new Date(entry.loadedRange.max).toISOString(),
          }
        : null,
    });

    return allData;
  } catch (error) {
    entry.status = "idle";
    entry.abort = null;
    entry.pendingRequests.delete(requestId);

    // If aborted, return existing data
    if (controller.signal.aborted) {
      console.log(
        "🚀 Seamless fetch aborted, returning cached data for",
        symbol,
        tf
      );
      return getSeries(symbol, tf);
    }

    console.warn("🚀 Seamless fetch failed for", symbol, tf, error);
    // Return existing data on error
    return getSeries(symbol, tf);
  }
}

// Legacy compatibility functions
export function planViewportFetch(
  symbol: string,
  tf: ExtendedTimeframe,
  domain: Range,
  viewportBarsTarget = 1000
): ViewportFetchPlan {
  return planSeamlessViewport(symbol, tf, domain);
}

export async function ensureRange(
  symbol: string,
  tf: ExtendedTimeframe,
  fetchFrom: number,
  fetchTo: number,
  viewportDomain?: Range
): Promise<Candle[]> {
  return ensureSeamlessRange(symbol, tf, fetchFrom, fetchTo, "both");
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
