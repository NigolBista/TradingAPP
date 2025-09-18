import Constants from "expo-constants";
import type { SimpleQuote } from "./quotes";

function getMarketDataToken(): string {
  const token = (Constants.expoConfig?.extra as any)?.marketDataApiToken as
    | string
    | undefined;
  if (!token) {
    throw new Error(
      "MarketData API token missing. Set extra.marketDataApiToken."
    );
  }
  return token;
}

function readNumber(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    const v = (value as any[])[0];
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  const n = Number((value as any) ?? undefined);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Fetch a single symbol quote from MarketData.app and map to SimpleQuote
 */
export async function fetchMarketDataSingleQuote(
  symbol: string
): Promise<SimpleQuote> {
  const token = getMarketDataToken();
  const url = `https://api.marketdata.app/v1/stocks/quotes/${encodeURIComponent(
    symbol
  )}/`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json: any = await res.json();
  if (json?.s && json.s !== "ok") {
    throw new Error(json?.errmsg || "MarketData quotes error");
  }

  // Extract fields defensively (API returns arrays for consistency)
  const last =
    readNumber(json?.last) ?? readNumber(json?.mid) ?? readNumber(json?.price);
  const prevClose =
    readNumber(json?.prevClose) ||
    readNumber(json?.previousClose) ||
    readNumber(json?.pc);
  const change =
    readNumber(json?.change) ??
    (last !== undefined && prevClose !== undefined
      ? Number(last) - Number(prevClose)
      : undefined);
  const changePercent =
    readNumber(json?.changePercent) ??
    readNumber(json?.change_pct) ??
    readNumber(json?.cp) ??
    (change !== undefined && prevClose && prevClose !== 0
      ? (Number(change) / Number(prevClose)) * 100
      : undefined);
  const volume = readNumber(json?.volume) ?? readNumber(json?.v) ?? 0;
  const updated =
    readNumber(json?.updated) ?? readNumber(json?.timestamp) ?? Date.now();

  return {
    symbol,
    last: Number.isFinite(Number(last)) ? Number(last) : 0,
    change: Number.isFinite(Number(change)) ? Number(change) : 0,
    changePercent: Number.isFinite(Number(changePercent))
      ? Number(changePercent)
      : 0,
    volume: Number.isFinite(Number(volume)) ? Number(volume) : 0,
    updated: Number.isFinite(Number(updated)) ? Number(updated) : Date.now(),
  };
}

/**
 * Fetch quotes for many symbols using concurrency-limited single requests
 */
export async function fetchMarketDataBulkQuotes(
  symbols: string[]
): Promise<Record<string, SimpleQuote>> {
  if (!symbols || symbols.length === 0) return {};

  const CONCURRENCY = 10;
  const out: Record<string, SimpleQuote> = {};

  let index = 0;
  while (index < symbols.length) {
    const slice = symbols.slice(index, index + CONCURRENCY);
    await Promise.all(
      slice.map(async (s) => {
        try {
          const q = await fetchMarketDataSingleQuote(s);
          out[s] = q;
        } catch (err) {
          // Graceful fallback placeholder
          out[s] = {
            symbol: s,
            last: 0,
            change: 0,
            changePercent: 0,
            volume: 0,
            updated: Date.now(),
          };
        }
      })
    );
    index += CONCURRENCY;
  }

  return out;
}
