import Constants from "expo-constants";

export type SimpleQuote = {
  symbol: string;
  last: number; // last traded price
  change: number; // absolute change vs prev close
  changePercent: number; // percentage change in % (e.g., -0.27 for -0.27%)
  volume?: number;
  updated?: number; // epoch seconds from API
};

function buildAuthHeaders(): Record<string, string> {
  const token = (Constants.expoConfig?.extra as any)?.marketDataApiToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchBulkQuotes(
  symbols: string[]
): Promise<Record<string, SimpleQuote>> {
  if (!symbols || symbols.length === 0) return {};

  const params = encodeURIComponent(symbols.join(","));
  const url = `https://api.marketdata.app/v1/stocks/bulkquotes/?symbols=${params}`;
  const headers = { ...buildAuthHeaders(), "Content-Type": "application/json" };

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Bulk quotes HTTP ${res.status}`);
  }

  const json = await res.json();
  if (json?.s !== "ok") {
    throw new Error(`Bulk quotes API error: ${json?.errmsg || "unknown"}`);
  }

  const syms: string[] = json.symbol || [];
  const last: number[] = json.last || [];
  const change: number[] = json.change || [];
  const changepct: number[] = json.changepct || [];
  const volume: number[] = json.volume || [];
  const updated: number[] = json.updated || [];

  const out: Record<string, SimpleQuote> = {};
  for (let i = 0; i < syms.length; i++) {
    const s = syms[i];
    const q: SimpleQuote = {
      symbol: s,
      last: Number(last[i] ?? 0) || 0,
      change: Number(change[i] ?? 0) || 0,
      changePercent: Number(changepct[i] ?? 0) * 100 || 0, // API returns fraction; convert to %
      volume: Number(volume[i] ?? 0) || 0,
      updated: Number(updated[i] ?? 0) || undefined,
    };
    out[s] = q;
  }
  return out;
}

export async function fetchSingleQuote(symbol: string): Promise<SimpleQuote> {
  const url = `https://api.marketdata.app/v1/stocks/quotes/${encodeURIComponent(
    symbol
  )}`;
  const headers = { ...buildAuthHeaders(), "Content-Type": "application/json" };

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Quote HTTP ${res.status}`);

  const j = await res.json();
  if (j?.s !== "ok")
    throw new Error(`Quote API error: ${j?.errmsg || "unknown"}`);

  const q: SimpleQuote = {
    symbol: j.symbol || symbol,
    last: Number(j.last ?? 0) || 0,
    change: Number(j.change ?? 0) || 0,
    changePercent: Number(j.changepct ?? 0) * 100 || 0, // API returns fraction; convert to %
    volume: Number(j.volume ?? 0) || 0,
    updated: Number(j.updated ?? 0) || undefined,
  };
  return q;
}

// Backward-compatible alias
export async function fetchAndCacheBulkQuotes(
  symbols: string[]
): Promise<Record<string, SimpleQuote>> {
  return await fetchBulkQuotes(symbols);
}
