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
  const token = (Constants.expoConfig?.extra as any)?.marketDataApiToken;
  if (!token) throw new Error("MarketData API token missing for news");

  // Default to MarketData.app official news endpoint when baseUrl isn't provided
  // Docs: https://api.marketdata.app/
  const configuredBaseUrl = (Constants.expoConfig?.extra as any)
    ?.marketDataNewsBaseUrl;
  const baseUrl = (
    configuredBaseUrl?.trim()?.length
      ? configuredBaseUrl
      : "https://api.marketdata.app/v1/news"
  ).replace(/\/$/, "");

  // Fetch latest premium news for symbol
  const url = `${baseUrl}?symbol=${encodeURIComponent(symbol)}&limit=20`;
  const json = await fetchJson(url, {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  const items = (json?.data || json?.news || json || []) as any[];
  return items.slice(0, 20).map((a: any, idx: number) => ({
    id: a.id || a.url || `${symbol}-${idx}`,
    title: a.title || a.headline || "",
    url: a.url || a.link || "",
    source: a.source || a.publisher,
    publishedAt: a.publishedAt || a.datetime,
    summary: a.summary || a.description,
    symbol,
  }));
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

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  const provider =
    (Constants.expoConfig?.extra as any)?.newsProvider || "yahoo";
  const cacheK = key(provider, symbol);
  const cached = newsCache.get(cacheK);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.items;
  const existing = inflight.get(cacheK);
  if (existing) return existing;

  const promise = (async () => {
    try {
      let items: NewsItem[] = [];
      if (provider === "marketData") items = await fetchMarketDataNews(symbol);
      else if (provider === "gnews") items = await fetchGNews(symbol);
      else if (provider === "yahoo") items = await fetchYahooRss(symbol);
      else throw new Error(`Unsupported news provider: ${provider}`);
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
