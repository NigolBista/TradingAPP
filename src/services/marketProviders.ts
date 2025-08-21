// market-data-only.ts
import Constants from "expo-constants";

/** Basic OHLCV candle */
export type Candle = {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/** Webull-like timeframe options shown in your UI */
export type ExtendedTimeframe =
  | "1m"
  | "2m"
  | "3m"
  | "4m"
  | "5m"
  | "10m"
  | "15m"
  | "30m"
  | "45m"
  | "1h"
  | "2h"
  | "4h"
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "6M"
  | "1Y"
  | "2Y"
  | "5Y"
  | "ALL";

/** MarketData.app resolutions */
export type MarketDataResolution =
  | "1"
  | "5"
  | "15"
  | "30"
  | "1H"
  | "D"
  | "W"
  | "M";

/** Small helper */
async function fetchJson(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal
) {
  const res = await fetch(url, { headers, signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Group lower-timeframe candles into larger buckets */
export function aggregateCandles(candles: Candle[], group: number): Candle[] {
  if (group <= 1) return candles;
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += group) {
    const slice = candles.slice(i, i + group);
    if (!slice.length) continue;
    out.push({
      time: slice[0].time,
      open: slice[0].open,
      high: Math.max(...slice.map((c) => c.high)),
      low: Math.min(...slice.map((c) => c.low)),
      close: slice[slice.length - 1].close,
      volume: slice.reduce((s, c) => s + (c.volume || 0), 0),
    });
  }
  return out;
}

/** Map UI timeframe → base resolution + grouping factor.
 *  (Use coarser bases for larger ranges to keep payloads tiny.)
 */
export function mapExtendedTimeframe(tf: ExtendedTimeframe): {
  base: MarketDataResolution;
  group: number;
} {
  switch (tf) {
    // minute groupings
    case "1m":
      return { base: "1", group: 1 };
    case "2m":
      return { base: "1", group: 2 };
    case "3m":
      return { base: "1", group: 3 };
    case "4m":
      return { base: "1", group: 4 };
    case "5m":
      return { base: "5", group: 1 };
    case "10m":
      return { base: "5", group: 2 };
    case "15m":
      return { base: "15", group: 1 };
    case "30m":
      return { base: "30", group: 1 };
    case "45m":
      return { base: "15", group: 3 };

    // hour groupings (prefer 5m / 15m bases for smooth intraday)
    case "1h":
      return { base: "5", group: 12 }; // 12×5m = 1h
    case "2h":
      return { base: "5", group: 24 };
    case "4h":
      return { base: "15", group: 16 }; // 16×15m = 4h

    // higher level: intraday feel for 1D, then daily/weekly/monthly
    case "1D":
      return { base: "5", group: 1 }; // ~78 bars/day
    case "1W":
      return { base: "1H", group: 1 };
    case "1M":
      return { base: "D", group: 1 };
    case "3M":
    case "6M":
    case "1Y":
      return { base: "D", group: 1 };
    case "2Y":
    case "5Y":
      return { base: "W", group: 1 };
    case "ALL":
    default:
      return { base: "M", group: 1 };
  }
}

/** Tight, UX-friendly output targets per timeframe (fewer bars = faster UI) */
function desiredOutputBars(tf: ExtendedTimeframe): number {
  switch (tf) {
    case "1m":
    case "2m":
    case "3m":
    case "4m":
      return 240; // ~4h of 1m data
    case "5m":
    case "10m":
      return 78; // ~1 trading day in 5m
    case "15m":
      return 26; // ~1 trading day in 15m
    case "30m":
    case "45m":
      return 26; // ~1 week-ish visible quickly
    case "1h":
    case "2h":
    case "4h":
      return 80; // ~2–3 months compact
    case "1D":
      return 78; // one intraday view worth of 5m bars
    case "1W":
      return 100; // ~5–6 weeks hourly
    case "1M":
      return 60; // ~3 months daily
    case "3M":
      return 90;
    case "6M":
      return 130;
    case "1Y":
      return 200; // slightly under a trading year for snappier loads
    case "2Y":
      return 104; // ~2 years weekly
    case "5Y":
    case "ALL":
      return 180; // monthly/weekly overview, fast
    default:
      return 120;
  }
}

/** Bars per day helper (approx; for from/to window sizing only) */
function barsPerTradingDay(res: MarketDataResolution): number {
  switch (res) {
    case "1":
      return 390; // 6.5h * 60
    case "5":
      return 78;
    case "15":
      return 26;
    case "30":
      return 13;
    case "1H":
      return 7; // ~6.5h -> 7 rounded
    case "D":
      return 1;
    case "W":
      return 1 / 5; // 1 bar per ~5 trading days
    case "M":
      return 1 / 21; // 1 bar per ~21 trading days
  }
}

/** Choose a compact server window that still guarantees enough base bars */
function computeDaysBack(
  base: MarketDataResolution,
  baseLimit: number
): number {
  const bpd = barsPerTradingDay(base);
  // Convert desired bars to trading days, then to calendar days with cushion
  const tradingDaysNeeded = baseLimit / Math.max(bpd, 0.0001);
  // Add ~40% cushion for weekends/holidays and any server-side filtering
  const calendarDays = Math.ceil(((tradingDaysNeeded * 7) / 5) * 1.4);
  // Lower bound to avoid zero-day ranges
  return Math.max(calendarDays, 2);
}

/** MarketData.app — the only network we hit now */
export async function fetchMarketDataCandles(
  symbol: string,
  resolution: MarketDataResolution,
  limit: number
): Promise<Candle[]> {
  const apiToken = (Constants.expoConfig?.extra as any)?.marketDataApiToken;
  if (!apiToken) {
    throw new Error(
      "MarketData API token missing. Set extra.marketDataApiToken."
    );
  }

  const to = new Date();
  const baseDaysBack = computeDaysBack(resolution, limit);
  const from = new Date(to.getTime() - baseDaysBack * 24 * 60 * 60 * 1000);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  const url = `https://api.marketdata.app/v1/stocks/candles/${resolution}/${encodeURIComponent(
    symbol
  )}/?from=${formatDate(from)}&to=${formatDate(to)}&limit=${limit}`;

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  const json = await fetchJson(url, headers);

  if (json?.s !== "ok") {
    const errorMsg = json?.errmsg || "Unknown MarketData error";
    throw new Error(errorMsg);
  }

  const t = json.t || [];
  const o = json.o || [];
  const h = json.h || [];
  const l = json.l || [];
  const c = json.c || [];
  const v = json.v || [];

  const candles: Candle[] = t
    .map((ts: number, i: number) => ({
      time: ts * 1000,
      open: o[i],
      high: h[i],
      low: l[i],
      close: c[i],
      volume: v[i],
    }))
    .filter((k: Candle) => Number.isFinite(k.open) && Number.isFinite(k.close))
    .sort((a: Candle, b: Candle) => a.time - b.time);

  // Extra safety — server respects limit, but trim if needed
  return candles.length > limit ? candles.slice(-limit) : candles;
}

/** MarketData.app windowed fetch (by explicit from/to) */
export async function fetchMarketDataCandlesWindow(
  symbol: string,
  resolution: MarketDataResolution,
  fromMs: number,
  toMs: number,
  limit: number,
  signal?: AbortSignal
): Promise<Candle[]> {
  const apiToken = (Constants.expoConfig?.extra as any)?.marketDataApiToken;
  if (!apiToken) {
    throw new Error(
      "MarketData API token missing. Set extra.marketDataApiToken."
    );
  }

  const from = new Date(Math.min(fromMs, toMs));
  const to = new Date(Math.max(fromMs, toMs));

  const formatDate = (d: Date) => d.toISOString().split("T")[0];
  const url = `https://api.marketdata.app/v1/stocks/candles/${resolution}/${encodeURIComponent(
    symbol
  )}/?from=${formatDate(from)}&to=${formatDate(to)}&limit=${limit}`;

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  const json = await fetchJson(url, headers, signal);

  if (json?.s !== "ok") {
    const errorMsg = json?.errmsg || "Unknown MarketData error";
    throw new Error(errorMsg);
  }

  const t = json.t || [];
  const o = json.o || [];
  const h = json.h || [];
  const l = json.l || [];
  const c = json.c || [];
  const v = json.v || [];

  const candles: Candle[] = t
    .map((ts: number, i: number) => ({
      time: ts * 1000,
      open: o[i],
      high: h[i],
      low: l[i],
      close: c[i],
      volume: v[i],
    }))
    .filter((k: Candle) => Number.isFinite(k.open) && Number.isFinite(k.close))
    .sort((a: Candle, b: Candle) => a.time - b.time);

  // Extra safety — server respects limit, but trim if needed
  return candles.length > limit ? candles.slice(-limit) : candles;
}

/** Public entry that your UI should call for timeframe-based charts */
export async function fetchCandlesForTimeframe(
  symbol: string,
  timeframe: ExtendedTimeframe,
  opts?: { outBars?: number; baseCushion?: number }
): Promise<Candle[]> {
  const { base, group } = mapExtendedTimeframe(timeframe);

  // How many *output* bars we want after grouping
  const outBars = opts?.outBars ?? desiredOutputBars(timeframe);

  // Fetch enough *base* bars to build those output bars, with small cushion
  const BASE_CUSHION = opts?.baseCushion ?? 1.2;
  const MAX_BASE = 1200; // hard cap to keep payloads snappy
  const baseLimit = Math.min(
    Math.ceil(outBars * group * BASE_CUSHION),
    MAX_BASE
  );

  const baseCandles = await fetchCandles(symbol, {
    resolution: base,
    limit: baseLimit,
  });
  return aggregateCandles(baseCandles, group).slice(-outBars);
}

/** Convenience: resolution to milliseconds */
export function resolutionToMs(resolution: MarketDataResolution): number {
  switch (resolution) {
    case "1":
      return 60_000;
    case "5":
      return 5 * 60_000;
    case "15":
      return 15 * 60_000;
    case "30":
      return 30 * 60_000;
    case "1H":
      return 60 * 60_000;
    case "D":
      return 24 * 60 * 60_000;
    case "W":
      return 7 * 24 * 60 * 60_000;
    case "M":
      return 30 * 24 * 60 * 60_000; // approx
  }
}

/** Windowed timeframe fetch honoring from/to and output bar budget */
export async function fetchCandlesForTimeframeWindow(
  symbol: string,
  timeframe: ExtendedTimeframe,
  fromMs: number,
  toMs: number,
  opts?: { outBars?: number; baseCushion?: number },
  signal?: AbortSignal
): Promise<Candle[]> {
  const { base, group } = mapExtendedTimeframe(timeframe);
  const outBars = opts?.outBars ?? desiredOutputBars(timeframe);
  const BASE_CUSHION = opts?.baseCushion ?? 1.2;
  const MAX_BASE = 1200;
  const baseLimit = Math.min(
    Math.ceil(outBars * group * BASE_CUSHION),
    MAX_BASE
  );

  const baseCandles = await fetchMarketDataCandlesWindow(
    symbol,
    base,
    fromMs,
    toMs,
    baseLimit,
    signal
  );

  // Aggregate to target frame and trim to requested time window
  const aggregated = aggregateCandles(baseCandles, group);
  const minMs = Math.min(fromMs, toMs);
  const maxMs = Math.max(fromMs, toMs);
  const windowed = aggregated.filter((c) => c.time >= minMs && c.time <= maxMs);

  // Respect outBars budget if needed
  return windowed.length > outBars ? windowed.slice(-outBars) : windowed;
}

/** Minimal options (provider removed) */
export interface FetchCandlesOptions {
  resolution?: MarketDataResolution;
  limit?: number;
}

/* ---------- ultra-simple in-memory cache ---------- */
type CacheKey = string;
const candleCache = new Map<CacheKey, { ts: number; candles: Candle[] }>();
const inflight = new Map<CacheKey, Promise<Candle[]>>();
const DEFAULT_TTL_MS = 60_000; // 1 minute — great for intraday pulls

function cacheKey(symbol: string, options: FetchCandlesOptions): string {
  return `${symbol}|${options.resolution || "D"}|${options.limit || "default"}`;
}

/** Direct MarketData fetch with caching */
export async function fetchCandles(
  symbol: string,
  options: FetchCandlesOptions = {}
): Promise<Candle[]> {
  const resolution = options.resolution || "D";
  const limit = options.limit || 120;

  const key = cacheKey(symbol, { resolution, limit });

  // Serve fresh cache
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.ts < DEFAULT_TTL_MS) {
    return cached.candles;
  }

  // Deduplicate concurrent requests
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const candles = await fetchMarketDataCandles(symbol, resolution, limit);
      candleCache.set(key, { ts: Date.now(), candles });
      return candles;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}
