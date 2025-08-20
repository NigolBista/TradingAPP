import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SimpleQuote = {
  symbol: string;
  last: number; // last traded price
  change: number; // absolute change vs prev close
  changePercent: number; // percentage change in % (e.g., -0.27 for -0.27%)
  volume?: number;
  updated?: number; // epoch seconds from API
};

type CachedEntry = { quote: SimpleQuote; savedAt: number };

const MEMORY_TTL_MS = 30_000; // 30s for live feel
const STORAGE_TTL_MS = 10 * 60_000; // 10 minutes for cold starts
const STORAGE_KEY = "quotes_cache_v1";

let memoryCache: Map<string, CachedEntry> = new Map();
let storageLoaded = false;

async function loadStorageIntoMemory(): Promise<void> {
  if (storageLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: Record<string, CachedEntry> = JSON.parse(raw);
      Object.entries(parsed).forEach(([symbol, entry]) => {
        if (entry && typeof entry.savedAt === "number") {
          memoryCache.set(symbol, entry);
        }
      });
    }
  } catch (e) {
    // ignore
  } finally {
    storageLoaded = true;
  }
}

async function persistMemoryToStorage(): Promise<void> {
  try {
    const obj: Record<string, CachedEntry> = {};
    memoryCache.forEach((entry, symbol) => {
      obj[symbol] = entry;
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

export async function getCachedQuotes(
  symbols: string[]
): Promise<Record<string, SimpleQuote>> {
  await loadStorageIntoMemory();
  const now = Date.now();
  const out: Record<string, SimpleQuote> = {};
  for (const s of symbols) {
    const entry = memoryCache.get(s);
    if (!entry) continue;
    const isFresh = now - entry.savedAt < MEMORY_TTL_MS;
    const isRecent = now - entry.savedAt < STORAGE_TTL_MS;
    if (isFresh || isRecent) {
      out[s] = entry.quote;
    }
  }
  return out;
}

export async function saveQuotes(
  quotes: Record<string, SimpleQuote>
): Promise<void> {
  const now = Date.now();
  Object.values(quotes).forEach((q) => {
    memoryCache.set(q.symbol, { quote: q, savedAt: now });
  });
  await persistMemoryToStorage();
}

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
    changePercent: Number(j.changepct ?? 0) * 100 || 0,
    volume: Number(j.volume ?? 0) || 0,
    updated: Number(j.updated ?? 0) || undefined,
  };
  return q;
}

export async function fetchAndCacheBulkQuotes(
  symbols: string[]
): Promise<Record<string, SimpleQuote>> {
  const quotes = await fetchBulkQuotes(symbols);
  await saveQuotes(quotes);
  return quotes;
}
