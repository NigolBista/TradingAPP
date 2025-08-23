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

export async function fetchSingleQuote(symbol: string): Promise<SimpleQuote> {
  const { fetchPolygonSingleQuote } = await import("./polygonQuotes");
  return await fetchPolygonSingleQuote(symbol);
}

export async function fetchBulkQuotes(
  symbols: string[]
): Promise<Record<string, SimpleQuote>> {
  const { fetchPolygonBulkQuotes } = await import("./polygonQuotes");
  return await fetchPolygonBulkQuotes(symbols);
}
