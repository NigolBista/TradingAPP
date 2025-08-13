import Constants from "expo-constants";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
  symbol?: string;
};

// caching to avoid repeated calls
type CacheKey = string;
const newsCache: Map<CacheKey, { ts: number; items: NewsItem[] }> = new Map();
const inflight: Map<CacheKey, Promise<NewsItem[]>> = new Map();
const TTL_MS = 120_000; // 2 minutes

function key(provider: string, symbol: string): string {
  return `${provider}|${symbol}`;
}

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchMarketDataNews(symbol: string): Promise<NewsItem[]> {
  // Use the latest headline endpoint (single item)
  return fetchMarketDataNewsLatest(symbol);
}

async function fetchGNews(symbol: string): Promise<NewsItem[]> {
  const newsApiKey = (Constants.expoConfig?.extra as any)?.newsApiKey;
  if (!newsApiKey) throw new Error("NEWS_API_KEY missing for GNews provider");
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(
    symbol
  )}&lang=en&country=us&max=20&token=${newsApiKey}`;
  const json = await fetchJson(url);
  const articles = json?.articles || [];
  return articles.map((a: any, idx: number) => ({
    id: a.url || `${symbol}-${idx}`,
    title: a.title,
    url: a.url,
    source: a.source?.name,
    publishedAt: a.publishedAt,
    summary: a.description,
    symbol,
  }));
}

// NewsAPI.org provider (top headlines and symbol-specific search)
async function fetchNewsApiTopHeadlines(
  hoursBack: number = 24
): Promise<NewsItem[]> {
  const apiKey = (Constants.expoConfig?.extra as any)?.newsApiKey;
  if (!apiKey) throw new Error("NEWS_API_KEY missing for NewsAPI provider");

  // NewsAPI top-headlines does not support from= for time filtering, so we'll fetch and filter client-side
  const url = `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=20&apiKey=${apiKey}`;
  const json = await fetchJson(url);
  const articles = json?.articles || [];
  const since = Date.now() - hoursBack * 60 * 60 * 1000;
  return (articles as any[])
    .filter((a) => !a.publishedAt || new Date(a.publishedAt).getTime() >= since)
    .map((a: any, idx: number) => ({
      id: a.url || `market-${idx}`,
      title: a.title,
      url: a.url,
      source: a.source?.name,
      publishedAt: a.publishedAt,
      summary: a.description,
      symbol: "market",
    }));
}

async function fetchNewsApiForSymbol(
  symbol: string,
  hoursBack: number = 24
): Promise<NewsItem[]> {
  const apiKey = (Constants.expoConfig?.extra as any)?.newsApiKey;
  if (!apiKey) throw new Error("NEWS_API_KEY missing for NewsAPI provider");

  // Use the Everything endpoint with qInTitle for better precision
  // Note: NewsAPI supports from= parameter
  const from = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const url = `https://newsapi.org/v2/everything?qInTitle=${encodeURIComponent(
    symbol
  )}&language=en&sortBy=publishedAt&from=${encodeURIComponent(
    from
  )}&pageSize=20&apiKey=${apiKey}`;
  const json = await fetchJson(url);
  const articles = json?.articles || [];
  return (articles as any[]).map((a: any, idx: number) => ({
    id: a.url || `${symbol}-${idx}`,
    title: a.title,
    url: a.url,
    source: a.source?.name,
    publishedAt: a.publishedAt,
    summary: a.description,
    symbol,
  }));
}

async function fetchYahooRss(symbol: string): Promise<NewsItem[]> {
  const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    symbol
  )}&lang=en-US`;
  const resp = await fetch(rssUrl);
  if (!resp.ok) throw new Error(`Yahoo RSS HTTP ${resp.status}`);
  const xml = await resp.text();
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(
    0,
    20
  );
  return items.map(([, block], idx) => {
    const get = (tag: string) =>
      block.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`))?.[1] || "";
    const title = get("title").replace(/<!\[CDATA\[|\]\]>/g, "");
    const link = get("link");
    const pubDate = get("pubDate");
    return {
      id: `${symbol}-${idx}`,
      title,
      url: link,
      source: "Yahoo Finance",
      publishedAt: pubDate,
      symbol,
    } as NewsItem;
  });
}

// Enhanced news fetching with optional date filtering
export async function fetchNewsWithDateFilter(
  symbol: string,
  hoursBack: number = 24
): Promise<NewsItem[]> {
  const provider =
    (Constants.expoConfig?.extra as any)?.newsProvider || "yahoo";
  const cacheK = key(`${provider}-${hoursBack}h`, symbol);
  const cached = newsCache.get(cacheK);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.items;
  const existing = inflight.get(cacheK);
  if (existing) return existing;

  const promise = (async () => {
    try {
      let items: NewsItem[] = [];
      if (provider === "marketData") {
        // If requesting general market news, fall back to NewsAPI top headlines
        if (symbol === "market") {
          items = await fetchNewsApiTopHeadlines(hoursBack);
        } else {
          items = await fetchMarketDataNewsLatest(symbol);
        }
      } else if (provider === "newsapi") {
        items =
          symbol === "market"
            ? await fetchNewsApiTopHeadlines(hoursBack)
            : await fetchNewsApiForSymbol(symbol, hoursBack);
      } else if (provider === "gnews") {
        items =
          symbol === "market"
            ? await fetchNewsApiTopHeadlines(hoursBack)
            : await fetchGNews(symbol);
      } else if (provider === "yahoo") {
        items = await fetchYahooRss(symbol);
      } else {
        throw new Error(`Unsupported news provider: ${provider}`);
      }
      if (!items || items.length === 0)
        throw new Error(`No news for ${symbol} via ${provider}`);
      newsCache.set(cacheK, { ts: Date.now(), items });
      return items;
    } finally {
      inflight.delete(cacheK);
    }
  })();

  inflight.set(cacheK, promise);
  return promise;
}

// MarketData.app single-article endpoint (latest headline)
// GET https://api.marketdata.app/v1/stocks/news/{SYMBOL}/
async function fetchMarketDataNewsLatest(symbol: string): Promise<NewsItem[]> {
  const token = (Constants.expoConfig?.extra as any)?.marketDataApiToken;
  if (!token) throw new Error("MarketData API token missing for news");

  const configuredBaseUrl = (Constants.expoConfig?.extra as any)
    ?.marketDataNewsBaseUrl;
  const baseUrl = (
    configuredBaseUrl?.trim()?.length
      ? configuredBaseUrl
      : "https://api.marketdata.app/v1/stocks/news"
  ).replace(/\/$/, "");

  const url = `${baseUrl}/${encodeURIComponent(symbol)}/`;
  const json = await fetchJson(url, {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  // Example response:
  // { s: "ok", symbol: "AAPL", headline: "..", content: "..", source: "https://..", updated: 1703041200 }
  if (!json || json.s !== "ok") return [];

  const updated =
    typeof json.updated === "number"
      ? new Date(json.updated * 1000).toISOString()
      : undefined;
  const item: NewsItem = {
    id: `${symbol}-${json.updated || Date.now()}`,
    title: json.headline || "",
    url: json.source || "",
    source: "MarketData.app",
    publishedAt: updated,
    summary: json.content || "",
    symbol,
  };
  return [item];
}

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  // Default to 24-hour news filtering
  return fetchNewsWithDateFilter(symbol, 24);
}
