export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
}

// Popular stocks for quick selection
const POPULAR_STOCKS: StockSearchResult[] = [
  { symbol: "AAPL", name: "Apple Inc.", type: "stock", exchange: "NASDAQ" },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    type: "stock",
    exchange: "NASDAQ",
  },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "stock", exchange: "NASDAQ" },
  {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    type: "stock",
    exchange: "NASDAQ",
  },
  { symbol: "TSLA", name: "Tesla Inc.", type: "stock", exchange: "NASDAQ" },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    type: "stock",
    exchange: "NASDAQ",
  },
  {
    symbol: "META",
    name: "Meta Platforms Inc.",
    type: "stock",
    exchange: "NASDAQ",
  },
  { symbol: "NFLX", name: "Netflix Inc.", type: "stock", exchange: "NASDAQ" },
  {
    symbol: "BABA",
    name: "Alibaba Group Holding",
    type: "stock",
    exchange: "NYSE",
  },
  { symbol: "V", name: "Visa Inc.", type: "stock", exchange: "NYSE" },
  { symbol: "JNJ", name: "Johnson & Johnson", type: "stock", exchange: "NYSE" },
  { symbol: "WMT", name: "Walmart Inc.", type: "stock", exchange: "NYSE" },
  {
    symbol: "JPM",
    name: "JPMorgan Chase & Co.",
    type: "stock",
    exchange: "NYSE",
  },
  {
    symbol: "UNH",
    name: "UnitedHealth Group Inc.",
    type: "stock",
    exchange: "NYSE",
  },
  {
    symbol: "PG",
    name: "Procter & Gamble Co.",
    type: "stock",
    exchange: "NYSE",
  },
  { symbol: "HD", name: "Home Depot Inc.", type: "stock", exchange: "NYSE" },
  { symbol: "MA", name: "Mastercard Inc.", type: "stock", exchange: "NYSE" },
  { symbol: "DIS", name: "Walt Disney Co.", type: "stock", exchange: "NYSE" },
  { symbol: "ADBE", name: "Adobe Inc.", type: "stock", exchange: "NASDAQ" },
  { symbol: "CRM", name: "Salesforce Inc.", type: "stock", exchange: "NYSE" },
  {
    symbol: "PYPL",
    name: "PayPal Holdings Inc.",
    type: "stock",
    exchange: "NASDAQ",
  },
  {
    symbol: "INTC",
    name: "Intel Corporation",
    type: "stock",
    exchange: "NASDAQ",
  },
  {
    symbol: "CMCSA",
    name: "Comcast Corporation",
    type: "stock",
    exchange: "NASDAQ",
  },
  {
    symbol: "VZ",
    name: "Verizon Communications",
    type: "stock",
    exchange: "NYSE",
  },
  { symbol: "KO", name: "Coca-Cola Co.", type: "stock", exchange: "NYSE" },
  { symbol: "PEP", name: "PepsiCo Inc.", type: "stock", exchange: "NASDAQ" },
  { symbol: "T", name: "AT&T Inc.", type: "stock", exchange: "NYSE" },
  {
    symbol: "ABT",
    name: "Abbott Laboratories",
    type: "stock",
    exchange: "NYSE",
  },
  {
    symbol: "CVX",
    name: "Chevron Corporation",
    type: "stock",
    exchange: "NYSE",
  },
  { symbol: "LLY", name: "Eli Lilly and Co.", type: "stock", exchange: "NYSE" },
  {
    symbol: "TMO",
    name: "Thermo Fisher Scientific",
    type: "stock",
    exchange: "NYSE",
  },
  {
    symbol: "COST",
    name: "Costco Wholesale Corp.",
    type: "stock",
    exchange: "NASDAQ",
  },
  { symbol: "AVGO", name: "Broadcom Inc.", type: "stock", exchange: "NASDAQ" },
  { symbol: "NKE", name: "Nike Inc.", type: "stock", exchange: "NYSE" },
  {
    symbol: "XOM",
    name: "Exxon Mobil Corporation",
    type: "stock",
    exchange: "NYSE",
  },

  // ETFs
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    type: "etf",
    exchange: "NYSE",
  },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "etf", exchange: "NASDAQ" },
  {
    symbol: "IWM",
    name: "iShares Russell 2000 ETF",
    type: "etf",
    exchange: "NYSE",
  },
  {
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    type: "etf",
    exchange: "NYSE",
  },
  {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    type: "etf",
    exchange: "NYSE",
  },
  {
    symbol: "VEA",
    name: "Vanguard FTSE Developed Markets ETF",
    type: "etf",
    exchange: "NYSE",
  },
  {
    symbol: "VWO",
    name: "Vanguard FTSE Emerging Markets ETF",
    type: "etf",
    exchange: "NYSE",
  },
  {
    symbol: "BND",
    name: "Vanguard Total Bond Market ETF",
    type: "etf",
    exchange: "NASDAQ",
  },
  { symbol: "GLD", name: "SPDR Gold Shares", type: "etf", exchange: "NYSE" },
  {
    symbol: "SLV",
    name: "iShares Silver Trust",
    type: "etf",
    exchange: "NYSE",
  },

  // Crypto
  { symbol: "BTC-USD", name: "Bitcoin USD", type: "crypto" },
  { symbol: "ETH-USD", name: "Ethereum USD", type: "crypto" },
  { symbol: "DOGE-USD", name: "Dogecoin USD", type: "crypto" },
  { symbol: "ADA-USD", name: "Cardano USD", type: "crypto" },
  { symbol: "SOL-USD", name: "Solana USD", type: "crypto" },
];

export async function searchStocks(
  query: string
): Promise<StockSearchResult[]> {
  // Import the new stock data service
  const { searchStocksAutocomplete } = await import("./stockData");

  const Constants = (await import("expo-constants")).default;
  const extra: any = Constants.expoConfig?.extra;
  const token: string | undefined = extra?.marketDataApiToken;

  // Try MarketData.app premium symbol search first if token present
  if (token && (query?.length ?? 0) > 0) {
    try {
      // Reference: https://api.marketdata.app/
      const url = `https://api.marketdata.app/v1/symbols/search?query=${encodeURIComponent(
        query
      )}&limit=15`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const rows: any[] = json?.data || json?.symbols || json || [];
        const mapped: StockSearchResult[] = rows
          .map((r: any) => ({
            symbol: r.symbol || r.ticker || r.code,
            name: r.name || r.description || "",
            type: (r.type || r.assetType || "stock").toLowerCase(),
            exchange: r.exchange || r.exch || undefined,
          }))
          .filter((m) => !!m.symbol);
        const q = (query || "").toUpperCase();
        return mapped
          .filter((m) => m.symbol.toUpperCase().startsWith(q))
          .slice(0, 15);
      }
    } catch {
      // Ignore and fall back to local
    }
  }

  // Use the comprehensive NASDAQ stock data for local search
  try {
    return await searchStocksAutocomplete(query, 15);
  } catch (error) {
    console.error("Failed to search stocks from local data:", error);

    // Ultimate fallback: filter popular list
    if (!query || query.length < 1) {
      return POPULAR_STOCKS.slice(0, 20);
    }

    const normalizedQuery = query.toUpperCase();
    const filtered = POPULAR_STOCKS.filter(
      (stock) =>
        stock.symbol.startsWith(normalizedQuery) ||
        stock.name.toUpperCase().includes(normalizedQuery)
    );
    filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return filtered.slice(0, 15);
  }
}

export function getPopularStocks(): StockSearchResult[] {
  return POPULAR_STOCKS.slice(0, 20);
}

export function getStocksByType(
  type: "stock" | "etf" | "crypto"
): StockSearchResult[] {
  return POPULAR_STOCKS.filter((stock) => stock.type === type);
}
