export interface NasdaqStock {
  Symbol: string;
  Name: string;
  "Last Sale": string;
  "Net Change": number;
  "% Change": string;
  "Market Cap": number;
  Country: string;
  "IPO Year": number | null;
  Volume: number;
  Sector: string;
  Industry: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
}

// Cache for the stocks data
let stocksCache: NasdaqStock[] | null = null;
let searchIndex: Map<string, NasdaqStock[]> | null = null;
let symbolIndex: Map<string, NasdaqStock> | null = null;
let isLoading = false;
let loadPromise: Promise<NasdaqStock[]> | null = null;

// Preload and build optimized search indexes
function initializeStocksData(): Promise<NasdaqStock[]> {
  if (stocksCache) {
    return Promise.resolve(stocksCache);
  }

  if (loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = new Promise((resolve, reject) => {
    try {
      // Use import() for better performance with large files
      import("../data/nasdaq-stocks.json")
        .then((module) => {
          const stocksData = module.default as NasdaqStock[];
          stocksCache = stocksData;

          // Build optimized search indexes
          buildSearchIndexes(stocksData);

          isLoading = false;
          resolve(stocksData);
        })
        .catch((error) => {
          console.error("Failed to import stocks data:", error);
          isLoading = false;
          reject(error);
        });
    } catch (error) {
      console.error("Failed to load stocks data:", error);
      isLoading = false;
      reject(error);
    }
  });

  return loadPromise;
}

// Build comprehensive search indexes for instant searching
function buildSearchIndexes(stocksData: NasdaqStock[]) {
  searchIndex = new Map();
  symbolIndex = new Map();

  stocksData.forEach((stock) => {
    const symbol = stock.Symbol.toUpperCase();
    const name = stock.Name.toUpperCase();

    // Build exact symbol lookup
    symbolIndex!.set(symbol, stock);

    // Index by symbol prefixes (first 1-3 characters)
    for (let i = 1; i <= Math.min(3, symbol.length); i++) {
      const prefix = symbol.substring(0, i);
      if (!searchIndex!.has(prefix)) {
        searchIndex!.set(prefix, []);
      }
      if (!searchIndex!.get(prefix)!.some((s) => s.Symbol === stock.Symbol)) {
        searchIndex!.get(prefix)!.push(stock);
      }
    }

    // Index by company name words (first 2 characters of each word)
    const words = name.split(/\s+/);
    words.forEach((word) => {
      if (word.length >= 2) {
        const wordPrefix = word.substring(0, 2);
        if (!searchIndex!.has(wordPrefix)) {
          searchIndex!.set(wordPrefix, []);
        }
        if (
          !searchIndex!.get(wordPrefix)!.some((s) => s.Symbol === stock.Symbol)
        ) {
          searchIndex!.get(wordPrefix)!.push(stock);
        }
      }
    });
  });

  console.log(`Built search indexes for ${stocksData.length} stocks`);
}

// Legacy function for compatibility - now uses preloaded data
async function loadStocksData(): Promise<NasdaqStock[]> {
  return initializeStocksData();
}

// Public function to preload data at app startup
export function preloadStocksData(): Promise<NasdaqStock[]> {
  return initializeStocksData();
}

// Check if data is loaded and ready for instant search
export function isDataReady(): boolean {
  return stocksCache !== null && searchIndex !== null && symbolIndex !== null;
}

// Get loading status
export function getLoadingStatus(): { isLoading: boolean; isReady: boolean } {
  return {
    isLoading,
    isReady: isDataReady(),
  };
}

// Convert NASDAQ stock to search result format
function convertToSearchResult(stock: NasdaqStock): StockSearchResult {
  return {
    symbol: stock.Symbol,
    name: stock.Name,
    type: "stock",
    exchange: "NASDAQ",
    sector: stock.Sector,
    industry: stock.Industry,
    marketCap: stock["Market Cap"],
  };
}

// Fast autocomplete search using preloaded indexes
export function searchStocksAutocomplete(
  query: string,
  limit: number = 15
): Promise<StockSearchResult[]> {
  return new Promise((resolve) => {
    if (!query || query.trim().length === 0) {
      resolve(getPopularStocks().slice(0, limit));
      return;
    }

    // If data isn't loaded yet, return empty results for now
    if (!stocksCache || !searchIndex || !symbolIndex) {
      resolve([]);
      return;
    }

    const normalizedQuery = query.toUpperCase().trim();
    const results: StockSearchResult[] = [];
    const seen = new Set<string>();

    // 1. Exact symbol match (highest priority)
    const exactMatch = symbolIndex.get(normalizedQuery);
    if (exactMatch) {
      results.push(convertToSearchResult(exactMatch));
      seen.add(exactMatch.Symbol);
    }

    // 2. Symbol prefix matches using optimized index
    for (
      let prefixLength = normalizedQuery.length;
      prefixLength >= 1;
      prefixLength--
    ) {
      if (results.length >= limit) break;

      const prefix = normalizedQuery.substring(0, prefixLength);
      const candidateStocks = searchIndex.get(prefix) || [];

      candidateStocks.forEach((stock) => {
        if (results.length >= limit) return;
        if (seen.has(stock.Symbol)) return;

        if (stock.Symbol.toUpperCase().startsWith(normalizedQuery)) {
          results.push(convertToSearchResult(stock));
          seen.add(stock.Symbol);
        }
      });
    }

    // 3. Company name matches using word prefixes
    if (results.length < limit && normalizedQuery.length >= 2) {
      const namePrefix = normalizedQuery.substring(0, 2);
      const nameMatches = searchIndex.get(namePrefix) || [];

      nameMatches.forEach((stock) => {
        if (results.length >= limit) return;
        if (seen.has(stock.Symbol)) return;

        if (stock.Name.toUpperCase().includes(normalizedQuery)) {
          results.push(convertToSearchResult(stock));
          seen.add(stock.Symbol);
        }
      });
    }

    // Sort results by relevance (exact matches first, then by symbol length)
    results.sort((a, b) => {
      const aIsExact = a.symbol.toUpperCase() === normalizedQuery;
      const bIsExact = b.symbol.toUpperCase() === normalizedQuery;

      if (aIsExact && !bIsExact) return -1;
      if (!aIsExact && bIsExact) return 1;

      const aStartsWith = a.symbol.toUpperCase().startsWith(normalizedQuery);
      const bStartsWith = b.symbol.toUpperCase().startsWith(normalizedQuery);

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      return a.symbol.length - b.symbol.length;
    });

    resolve(results.slice(0, limit));
  });
}

// Get all stocks by sector
export async function getStocksBySector(
  sector: string
): Promise<StockSearchResult[]> {
  const stocks = await loadStocksData();
  return stocks
    .filter((stock) => stock.Sector.toLowerCase() === sector.toLowerCase())
    .map(convertToSearchResult)
    .slice(0, 50);
}

// Get all sectors
export async function getAllSectors(): Promise<string[]> {
  const stocks = await loadStocksData();
  const sectors = new Set<string>();
  stocks.forEach((stock) => {
    if (stock.Sector && stock.Sector !== "") {
      sectors.add(stock.Sector);
    }
  });
  return Array.from(sectors).sort();
}

// Get stock by symbol
export async function getStockBySymbol(
  symbol: string
): Promise<StockSearchResult | null> {
  const stocks = await loadStocksData();
  const stock = stocks.find(
    (s) => s.Symbol.toUpperCase() === symbol.toUpperCase()
  );
  return stock ? convertToSearchResult(stock) : null;
}

// Popular stocks for quick selection (fallback)
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
  { symbol: "V", name: "Visa Inc.", type: "stock", exchange: "NYSE" },
  {
    symbol: "JPM",
    name: "JPMorgan Chase & Co.",
    type: "stock",
    exchange: "NYSE",
  },
];

export function getPopularStocks(): StockSearchResult[] {
  return POPULAR_STOCKS;
}

// Advanced search with filters
export async function advancedStockSearch({
  query,
  sector,
  minMarketCap,
  maxMarketCap,
  limit = 20,
}: {
  query?: string;
  sector?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
  limit?: number;
}): Promise<StockSearchResult[]> {
  const stocks = await loadStocksData();
  let filteredStocks = stocks;

  // Apply filters
  if (sector) {
    filteredStocks = filteredStocks.filter(
      (stock) => stock.Sector.toLowerCase() === sector.toLowerCase()
    );
  }

  if (minMarketCap !== undefined) {
    filteredStocks = filteredStocks.filter(
      (stock) => stock["Market Cap"] >= minMarketCap
    );
  }

  if (maxMarketCap !== undefined) {
    filteredStocks = filteredStocks.filter(
      (stock) => stock["Market Cap"] <= maxMarketCap
    );
  }

  // Apply text search if provided
  if (query && query.trim().length > 0) {
    const normalizedQuery = query.toUpperCase().trim();
    filteredStocks = filteredStocks.filter(
      (stock) =>
        stock.Symbol.toUpperCase().includes(normalizedQuery) ||
        stock.Name.toUpperCase().includes(normalizedQuery)
    );
  }

  // Sort by market cap (largest first) and then by symbol
  filteredStocks.sort((a, b) => {
    if (a["Market Cap"] !== b["Market Cap"]) {
      return b["Market Cap"] - a["Market Cap"];
    }
    return a.Symbol.localeCompare(b.Symbol);
  });

  return filteredStocks.slice(0, limit).map(convertToSearchResult);
}
