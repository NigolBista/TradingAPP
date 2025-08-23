import Constants from "expo-constants";
import { SimpleQuote } from "./quotes";

interface PolygonQuote {
  ticker: string;
  last_quote?: {
    last: number;
    change: number;
    change_percent: number;
  };
  day?: {
    change: number;
    change_percent: number;
    close: number;
    high: number;
    low: number;
    open: number;
    previous_close: number;
    volume: number;
  };
  updated?: number;
}

interface PolygonBulkResponse {
  status: string;
  results?: PolygonQuote[];
  error?: string;
}

/**
 * Fetch bulk quotes from Polygon API
 */
export async function fetchPolygonBulkQuotes(
  symbols: string[]
): Promise<Record<string, SimpleQuote>> {
  const polygonApiKey = (Constants.expoConfig?.extra as any)?.polygonApiKey;

  if (!polygonApiKey) {
    throw new Error("Polygon API key not configured");
  }

  if (!symbols || symbols.length === 0) {
    return {};
  }

  // Polygon allows up to 50 symbols per request
  const chunkSize = 50;
  const results: Record<string, SimpleQuote> = {};

  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize);
    const symbolsParam = chunk.join(",");

    const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbolsParam}&apikey=${polygonApiKey}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Polygon API HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data: PolygonBulkResponse = await response.json();

      if (data.status !== "OK") {
        throw new Error(`Polygon API error: ${data.error || "Unknown error"}`);
      }

      if (data.results) {
        for (const quote of data.results) {
          const symbol = quote.ticker;

          // Use day data if available, fallback to last_quote
          const dayData = quote.day;
          const lastQuote = quote.last_quote;

          let last = 0;
          let change = 0;
          let changePercent = 0;
          let volume = 0;

          if (dayData) {
            last = dayData.close || dayData.previous_close || 0;
            change = dayData.change || 0;
            changePercent = dayData.change_percent || 0;
            volume = dayData.volume || 0;
          } else if (lastQuote) {
            last = lastQuote.last || 0;
            change = lastQuote.change || 0;
            changePercent = lastQuote.change_percent || 0;
          }

          results[symbol] = {
            symbol,
            last,
            change,
            changePercent,
            volume,
            updated: quote.updated,
          };
        }
      }

      // Rate limiting: wait between chunks
      if (i + chunkSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Failed to fetch Polygon quotes for chunk:`, chunk, error);

      // Add placeholder quotes for failed symbols
      for (const symbol of chunk) {
        if (!results[symbol]) {
          results[symbol] = {
            symbol,
            last: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            updated: Date.now(),
          };
        }
      }
    }
  }

  return results;
}

/**
 * Fetch single quote from Polygon API
 */
export async function fetchPolygonSingleQuote(
  symbol: string
): Promise<SimpleQuote> {
  const quotes = await fetchPolygonBulkQuotes([symbol]);
  return (
    quotes[symbol] || {
      symbol,
      last: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      updated: Date.now(),
    }
  );
}

/**
 * Check if Polygon API is available
 */
export function isPolygonApiAvailable(): boolean {
  return Boolean((Constants.expoConfig?.extra as any)?.polygonApiKey);
}
