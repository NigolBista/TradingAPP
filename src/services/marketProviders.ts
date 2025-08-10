import Constants from "expo-constants";

export type Candle = {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

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
  | "H" // 1 hour
  | "D" // 1 day
  | "W" // 1 week
  | "M"; // 1 month

// MarketData.app candles (requires API token)
export async function fetchMarketDataCandles(
  symbol: string,
  resolution: MarketDataResolution = "D",
  limit: number = 120
): Promise<Candle[]> {
  const apiToken = (Constants.expoConfig?.extra as any)?.marketDataApiToken;
  console.log(`MarketData API Token available: ${!!apiToken}`);

  if (!apiToken) {
    console.log("No MarketData API token found, falling back to Yahoo");
    return fetchYahooCandles(symbol);
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
      : resolution === "H"
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
    console.log("Falling back to Yahoo Finance");
    return fetchYahooCandles(symbol);
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
  providerOverride?: "polygon" | "alphaVantage" | "yahoo" | "marketData";
}

export async function fetchCandles(
  symbol: string,
  options: FetchCandlesOptions = {}
): Promise<Candle[]> {
  const provider =
    options.providerOverride ||
    (Constants.expoConfig?.extra as any)?.marketProvider ||
    "marketData"; // Default to MarketData.app

  if (provider === "marketData") {
    return fetchMarketDataCandles(symbol, options.resolution || "D");
  }
  if (provider === "polygon") return fetchPolygonCandles(symbol);
  if (provider === "alphaVantage")
    return fetchAlphaVantageCandles(
      symbol,
      options.interval || "daily",
      options.outputSize || "compact"
    );
  return fetchYahooCandles(symbol);
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
export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  const newsApiKey = (Constants.expoConfig?.extra as any)?.newsApiKey;
  if (newsApiKey) {
    // Example: GNews API (fast and simple for testing)
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
