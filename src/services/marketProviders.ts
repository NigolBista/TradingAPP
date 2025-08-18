import Constants from "expo-constants";

export type Candle = {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

// Extended timeframe options for Webull-like selection
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

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Lightweight Yahoo Finance candles (no key required) using rapid endpoints via query1.finance.yahoo.com
export async function fetchYahooCandles(
  symbol: string,
  range: string = "1mo",
  interval: string = "1d"
): Promise<Candle[]> {
  const yahooKey = (Constants.expoConfig?.extra as any)?.yahooApiKey;
  const url = yahooKey
    ? `https://yfapi.net/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=${range}&interval=${interval}`
    : `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=${range}&interval=${interval}`;
  const headers: Record<string, string> = yahooKey
    ? { "x-api-key": String(yahooKey) }
    : {};
  const json = await fetchJson(url, headers);
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const ts: number[] = result.timestamp || [];
  const o = result.indicators?.quote?.[0]?.open || [];
  const h = result.indicators?.quote?.[0]?.high || [];
  const l = result.indicators?.quote?.[0]?.low || [];
  const c = result.indicators?.quote?.[0]?.close || [];
  const v = result.indicators?.quote?.[0]?.volume || [];
  const candles: Candle[] = ts.map((t: number, i: number) => ({
    time: t * 1000,
    open: o[i],
    high: h[i],
    low: l[i],
    close: c[i],
    volume: v[i],
  }));
  return candles.filter(
    (k) => Number.isFinite(k.open) && Number.isFinite(k.close)
  );
}

function mapResolutionToYahoo(resolution?: MarketDataResolution): {
  interval: string;
  range: string;
} {
  switch (resolution) {
    case "1":
      return { interval: "1m", range: "5d" };
    // Note: Yahoo supports 2m; for base we still use 1m and aggregate as needed
    case "5":
      return { interval: "5m", range: "1mo" };
    case "15":
      return { interval: "15m", range: "1mo" };
    case "30":
      return { interval: "30m", range: "1mo" };
    case "1H":
      return { interval: "60m", range: "3mo" };
    case "W":
      return { interval: "1wk", range: "3y" };
    case "M":
      return { interval: "1mo", range: "10y" };
    case "D":
    default:
      return { interval: "1d", range: "1y" };
  }
}

function mapResolutionToAlphaVantage(
  resolution?: MarketDataResolution
): AlphaVantageInterval {
  switch (resolution) {
    case "1":
      return "1min";
    case "5":
      return "5min";
    case "15":
      return "15min";
    case "30":
      return "30min";
    case "1H":
      return "60min";
    case "D":
    default:
      return "daily";
  }
}

function mapResolutionToPolygonTimespan(
  resolution?: MarketDataResolution
): string {
  switch (resolution) {
    case "1":
    case "5":
    case "15":
    case "30":
      return "minute";
    case "1H":
      return "hour";
    case "D":
    case "W":
    case "M":
    default:
      return "day";
  }
}

// Polygon.io (requires API key). If not present, falls back to Yahoo.
export async function fetchPolygonCandles(
  symbol: string,
  timespan: string = "day",
  limit: number = 120
): Promise<Candle[]> {
  const apiKey = (Constants.expoConfig?.extra as any)?.polygonApiKey;
  if (!apiKey) return fetchYahooCandles(symbol);
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - limit * 2);
  const format = (d: Date) => d.toISOString().split("T")[0];
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
    symbol
  )}/range/1/${timespan}/${format(from)}/${format(
    to
  )}?adjusted=true&sort=asc&limit=${limit}&apiKey=${apiKey}`;
  const json = await fetchJson(url);
  const results = json?.results || [];
  return results.map((r: any) => ({
    time: r.t,
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: r.v,
  }));
}

// MarketData.app resolutions
export type MarketDataResolution =
  | "1" // 1 minute
  | "5" // 5 minutes
  | "15" // 15 minutes
  | "30" // 30 minutes
  | "1H" // 1 hour
  | "D" // 1 day
  | "W" // 1 week
  | "M"; // 1 month

function mapExtendedTimeframe(tf: ExtendedTimeframe): {
  base: MarketDataResolution;
  group: number;
} {
  switch (tf) {
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
    case "1h":
      return { base: "1H", group: 1 };
    case "2h":
      return { base: "1H", group: 2 };
    case "4h":
      return { base: "1H", group: 4 };
    case "1D":
      return { base: "D", group: 1 };
    case "1W":
      return { base: "W", group: 1 };
    case "1M":
      return { base: "M", group: 1 };
    case "3M":
      return { base: "D", group: 1 };
    case "6M":
      return { base: "D", group: 1 };
    case "1Y":
      return { base: "D", group: 1 };
    case "2Y":
      return { base: "W", group: 1 };
    case "5Y":
      return { base: "W", group: 1 };
    case "ALL":
    default:
      return { base: "M", group: 1 };
  }
}

export function aggregateCandles(candles: Candle[], group: number): Candle[] {
  if (group <= 1) return candles;
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += group) {
    const slice = candles.slice(i, i + group);
    if (slice.length === 0) continue;
    const open = slice[0].open;
    const close = slice[slice.length - 1].close;
    const high = Math.max(...slice.map((c) => c.high));
    const low = Math.min(...slice.map((c) => c.low));
    const volume = slice.reduce((s, c) => s + (c.volume || 0), 0);
    const time = slice[0].time; // start time of the bucket
    out.push({ time, open, high, low, close, volume });
  }
  return out;
}

export async function fetchCandlesForTimeframe(
  symbol: string,
  timeframe: ExtendedTimeframe
): Promise<Candle[]> {
  const { base, group } = mapExtendedTimeframe(timeframe);
  try {
    const baseCandles = await fetchCandles(symbol, { resolution: base });
    return aggregateCandles(baseCandles, group);
  } catch (e) {
    // Fallback to Yahoo for base, then aggregate
    const { interval, range } = mapResolutionToYahoo(base);
    const y = await fetchYahooCandles(symbol, range, interval);
    return aggregateCandles(y, group);
  }
}

// MarketData.app candles (requires API token)
export async function fetchMarketDataCandles(
  symbol: string,
  resolution: MarketDataResolution = "D",
  limit: number = 120
): Promise<Candle[]> {
  const apiToken = (Constants.expoConfig?.extra as any)?.marketDataApiToken;
  console.log(`MarketData API Token available: ${!!apiToken}`);

  if (!apiToken) {
    throw new Error(
      "MarketData API token missing. Set extra.marketDataApiToken."
    );
  }

  // Calculate date range for historical data
  const to = new Date();
  const from = new Date();

  // Adjust date range based on resolution
  const daysBack =
    resolution === "1" ||
    resolution === "5" ||
    resolution === "15" ||
    resolution === "30"
      ? 30
      : resolution === "1H"
      ? 120
      : resolution === "D"
      ? 365
      : resolution === "W"
      ? 365 * 2
      : 365 * 5; // Monthly

  from.setDate(to.getDate() - daysBack);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const url = `https://api.marketdata.app/v1/stocks/candles/${resolution}/${encodeURIComponent(
    symbol
  )}/?from=${formatDate(from)}&to=${formatDate(to)}&limit=${limit}`;

  console.log(`Fetching MarketData candles from: ${url}`);

  try {
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    const json = await fetchJson(url, headers);
    console.log(`MarketData response status:`, json?.s);

    // Check for API errors
    if (json?.s !== "ok") {
      const errorMsg = json?.errmsg || "Unknown error";
      console.warn("MarketData API error:", errorMsg);
      console.warn("Full response:", JSON.stringify(json, null, 2));
      return [];
    }

    const timestamps = json.t || [];
    const opens = json.o || [];
    const highs = json.h || [];
    const lows = json.l || [];
    const closes = json.c || [];
    const volumes = json.v || [];

    if (timestamps.length === 0) {
      console.warn(`No data found for symbol: ${symbol}`);
      return [];
    }

    console.log(`Found ${timestamps.length} data points for ${symbol}`);

    const candles: Candle[] = timestamps
      .map((t: number, i: number) => ({
        time: t * 1000, // Convert Unix timestamp to milliseconds
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i],
      }))
      .filter(
        (c: Candle) => Number.isFinite(c.open) && Number.isFinite(c.close)
      )
      .sort((a: Candle, b: Candle) => a.time - b.time);

    console.log(`Successfully parsed ${candles.length} candles for ${symbol}`);
    return candles;
  } catch (error) {
    console.error("MarketData API error:", error);
    throw error;
  }
}

// Alpha Vantage TIME_SERIES_DAILY, WEEKLY, MONTHLY (non-adjusted) or INTRADAY
export type AlphaVantageInterval =
  | "1min"
  | "5min"
  | "15min"
  | "30min"
  | "60min"
  | "daily"
  | "weekly"
  | "monthly";

export async function fetchAlphaVantageCandles(
  symbol: string,
  interval: AlphaVantageInterval = "daily",
  outputSize: "compact" | "full" = "compact"
): Promise<Candle[]> {
  const apiKey = (Constants.expoConfig?.extra as any)?.alphaVantageApiKey;
  console.log(`Alpha Vantage API Key available: ${!!apiKey}`);

  if (!apiKey) {
    console.log("No Alpha Vantage API key found, falling back to Yahoo");
    return fetchYahooCandles(symbol);
  }

  let url: string;
  if (interval === "daily") {
    url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(
      symbol
    )}&outputsize=${outputSize}&apikey=${apiKey}`;
  } else if (interval === "weekly") {
    url = `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=${encodeURIComponent(
      symbol
    )}&apikey=${apiKey}`;
  } else if (interval === "monthly") {
    url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${encodeURIComponent(
      symbol
    )}&apikey=${apiKey}`;
  } else {
    url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(
      symbol
    )}&interval=${interval}&outputsize=${outputSize}&apikey=${apiKey}`;
  }

  console.log(
    `Fetching Alpha Vantage data from: ${url.replace(apiKey, "API_KEY_HIDDEN")}`
  );

  const json = await fetchJson(url);
  console.log(`Alpha Vantage response keys:`, Object.keys(json));

  // Check for API errors
  if (json?.Note || json?.Information || json?.["Error Message"]) {
    const errorMsg = json?.Note || json?.Information || json?.["Error Message"];
    console.warn("Alpha Vantage API error:", errorMsg);
    console.warn("Full response:", JSON.stringify(json, null, 2));
    return [];
  }

  // Determine the correct key for the time series data
  const key =
    interval === "daily"
      ? "Time Series (Daily)"
      : interval === "weekly"
      ? "Weekly Time Series"
      : interval === "monthly"
      ? "Monthly Time Series"
      : `Time Series (${interval})`;

  console.log(`Looking for key: "${key}"`);
  const series = json[key] || {};

  if (Object.keys(series).length === 0) {
    console.warn(
      `No data found for key "${key}". Available keys:`,
      Object.keys(json)
    );
    console.warn("Full JSON response:", JSON.stringify(json, null, 2));
    return [];
  }

  const entries = Object.entries(series) as [string, any][];
  console.log(`Found ${entries.length} data points for ${symbol}`);

  const candles: Candle[] = entries
    .map(([date, v]) => {
      // Handle non-adjusted data format
      const open = parseFloat(v["1. open"]);
      const high = parseFloat(v["2. high"]);
      const low = parseFloat(v["3. low"]);
      const close = parseFloat(v["4. close"]);
      const volume = parseFloat(v["5. volume"]) || undefined;

      return {
        time: new Date(date).getTime(),
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time);

  console.log(`Successfully parsed ${candles.length} candles for ${symbol}`);
  return candles;
}

export interface FetchCandlesOptions {
  interval?: AlphaVantageInterval;
  resolution?: MarketDataResolution;
  outputSize?: "compact" | "full";
  providerOverride?:
    | "polygon"
    | "alphaVantage"
    | "yahoo"
    | "marketData"
    | "robinhood"
    | "webull";
}

// Simple in-memory cache to avoid redundant API calls
type CacheKey = string;
const candleCache: Map<CacheKey, { ts: number; candles: Candle[] }> = new Map();
const inflight: Map<CacheKey, Promise<Candle[]>> = new Map();
const DEFAULT_TTL_MS = 60_000; // 1 minute, suitable for intraday pulls

function cacheKey(
  symbol: string,
  provider: string,
  options: FetchCandlesOptions
): string {
  return `${provider}|${symbol}|${
    options.resolution || options.interval || "D"
  }|${options.outputSize || "compact"}`;
}

export async function fetchCandles(
  symbol: string,
  options: FetchCandlesOptions = {}
): Promise<Candle[]> {
  const provider =
    options.providerOverride ||
    (Constants.expoConfig?.extra as any)?.marketProvider ||
    "marketData"; // Default to MarketData.app

  const key = cacheKey(symbol, provider, options);
  const ttl = DEFAULT_TTL_MS;

  // Serve from cache if fresh
  const cached = candleCache.get(key);
  if (cached && Date.now() - cached.ts < ttl) {
    return cached.candles;
  }

  // De-duplicate concurrent requests
  const existing = inflight.get(key);
  if (existing) return existing;

  const fetchPromise = (async () => {
    try {
      let candles: Candle[] = [];
      if (provider === "marketData") {
        candles = await fetchMarketDataCandles(
          symbol,
          options.resolution || "D"
        );
      } else if (provider === "polygon") {
        const ts = mapResolutionToPolygonTimespan(options.resolution);
        candles = await fetchPolygonCandles(symbol, ts);
      } else if (provider === "alphaVantage") {
        const interval =
          options.interval || mapResolutionToAlphaVantage(options.resolution);
        candles = await fetchAlphaVantageCandles(
          symbol,
          interval,
          options.outputSize || "compact"
        );
      } else if (provider === "robinhood" || provider === "webull") {
        // Import here to avoid circular dependencies
        const { brokerageApiService } = await import("./brokerageApiService");
        const timeframe =
          options.resolution === "1"
            ? "5minute"
            : options.resolution === "5"
            ? "5minute"
            : options.resolution === "15"
            ? "hour"
            : options.resolution === "30"
            ? "hour"
            : options.resolution === "1H"
            ? "hour"
            : "day";
        candles = await brokerageApiService.getCandles(
          symbol,
          provider,
          timeframe
        );
      } else {
        const { interval, range } = mapResolutionToYahoo(
          options.resolution as any
        );
        candles = await fetchYahooCandles(symbol, range, interval);
      }

      // Validate response
      if (!candles || candles.length === 0) {
        throw new Error(
          `No candles returned for ${symbol} from provider ${provider}`
        );
      }
      candleCache.set(key, { ts: Date.now(), candles });
      return candles;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, fetchPromise);
  return fetchPromise;
}

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
};

// Fast public news for testing: Yahoo Finance RSS → JSON via yarr (no key)
export async function fetchNews(
  symbol: string,
  provider?: string
): Promise<NewsItem[]> {
  // Try brokerage providers first if available
  if (provider === "robinhood" || provider === "webull") {
    try {
      const { brokerageApiService } = await import("./brokerageApiService");
      const { brokerageAuthService } = await import("./brokerageAuth");

      // Check if we have an active session
      if (brokerageAuthService.getSession(provider as any)) {
        return await brokerageApiService.getNews(symbol, provider as any);
      }
    } catch (error) {
      console.warn(
        `Failed to fetch news from ${provider}, falling back to public sources:`,
        error
      );
    }
  }

  // Prefer StockNewsAPI if key is provided
  const stockNewsApiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;
  if (stockNewsApiKey) {
    const isMarket = symbol.toLowerCase() === "market";
    const url = isMarket
      ? `https://stocknewsapi.com/api/v1/category?section=general&items=15&token=${stockNewsApiKey}`
      : `https://stocknewsapi.com/api/v1?tickers=${encodeURIComponent(
          symbol
        )}&items=15&token=${stockNewsApiKey}`;

    console.log(
      `Fetching StockNewsAPI data from: ${url.replace(
        stockNewsApiKey,
        "API_KEY_HIDDEN"
      )}`
    );
    try {
      const json = await fetchJson(url);
      const data = json?.data || [];
      return (data as any[]).map((n: any, idx: number) => ({
        id: n.news_url || `${symbol}-${idx}`,
        title: n.title,
        url: n.news_url,
        source: n.source_name,
        publishedAt: n.date,
        summary: n.text,
      }));
    } catch (e) {
      // fall through to alternative sources
    }
  }

  // Fallback: if generic newsApiKey is set, try GNews for basic coverage
  const newsApiKey = (Constants.expoConfig?.extra as any)?.newsApiKey;
  if (newsApiKey) {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(
      symbol
    )}&lang=en&country=us&max=15&token=${newsApiKey}`;
    try {
      const json = await fetchJson(url);
      const articles = json?.articles || [];
      return articles.map((a: any, idx: number) => ({
        id: a.url || `${symbol}-${idx}`,
        title: a.title,
        url: a.url,
        source: a.source?.name,
        publishedAt: a.publishedAt,
        summary: a.description,
      }));
    } catch (e) {
      // fall through to RSS fallback
    }
  }

  const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    symbol
  )}&lang=en-US`;
  const resp = await fetch(rssUrl);
  const xml = await resp.text();
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(
    0,
    15
  );
  return items.map(([, block], idx) => {
    const get = (tag: string) =>
      block.match(new RegExp(`<${tag}>([\s\S]*?)<\\/${tag}>`))?.[1] || "";
    const title = get("title").replace(/<!\[CDATA\[|\]\]>/g, "");
    const link = get("link");
    const pubDate = get("pubDate");
    return {
      id: `${symbol}-${idx}`,
      title,
      url: link,
      source: "Yahoo Finance",
      publishedAt: pubDate,
    } as NewsItem;
  });
}
