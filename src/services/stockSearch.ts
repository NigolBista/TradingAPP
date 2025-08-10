export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange?: string;
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
  if (!query || query.length < 1) {
    return POPULAR_STOCKS.slice(0, 20);
  }

  const normalizedQuery = query.toUpperCase();

  // Filter popular stocks by symbol or name
  const filtered = POPULAR_STOCKS.filter(
    (stock) =>
      stock.symbol.includes(normalizedQuery) ||
      stock.name.toUpperCase().includes(normalizedQuery)
  );

  // Sort by relevance (symbol matches first, then name matches)
  filtered.sort((a, b) => {
    const aSymbolMatch = a.symbol.startsWith(normalizedQuery);
    const bSymbolMatch = b.symbol.startsWith(normalizedQuery);

    if (aSymbolMatch && !bSymbolMatch) return -1;
    if (!aSymbolMatch && bSymbolMatch) return 1;

    return a.symbol.localeCompare(b.symbol);
  });

  return filtered.slice(0, 10);
}

export function getPopularStocks(): StockSearchResult[] {
  return POPULAR_STOCKS.slice(0, 20);
}

export function getStocksByType(
  type: "stock" | "etf" | "crypto"
): StockSearchResult[] {
  return POPULAR_STOCKS.filter((stock) => stock.type === type);
}
