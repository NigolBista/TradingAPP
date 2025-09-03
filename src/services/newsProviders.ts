import Constants from "expo-constants";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
  symbol?: string;
  sentiment?: "Positive" | "Negative" | "Neutral";
  type?: "Article" | "Video" | "PressRelease";
  imageUrl?: string;
  topics?: string[];
  tickers?: string[];
};

// caching to avoid repeated calls
type CacheKey = string;
const newsCache: Map<CacheKey, { ts: number; items: NewsItem[] }> = new Map();
const sentimentCache: Map<CacheKey, { ts: number; stats: SentimentStats }> =
  new Map();
const chartCache: Map<CacheKey, { ts: number; data: any[] }> = new Map();
const inflight: Map<CacheKey, Promise<NewsItem[]>> = new Map();
const sentimentInflight: Map<CacheKey, Promise<SentimentStats>> = new Map();
const chartInflight: Map<CacheKey, Promise<any[]>> = new Map();
const TTL_MS = 30 * 60 * 1000; // 30 minutes

function key(provider: string, symbol: string): string {
  return `${provider}|${symbol}`;
}

// Clean up expired cache entries
function cleanupCache() {
  const now = Date.now();

  // Clean news cache
  for (const [key, value] of newsCache.entries()) {
    if (now - value.ts > TTL_MS) {
      newsCache.delete(key);
    }
  }

  // Clean sentiment cache
  for (const [key, value] of sentimentCache.entries()) {
    if (now - value.ts > TTL_MS) {
      sentimentCache.delete(key);
    }
  }

  // Clean chart cache
  for (const [key, value] of chartCache.entries()) {
    if (now - value.ts > TTL_MS) {
      chartCache.delete(key);
    }
  }
}

// Run cleanup every 10 minutes (singleton guard)
let cleanupInterval: any = (globalThis as any).__NEWS_CACHE_CLEANUP__;
if (!cleanupInterval) {
  cleanupInterval = setInterval(cleanupCache, 10 * 60 * 1000);
  (globalThis as any).__NEWS_CACHE_CLEANUP__ = cleanupInterval;
}

export function stopNewsCacheCleanup() {
  try {
    const existing = (globalThis as any).__NEWS_CACHE_CLEANUP__;
    if (existing) {
      clearInterval(existing);
      (globalThis as any).__NEWS_CACHE_CLEANUP__ = null;
    }
  } catch {}
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

// StockNewsAPI.com provider
// Docs: https://stocknewsapi.com/documentation
// Enhanced with multiple endpoint support and advanced features

export interface StockNewsApiItem {
  news_url: string;
  image_url?: string;
  title: string;
  text: string;
  source_name: string;
  date: string;
  topics?: string[];
  sentiment?: "Positive" | "Negative" | "Neutral";
  type?: "Article" | "Video" | "PressRelease";
  tickers?: string[];
}

export interface StockNewsApiResponse {
  data: StockNewsApiItem[];
  total_pages?: number;
  total_items?: number;
}

export interface TrendingStock {
  ticker: string;
  company_name?: string;
  mentions: number;
  sentiment: "Positive" | "Negative" | "Neutral";
  sentiment_score?: number;
}

export interface MarketEvent {
  event_id: string;
  title: string;
  description: string;
  date: string;
  impact: "High" | "Medium" | "Low";
  tickers?: string[];
}

export interface SentimentStats {
  symbol: string;
  totalPositive: number;
  totalNegative: number;
  totalNeutral: number;
  sentimentScore: number;
  dailyData?: Record<
    string,
    {
      positive: number;
      negative: number;
      neutral: number;
      sentimentScore: number;
    }
  >;
}

// Fetch sentiment statistics for a ticker with caching
async function fetchSentimentStats(
  symbol: string,
  dateRange: string = "last30days"
): Promise<SentimentStats> {
  const cacheKey = `sentiment|${symbol}|${dateRange}`;
  const now = Date.now();

  // Check cache first
  const cached = sentimentCache.get(cacheKey);
  if (cached && now - cached.ts < TTL_MS) {
    console.log("📊 Using cached sentiment stats for", symbol);
    return cached.stats;
  }

  // Check if request is already in flight
  const existing = sentimentInflight.get(cacheKey);
  if (existing) {
    console.log("📊 Sentiment stats request already in flight for", symbol);
    return existing;
  }

  const apiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;

  if (!apiKey) {
    throw new Error("STOCK_NEWS_API_KEY missing for StockNewsAPI provider");
  }

  const endpoint = `https://stocknewsapi.com/api/v1/stat?tickers=${encodeURIComponent(
    symbol
  )}&date=${dateRange}&token=${apiKey}`;

  console.log("📊 Fetching fresh sentiment stats for", symbol);

  const promise = (async () => {
    try {
      const json = await fetchJson(endpoint);

      const symbolData = json?.total?.[symbol];
      if (!symbolData) {
        throw new Error(`No sentiment data found for ${symbol}`);
      }

      const dailyData: Record<string, any> = {};
      if (json.data) {
        Object.entries(json.data).forEach(([date, dateData]: [string, any]) => {
          const symbolDayData = dateData[symbol];
          if (symbolDayData) {
            dailyData[date] = {
              positive: symbolDayData.Positive || 0,
              negative: symbolDayData.Negative || 0,
              neutral: symbolDayData.Neutral || 0,
              sentimentScore: symbolDayData.sentiment_score || 0,
            };
          }
        });
      }

      const stats: SentimentStats = {
        symbol,
        totalPositive: symbolData["Total Positive"] || 0,
        totalNegative: symbolData["Total Negative"] || 0,
        totalNeutral: symbolData["Total Neutral"] || 0,
        sentimentScore: symbolData["Sentiment Score"] || 0,
        dailyData: Object.keys(dailyData).length > 0 ? dailyData : undefined,
      };

      // Cache the result
      sentimentCache.set(cacheKey, { ts: now, stats });

      return stats;
    } catch (error) {
      console.error("❌ Sentiment Stats API Error:", error);
      throw error;
    } finally {
      // Remove from inflight
      sentimentInflight.delete(cacheKey);
    }
  })();

  // Add to inflight
  sentimentInflight.set(cacheKey, promise);

  return promise;
}

// Basic news fetching for single or multiple tickers with caching
async function fetchStockNewsApi(
  symbol: string,
  items: number = 20,
  options: {
    sentiment?: "Positive" | "Negative" | "Neutral";
    type?: "Article" | "Video" | "PressRelease";
    excludeSources?: string[];
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<NewsItem[]> {
  // Create cache key including options for proper caching
  const optionsKey = JSON.stringify(options);
  const cacheKey = `stocknews|${symbol}|${items}|${optionsKey}`;
  const now = Date.now();

  // Check cache first
  const cached = newsCache.get(cacheKey);
  if (cached && now - cached.ts < TTL_MS) {
    console.log("📰 Using cached news for", symbol);
    return cached.items;
  }

  // Check if request is already in flight
  const existing = inflight.get(cacheKey);
  if (existing) {
    console.log("📰 News request already in flight for", symbol);
    return existing;
  }

  const apiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;

  console.log(
    "🔑 Stock News API Key:",
    apiKey ? `${apiKey.substring(0, 8)}...` : "NOT SET"
  );

  if (!apiKey)
    throw new Error("STOCK_NEWS_API_KEY missing for StockNewsAPI provider");

  const isMarket = symbol.toLowerCase() === "market";
  let endpoint: string;

  if (isMarket) {
    // General market news
    endpoint = `https://stocknewsapi.com/api/v1/category?section=general&items=${items}&token=${apiKey}`;
  } else {
    // Specific ticker news
    endpoint = `https://stocknewsapi.com/api/v1?tickers=${encodeURIComponent(
      symbol
    )}&items=${items}&token=${apiKey}`;
  }

  // Add optional filters
  const params = new URLSearchParams();
  if (options.sentiment) params.append("sentiment", options.sentiment);
  if (options.type) params.append("type", options.type);
  if (options.excludeSources)
    params.append("exclude_sources", options.excludeSources.join(","));
  if (options.dateFrom) params.append("date_from", options.dateFrom);
  if (options.dateTo) params.append("date_to", options.dateTo);

  const queryString = params.toString();
  if (queryString) {
    endpoint += `&${queryString}`;
  }

  console.log("📡 Stock News API URL:", endpoint.replace(apiKey, "***"));

  const promise = (async () => {
    try {
      const json: StockNewsApiResponse = await fetchJson(endpoint);
      console.log(
        "✅ Stock News API Response:",
        json?.data?.length || 0,
        "items"
      );
      const data = json?.data || [];

      const items = data.map((n: StockNewsApiItem, idx: number) => ({
        id: n.news_url || `${symbol}-${idx}`,
        title: n.title,
        url: n.news_url,
        source: n.source_name,
        publishedAt: n.date,
        summary: n.text,
        symbol: isMarket ? "market" : symbol,
        sentiment: n.sentiment,
        type: n.type,
        imageUrl: n.image_url,
        topics: n.topics,
        tickers: n.tickers,
      }));

      // Cache the result
      newsCache.set(cacheKey, { ts: now, items });

      return items;
    } catch (error) {
      console.error("❌ Stock News API Error:", error);
      console.error("📡 Failed URL:", endpoint.replace(apiKey, "***"));
      throw error;
    } finally {
      // Remove from inflight
      inflight.delete(cacheKey);
    }
  })();

  // Add to inflight
  inflight.set(cacheKey, promise);

  return promise;
}

// Fetch news for multiple tickers
async function fetchMultipleTickersNews(
  tickers: string[],
  items: number = 20,
  requireAll: boolean = false
): Promise<NewsItem[]> {
  const apiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;
  if (!apiKey)
    throw new Error("STOCK_NEWS_API_KEY missing for StockNewsAPI provider");

  const tickersParam = tickers.join(",");
  const endpoint = requireAll
    ? `https://stocknewsapi.com/api/v1?tickers=${encodeURIComponent(
        tickersParam
      )}&items=${items}&token=${apiKey}&must_have_all=true`
    : `https://stocknewsapi.com/api/v1?tickers=${encodeURIComponent(
        tickersParam
      )}&items=${items}&token=${apiKey}`;

  const json: StockNewsApiResponse = await fetchJson(endpoint);
  const data = json?.data || [];

  return data.map((n: StockNewsApiItem, idx: number) => ({
    id: n.news_url || `multi-${idx}`,
    title: n.title,
    url: n.news_url,
    source: n.source_name,
    publishedAt: n.date,
    summary: n.text,
    symbol: n.tickers?.join(", ") || "multiple",
    sentiment: n.sentiment,
    type: n.type,
    imageUrl: n.image_url,
    topics: n.topics,
    tickers: n.tickers,
  }));
}

// Fetch trending stocks (most mentioned)
async function fetchTrendingStocks(days: number = 7): Promise<TrendingStock[]> {
  const apiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;
  if (!apiKey)
    throw new Error("STOCK_NEWS_API_KEY missing for StockNewsAPI provider");

  const endpoint = `https://stocknewsapi.com/api/v1/most_mentioned?days=${days}&token=${apiKey}`;
  const json = await fetchJson(endpoint);

  return json?.data || [];
}

// Fetch market events
async function fetchMarketEvents(): Promise<MarketEvent[]> {
  const apiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;
  if (!apiKey)
    throw new Error("STOCK_NEWS_API_KEY missing for StockNewsAPI provider");

  const endpoint = `https://stocknewsapi.com/api/v1/events?token=${apiKey}`;
  const json = await fetchJson(endpoint);

  return json?.data || [];
}

// Fetch sector-specific news
async function fetchSectorNews(
  sector: string,
  items: number = 20
): Promise<NewsItem[]> {
  const apiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;
  if (!apiKey)
    throw new Error("STOCK_NEWS_API_KEY missing for StockNewsAPI provider");

  const endpoint = `https://stocknewsapi.com/api/v1/category?section=alltickers&items=${items}&sector=${encodeURIComponent(
    sector
  )}&token=${apiKey}`;
  const json: StockNewsApiResponse = await fetchJson(endpoint);
  const data = json?.data || [];

  return data.map((n: StockNewsApiItem, idx: number) => ({
    id: n.news_url || `${sector}-${idx}`,
    title: n.title,
    url: n.news_url,
    source: n.source_name,
    publishedAt: n.date,
    summary: n.text,
    symbol: sector,
    sentiment: n.sentiment,
    type: n.type,
    imageUrl: n.image_url,
    topics: n.topics,
    tickers: n.tickers,
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
    (Constants.expoConfig?.extra as any)?.newsProvider || "stocknewsapi";
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
      } else if (provider === "stocknewsapi") {
        // Prefer StockNewsAPI for both market and symbol news.
        // If it fails or returns empty (rate limits, key issues, or no coverage),
        // gracefully fall back to other public sources so the UI is never blank.
        const extra = (Constants.expoConfig?.extra as any) || {};
        try {
          items = await fetchStockNewsApi(symbol);
        } catch (err) {
          items = [];
        }
        if (!items || items.length === 0) {
          if (symbol === "market") {
            // Market-wide fallback: NewsAPI top headlines if available
            if (extra.newsApiKey) {
              try {
                items = await fetchNewsApiTopHeadlines(hoursBack);
              } catch {}
            }
          } else {
            // Symbol fallback chain: GNews (if key) → Yahoo RSS
            if ((!items || items.length === 0) && extra.newsApiKey) {
              try {
                items = await fetchGNews(symbol);
              } catch {}
            }
            if (!items || items.length === 0) {
              try {
                items = await fetchYahooRss(symbol);
              } catch {}
            }
          }
        }
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

// Export advanced Stock News API functions
// Chart data caching functions
export function getCachedChartData(
  symbol: string,
  timeframe: string
): any[] | null {
  const cacheKey = `chart|${symbol}|${timeframe}`;
  const cached = chartCache.get(cacheKey);

  if (cached && Date.now() - cached.ts < TTL_MS) {
    console.log("📈 Using cached chart data for", symbol, timeframe);
    return cached.data;
  }

  return null;
}

export function setCachedChartData(
  symbol: string,
  timeframe: string,
  data: any[]
): void {
  const cacheKey = `chart|${symbol}|${timeframe}`;
  chartCache.set(cacheKey, { ts: Date.now(), data });
  console.log("📈 Cached chart data for", symbol, timeframe);
}

export {
  fetchStockNewsApi,
  fetchSentimentStats,
  fetchMultipleTickersNews,
  fetchTrendingStocks,
  fetchMarketEvents,
  fetchSectorNews,
};

// Convenience functions for common use cases based on examples
export async function fetchTeslaNews(items: number = 3): Promise<NewsItem[]> {
  return fetchStockNewsApi("TSLA", items);
}

export async function fetchMultipleTechStocks(
  items: number = 20
): Promise<NewsItem[]> {
  return fetchMultipleTickersNews(["META", "AMZN", "NFLX"], items);
}

export async function fetchTechStocksRequireAll(
  items: number = 20
): Promise<NewsItem[]> {
  return fetchMultipleTickersNews(["META", "AMZN", "NFLX"], items, true);
}

export async function fetchOnlyAmazonNews(
  items: number = 20
): Promise<NewsItem[]> {
  return fetchStockNewsApi("AMZN", items);
}

export async function fetchTechnologySectorNews(
  items: number = 20
): Promise<NewsItem[]> {
  return fetchSectorNews("Technology", items);
}

export async function fetchGeneralMarketNews(
  items: number = 20
): Promise<NewsItem[]> {
  console.log("🌍 Fetching general market news with", items, "items");
  return fetchStockNewsApi("market", items);
}

export async function fetchNegativeAmazonNews(
  items: number = 20
): Promise<NewsItem[]> {
  return fetchStockNewsApi("AMZN", items, { sentiment: "Negative" });
}

export async function fetchVideoNewsOnTesla(
  items: number = 20
): Promise<NewsItem[]> {
  return fetchStockNewsApi("TSLA", items, { type: "Video" });
}

export async function fetchPressReleasesOnly(
  items: number = 20
): Promise<NewsItem[]> {
  const apiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;
  if (!apiKey) throw new Error("STOCK_NEWS_API_KEY missing");

  const endpoint = `https://stocknewsapi.com/api/v1/category?section=alltickers&items=${items}&type=PressRelease&token=${apiKey}`;
  const json: StockNewsApiResponse = await fetchJson(endpoint);
  const data = json?.data || [];

  return data.map((n: StockNewsApiItem, idx: number) => ({
    id: n.news_url || `press-${idx}`,
    title: n.title,
    url: n.news_url,
    source: n.source_name,
    publishedAt: n.date,
    summary: n.text,
    symbol: n.tickers?.join(", ") || "press-release",
    sentiment: n.sentiment,
    type: n.type,
    imageUrl: n.image_url,
    topics: n.topics,
    tickers: n.tickers,
  }));
}
