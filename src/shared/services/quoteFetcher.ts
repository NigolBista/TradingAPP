import { fetchBulkQuotes, fetchSingleQuote, type SimpleQuote } from "./quotes";
import {
  fetchMarketDataBulkQuotes,
  fetchMarketDataSingleQuote,
} from "./marketDataQuotes";

function isRateLimitError(error: unknown): boolean {
  const msg = (error as any)?.message || String(error || "");
  return /\b429\b/.test(msg) || /rate ?limit/i.test(msg);
}

export async function safeFetchBulkQuotes(
  symbols: string[]
): Promise<Record<string, SimpleQuote>> {
  try {
    return await fetchBulkQuotes(symbols);
  } catch (err) {
    if (isRateLimitError(err)) {
      // Fallback to MarketData single-quote API with concurrency limiting
      try {
        return await fetchMarketDataBulkQuotes(symbols);
      } catch (err2) {
        throw err2;
      }
    }
    throw err;
  }
}

export async function safeFetchSingleQuote(
  symbol: string
): Promise<SimpleQuote> {
  try {
    return await fetchSingleQuote(symbol);
  } catch (err) {
    if (isRateLimitError(err)) {
      return await fetchMarketDataSingleQuote(symbol);
    }
    throw err;
  }
}
