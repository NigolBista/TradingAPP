import Constants from "expo-constants";

export type SimpleQuote = {
  symbol: string;
  last: number; // last traded price
  change: number; // absolute change vs prev close
  changePercent: number; // percentage change in % (e.g., -0.27 for -0.27%)
  volume?: number;
  updated?: number; // epoch seconds from API
};

// No caching - direct Polygon API calls only

// Removed MarketData.app quotes support; Polygon-only now

export async function fetchSingleQuote(
  symbol: string,
  providerOverride?: "marketData" | "polygon"
): Promise<SimpleQuote> {
  const cfg = (Constants.expoConfig?.extra as any) || {};
  const provider =
    providerOverride ||
    cfg.quotesProvider ||
    cfg.marketProvider ||
    "marketData";

  if (provider === "polygon") {
    const { fetchPolygonSingleQuote } = await import("./polygonQuotes");
    return await fetchPolygonSingleQuote(symbol);
  }

  const { fetchMarketDataSingleQuote } = await import("./marketDataQuotes");
  return await fetchMarketDataSingleQuote(symbol);
}

export async function fetchBulkQuotes(
  symbols: string[],
  providerOverride?: "marketData" | "polygon"
): Promise<Record<string, SimpleQuote>> {
  const cfg = (Constants.expoConfig?.extra as any) || {};
  const provider =
    providerOverride ||
    cfg.quotesProvider ||
    cfg.marketProvider ||
    "marketData";

  if (provider === "polygon") {
    const { fetchPolygonBulkQuotes } = await import("./polygonQuotes");
    return await fetchPolygonBulkQuotes(symbols);
  }

  const { fetchMarketDataBulkQuotes } = await import("./marketDataQuotes");
  return await fetchMarketDataBulkQuotes(symbols);
}

// Backward-compatible alias: caching layer was removed, delegate to fetchBulkQuotes
export async function fetchAndCacheBulkQuotes(
  symbols: string[],
  providerOverride?: "marketData" | "polygon"
): Promise<Record<string, SimpleQuote>> {
  return await fetchBulkQuotes(symbols, providerOverride);
}
