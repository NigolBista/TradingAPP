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
  | "5m"
  | "10m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "1Y"
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

type ProviderType = "marketData" | "polygon";

function getSelectedProvider(override?: ProviderType): ProviderType {
  const cfg = (Constants.expoConfig?.extra as any) || {};
  const envProvider = (cfg.marketProvider as ProviderType) || "marketData";
  return (override as ProviderType) || envProvider;
}

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

/** Polygon helpers */
function polygonApiKey(): string | undefined {
  const cfg = (Constants.expoConfig?.extra as any) || {};
  return cfg.polygonApiKey as string | undefined;
}

function mapResolutionToPolygon(resolution: MarketDataResolution): {
  multiplier: number;
  timespan: "minute" | "hour" | "day" | "week" | "month";
} {
  switch (resolution) {
    case "1":
      return { multiplier: 1, timespan: "minute" };
    case "5":
      return { multiplier: 5, timespan: "minute" };
    case "15":
      return { multiplier: 15, timespan: "minute" };
    case "30":
      return { multiplier: 30, timespan: "minute" };
    case "1H":
      return { multiplier: 1, timespan: "hour" };
    case "D":
      return { multiplier: 1, timespan: "day" };
    case "W":
      return { multiplier: 1, timespan: "week" };
    case "M":
    default:
      return { multiplier: 1, timespan: "month" };
  }
}

function toIsoDateUTC(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchPolygonCandles(
  symbol: string,
  resolution: MarketDataResolution,
  limit: number
): Promise<Candle[]> {
  const key = polygonApiKey();
  if (!key) {
    throw new Error("Polygon API key missing. Set extra.polygonApiKey.");
  }

  const { multiplier, timespan } = mapResolutionToPolygon(resolution);
  const to = new Date();
  const baseDaysBack = computeDaysBack(resolution, limit);
  const from = new Date(to.getTime() - baseDaysBack * 24 * 60 * 60 * 1000);

  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
    symbol
  )}/range/${multiplier}/${timespan}/${toIsoDateUTC(from)}/${toIsoDateUTC(
    to
  )}?adjusted=true&sort=asc&limit=${Math.max(
    1,
    limit
  )}&apiKey=${encodeURIComponent(key)}`;

  // Debug: show the date range being requested
  try {
    // Use ISO UTC dates for clarity
    const fromStr = toIsoDateUTC(from);
    const toStr = toIsoDateUTC(to);
    console.log(
      `\ud83d\udcf1 Polygon API Request: ${symbol} ${resolution} from ${fromStr} to ${toStr} (limit: ${limit})`
    );
  } catch (_) {
    // no-op
  }

  const json = await fetchJson(url, { "Content-Type": "application/json" });
  const results = (json?.results || []) as any[];
  const candles: Candle[] = results
    .map((r) => ({
      time: Number(r.t),
      open: Number(r.o),
      high: Number(r.h),
      low: Number(r.l),
      close: Number(r.c),
      volume: Number(r.v),
    }))
    .filter((k) => Number.isFinite(k.open) && Number.isFinite(k.close))
    .sort((a, b) => a.time - b.time);

  return candles.length > limit ? candles.slice(-limit) : candles;
}

async function fetchPolygonCandlesWindow(
  symbol: string,
  resolution: MarketDataResolution,
  fromMs: number,
  toMs: number,
  limit: number,
  signal?: AbortSignal
): Promise<Candle[]> {
  const key = polygonApiKey();
  if (!key) {
    throw new Error("Polygon API key missing. Set extra.polygonApiKey.");
  }

  const { multiplier, timespan } = mapResolutionToPolygon(resolution);
  const minMs = Math.min(fromMs, toMs);
  const maxMs = Math.max(fromMs, toMs);
  const from = new Date(minMs);
  const to = new Date(maxMs);

  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
    symbol
  )}/range/${multiplier}/${timespan}/${toIsoDateUTC(from)}/${toIsoDateUTC(
    to
  )}?adjusted=true&sort=asc&limit=${Math.max(
    1,
    limit
  )}&apiKey=${encodeURIComponent(key)}`;

  // Debug: show the date range being requested
  try {
    const fromStr = toIsoDateUTC(from);
    const toStr = toIsoDateUTC(to);
    console.log(
      `\ud83d\udcf1 Polygon API Request: ${symbol} ${resolution} from ${fromStr} to ${toStr} (limit: ${limit})`
    );
  } catch (_) {
    // no-op
  }

  const json = await fetchJson(
    url,
    { "Content-Type": "application/json" },
    signal
  );
  const results = (json?.results || []) as any[];
  const candles: Candle[] = results
    .map((r) => ({
      time: Number(r.t),
      open: Number(r.o),
      high: Number(r.h),
      low: Number(r.l),
      close: Number(r.c),
      volume: Number(r.v),
    }))
    .filter((k) => Number.isFinite(k.open) && Number.isFinite(k.close))
    .sort((a, b) => a.time - b.time);

  return candles.length > limit ? candles.slice(-limit) : candles;
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
    case "5m":
      return { base: "5", group: 1 };
    case "10m":
      return { base: "5", group: 2 };
    case "15m":
      return { base: "15", group: 1 };
    case "30m":
      return { base: "30", group: 1 };

    // hour groupings - use native hourly data when available
    case "1h":
      return { base: "1H", group: 1 }; // Native 1-hour data
    case "2h":
      return { base: "1H", group: 2 }; // 2×1h = 2h
    case "4h":
      return { base: "1H", group: 4 }; // 4×1h = 4h

    // higher level: intraday feel for 1D, then daily/weekly/monthly
    case "1D":
      return { base: "1", group: 1 }; // 1-minute data for full trading day (390 bars)
    case "1W":
      return { base: "D", group: 1 }; // Daily data for weekly view
    case "1M":
      return { base: "D", group: 1 }; // Daily data for monthly view
    case "3M":
      return { base: "D", group: 1 }; // Daily data for 3-month view
    case "1Y":
      return { base: "D", group: 1 }; // Daily data for 1-year view
    case "5Y":
      return { base: "W", group: 1 }; // Weekly data for 5-year view
    case "ALL":
    default:
      return { base: "M", group: 1 };
  }
}

/** Professional trading platform data targets per timeframe */
function desiredOutputBars(tf: ExtendedTimeframe): number {
  switch (tf) {
    // Minute timeframes - show enough data for meaningful analysis
    case "1m":
      return 390; // Full trading day (6.5 hours)
    case "2m":
      return 195; // Full trading day in 2m intervals
    case "3m":
      return 130; // Full trading day in 3m intervals
    case "5m":
      return 390; // 2 full trading days for pattern analysis
    case "10m":
      return 195; // 2 full trading days in 10m intervals
    case "15m":
      return 130; // 2 full trading days in 15m intervals
    case "30m":
      return 65; // 2 full trading days in 30m intervals

    // Hour timeframes - show weeks/months of data
    case "1h":
      return 156; // ~1 month of hourly data (24 trading days)
    case "2h":
      return 78; // ~1 month of 2h data
    case "4h":
      return 120; // ~2 months of 4h data

    // Daily and longer timeframes
    case "1D":
      return 390; // full trading day in 1-minute bars (6.5 hours * 60 minutes)
    case "1W":
      return 7; // 1 week of daily data
    case "1M":
      return 22; // ~1 month of daily data (trading days)
    case "3M":
      return 66; // ~3 months of daily data
    case "1Y":
      return 252; // ~1 trading year of daily data
    case "5Y":
      return 260; // ~5 years of weekly data
    case "ALL":
      return 600; // Maximum historical view (monthly data)
    default:
      return 200;
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
  limit: number,
  includeExtendedHours: boolean = true
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
  const fromStr = formatDate(from);
  const toStr = formatDate(to);

  // Build URL with extended hours parameter
  let url = `https://api.marketdata.app/v1/stocks/candles/${resolution}/${encodeURIComponent(
    symbol
  )}/?from=${fromStr}&to=${toStr}&limit=${limit}`;

  // Add extended hours parameter - MarketData.app includes extended hours by default
  // but we can be explicit about it for clarity
  if (includeExtendedHours) {
    url += "&extended=true";
  }

  // Debug: show the date range being requested
  console.log(
    `\ud83d\udce1 API Request: ${symbol} ${resolution} from ${fromStr} to ${toStr} (limit: ${limit})`
  );

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
  signal?: AbortSignal,
  includeExtendedHours: boolean = true
): Promise<Candle[]> {
  const apiToken = (Constants.expoConfig?.extra as any)?.marketDataApiToken;
  if (!apiToken) {
    throw new Error(
      "MarketData API token missing. Set extra.marketDataApiToken."
    );
  }

  // Validate date range
  const minMs = Math.min(fromMs, toMs);
  const maxMs = Math.max(fromMs, toMs);
  const now = Date.now();

  // Ensure dates are reasonable (not too far in the past or future)
  const fiveYearsAgo = now - 5 * 365 * 24 * 60 * 60 * 1000;
  const oneWeekFromNow = now + 7 * 24 * 60 * 60 * 1000;

  const validFromMs = Math.max(minMs, fiveYearsAgo);
  const validToMs = Math.min(maxMs, oneWeekFromNow);

  const from = new Date(validFromMs);
  const to = new Date(validToMs);

  // Ensure proper date formatting for API - use UTC to avoid timezone issues
  const formatDate = (d: Date) => {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fromStr = formatDate(from);
  const toStr = formatDate(to);

  // Build URL with extended hours parameter
  let url = `https://api.marketdata.app/v1/stocks/candles/${resolution}/${encodeURIComponent(
    symbol
  )}/?from=${fromStr}&to=${toStr}&limit=${limit}`;

  // Add extended hours parameter
  if (includeExtendedHours) {
    url += "&extended=true";
  }

  console.log(
    `📡 API Request: ${symbol} ${resolution} from ${fromStr} to ${toStr} (limit: ${limit}, extended: ${includeExtendedHours})`
  );

  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  const json = await fetchJson(url, headers, signal);

  if (json?.s !== "ok") {
    const errorMsg = json?.errmsg || "Unknown MarketData error";
    console.error(`❌ API Error for ${symbol}:`, errorMsg, { url });
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

  console.log(
    `✅ API Response: ${symbol} ${resolution} returned ${candles.length} candles`
  );

  // Extra safety — server respects limit, but trim if needed
  return candles.length > limit ? candles.slice(-limit) : candles;
}

/** Public entry that your UI should call for timeframe-based charts */
export async function fetchCandlesForTimeframe(
  symbol: string,
  timeframe: ExtendedTimeframe,
  opts?: {
    outBars?: number;
    baseCushion?: number;
    includeExtendedHours?: boolean;
    providerOverride?: ProviderType;
  }
): Promise<Candle[]> {
  const { base, group } = mapExtendedTimeframe(timeframe);
  const provider = getSelectedProvider(opts?.providerOverride as ProviderType);

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
    providerOverride: provider,
    includeExtendedHours: opts?.includeExtendedHours,
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
  opts?: {
    outBars?: number;
    baseCushion?: number;
    includeExtendedHours?: boolean;
    providerOverride?: ProviderType;
  },
  signal?: AbortSignal
): Promise<Candle[]> {
  const { base, group } = mapExtendedTimeframe(timeframe);
  const provider = getSelectedProvider(opts?.providerOverride as ProviderType);
  const outBars = opts?.outBars ?? desiredOutputBars(timeframe);
  const BASE_CUSHION = opts?.baseCushion ?? 1.2;
  const MAX_BASE = 1200;
  const baseLimit = Math.min(
    Math.ceil(outBars * group * BASE_CUSHION),
    MAX_BASE
  );

  const baseCandles =
    provider === "polygon"
      ? await fetchPolygonCandlesWindow(
          symbol,
          base,
          fromMs,
          toMs,
          baseLimit,
          signal
        )
      : await fetchMarketDataCandlesWindow(
          symbol,
          base,
          fromMs,
          toMs,
          baseLimit,
          signal,
          opts?.includeExtendedHours
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
  providerOverride?: ProviderType;
  includeExtendedHours?: boolean;
}

/* ---------- ultra-simple in-memory cache ---------- */
type CacheKey = string;
const candleCache = new Map<CacheKey, { ts: number; candles: Candle[] }>();
const inflight = new Map<CacheKey, Promise<Candle[]>>();
const DEFAULT_TTL_MS = 60_000; // 1 minute — great for intraday pulls

function cacheKey(symbol: string, options: FetchCandlesOptions): string {
  const p = options.providerOverride || getSelectedProvider();
  const extended = options.includeExtendedHours ?? true;
  return `${symbol}|${p}|${options.resolution || "D"}|${
    options.limit || "default"
  }|ext:${extended}`;
}

/** Direct MarketData fetch with caching */
export async function fetchCandles(
  symbol: string,
  options: FetchCandlesOptions = {}
): Promise<Candle[]> {
  const resolution = options.resolution || "D";
  const limit = options.limit || 120;
  const includeExtendedHours = options.includeExtendedHours ?? true;
  const provider = getSelectedProvider(options.providerOverride);

  const key = cacheKey(symbol, { resolution, limit, includeExtendedHours });

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
      const candles =
        provider === "polygon"
          ? await fetchPolygonCandles(symbol, resolution, limit)
          : await fetchMarketDataCandles(
              symbol,
              resolution,
              limit,
              includeExtendedHours
            );
      candleCache.set(key, { ts: Date.now(), candles });
      return candles;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}
