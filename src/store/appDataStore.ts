import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { plaidIntegrationService } from "../shared/services/plaidIntegration";
import { plaidPortfolioService } from "../shared/services/portfolioAggregationService";
import { MockDataInitializer } from "../shared/services/mockDataInitializer";
import { fetchAndCacheBulkQuotes } from "../shared/services/quotes";
import { useUserStore } from "./userStore";

// Import mock data for immediate hydration (portfolio data only)
import mockAccountsData from "../shared/data/mockPlaidAccounts.json";
import mockHoldingsData from "../shared/data/mockPlaidHoldings.json";
import mockPortfolioHistory from "../shared/data/mockPortfolioHistory.json";

// Import real API services for market data
import { generateMarketOverviewWithData } from "../shared/services/marketOverview";
import { fetchGeneralMarketNews } from "../shared/services/newsProviders";

// Types
export interface Account {
  id: string;
  provider: string;
  accountName: string;
  accountType: string;
  category: string;
  balance: number;
  dayChange: number;
  dayChangePercent: number;
  lastSync: string;
  isConnected: boolean;
}

export interface Position {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  provider: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  topGainer: Position | null;
  topLoser: Position | null;
  positionCount: number;
  connectedAccounts: number;
}

export interface HistoricalDataPoint {
  date: string;
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  positions: Record<string, number>; // symbol -> market value
}

export interface PortfolioHistory {
  data: HistoricalDataPoint[];
  period: "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";
  startValue: number;
  endValue: number;
  totalReturn: number;
  totalReturnPercent: number;
}

// Import types from services to ensure consistency
import type {
  NewsItem,
  TrendingStock,
  MarketEvent,
} from "../shared/services/newsProviders";
import type { MarketOverview } from "../shared/services/marketOverview";

type Timeframe = "1D" | "1W" | "1M";

export interface AppDataState {
  // Data
  accounts: Account[];
  positions: Position[];
  portfolioSummary: PortfolioSummary;
  portfolioHistory: Record<string, PortfolioHistory>;
  marketOverview: Record<Timeframe, MarketOverview>;
  news: NewsItem[];

  // Status
  isHydrated: boolean;
  lastRefresh: Date | null;
  isRefreshing: boolean;

  // Actions
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshInBackground: () => void;
  getPortfolioHistory: (
    period: "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL"
  ) => PortfolioHistory;
  getAccountsByCategory: (category?: string) => Account[];
  getAccountCategories: () => string[];
  getMarketOverview: (timeframe: Timeframe) => MarketOverview | null;
  getSentimentSummary: () => {
    overall: "bullish" | "bearish" | "neutral";
    confidence: number;
  } | null;
  getNewsSentimentCounts: () => {
    positive: number;
    negative: number;
    neutral: number;
  };
}

// Helper functions
const getProviderFromAccountName = (accountName: string): string => {
  const name = accountName.toLowerCase();
  if (name.includes("chase")) return "Chase";
  if (name.includes("schwab")) return "Schwab";
  if (name.includes("fidelity")) return "Fidelity";
  if (name.includes("robinhood")) return "Robinhood";
  if (name.includes("vanguard")) return "Vanguard";
  if (name.includes("webull")) return "Webull";
  if (name.includes("td ameritrade")) return "TD Ameritrade";
  if (name.includes("etrade")) return "E*TRADE";
  return "Plaid";
};

const getAccountCategory = (type: string, subtype?: string): string => {
  const accountType = (subtype || type).toLowerCase();

  // Investment accounts
  if (
    [
      "investment",
      "brokerage",
      "ira",
      "401k",
      "403b",
      "457b",
      "529",
      "roth",
      "rollover",
      "sep",
      "simple",
      "sarsep",
      "profit sharing plan",
      "stock plan",
      "pension",
      "defined benefit",
      "defined contribution",
    ].includes(accountType)
  ) {
    return "Investment";
  }

  // Banking accounts
  if (
    [
      "depository",
      "checking",
      "savings",
      "money market",
      "cd",
      "treasury",
      "sweep",
    ].includes(accountType)
  ) {
    return "Banking";
  }

  // Credit accounts
  if (["credit", "credit card", "paypal"].includes(accountType)) {
    return "Credit";
  }

  // Loan accounts
  if (
    [
      "loan",
      "mortgage",
      "home equity",
      "line of credit",
      "auto",
      "business",
      "commercial",
      "construction",
      "consumer",
      "home equity line of credit",
      "overdraft",
      "student",
    ].includes(accountType)
  ) {
    return "Loans";
  }

  return "Other";
};

// Collect all unique symbols from all watchlists (and legacy fields)
const getAllWatchlistSymbols = (): string[] => {
  try {
    const { profile } = useUserStore.getState();
    const unique = new Set<string>();

    // Legacy single watchlist array
    if (Array.isArray(profile.watchlist)) {
      profile.watchlist.forEach(
        (s) => s && unique.add(String(s).toUpperCase())
      );
    }

    // New multi-watchlist structure
    if (Array.isArray(profile.watchlists)) {
      for (const wl of profile.watchlists) {
        for (const item of wl.items || []) {
          if (item?.symbol) unique.add(String(item.symbol).toUpperCase());
        }
      }
    }

    // Include global favorites to ensure they refresh as well
    if (Array.isArray(profile.favorites)) {
      profile.favorites.forEach(
        (s) => s && unique.add(String(s).toUpperCase())
      );
    }

    return Array.from(unique);
  } catch (err) {
    console.warn("⚠️ Failed to collect watchlist symbols:", err);
    return [];
  }
};

// Prefetch quotes in safe chunks and cache them for immediate use by all watchlists
const prefetchWatchlistQuotes = async (symbols: string[]): Promise<void> => {
  if (!symbols || symbols.length === 0) return;
  const CHUNK_SIZE = 150; // avoid URL length limits
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    try {
      await fetchAndCacheBulkQuotes(chunk);
    } catch (e) {
      // console.error("❌ Watchlist quotes fetch failed for chunk:", e);
    }
  }
};

const formatAccountType = (type: string, subtype?: string): string => {
  const typeMap: { [key: string]: string } = {
    // Investment accounts
    investment: "Investment Account",
    brokerage: "Brokerage Account",
    ira: "IRA",
    "401k": "401(k)",
    "403b": "403(b)",
    "457b": "457(b)",
    "529": "529 Education",
    roth: "Roth IRA",
    rollover: "Rollover IRA",
    sep: "SEP IRA",
    simple: "SIMPLE IRA",
    sarsep: "SARSEP",
    "profit sharing plan": "Profit Sharing",
    "stock plan": "Stock Plan",
    pension: "Pension",
    "defined benefit": "Defined Benefit",
    "defined contribution": "Defined Contribution",

    // Banking accounts
    depository: "Bank Account",
    checking: "Checking Account",
    savings: "Savings Account",
    "money market": "Money Market",
    cd: "Certificate of Deposit",
    treasury: "Treasury Account",
    sweep: "Sweep Account",

    // Credit accounts
    credit: "Credit Card",
    "credit card": "Credit Card",
    paypal: "PayPal",

    // Loan accounts
    loan: "Loan",
    mortgage: "Mortgage",
    "home equity": "Home Equity",
    "line of credit": "Line of Credit",
    auto: "Auto Loan",
    business: "Business Loan",
    commercial: "Commercial Loan",
    construction: "Construction Loan",
    consumer: "Consumer Loan",
    "home equity line of credit": "HELOC",
    overdraft: "Overdraft",
    student: "Student Loan",
  };

  const accountType = subtype || type;
  return (
    typeMap[accountType.toLowerCase()] ||
    typeMap[type.toLowerCase()] ||
    accountType.charAt(0).toUpperCase() + accountType.slice(1)
  );
};

// Fetch real market data from APIs
const fetchRealMarketData = async (): Promise<{
  marketOverview: Record<Timeframe, MarketOverview>;
  news: NewsItem[];
}> => {
  console.log("🔄 Fetching real market data from APIs...");

  try {
    // Fetch only 1D overview on background hydrate to reduce AI/API calls
    const [overview1D] = await Promise.all([
      generateMarketOverviewWithData({
        timeframe: "1D",
        analysisDepth: "brief",
      }),
    ]);

    const marketOverview: Record<Timeframe, MarketOverview> = {
      "1D": overview1D.overview,
      // Defer 1W/1M generation to on-demand views
      "1W": overview1D.overview,
      "1M": overview1D.overview,
    };

    const news = overview1D.rawData.news;

    console.log("✅ Successfully fetched real market data (1D only)");
    return { marketOverview, news };
  } catch (error) {
    console.error("❌ Failed to fetch real market data:", error);

    // Return minimal fallback data
    const fallbackOverview: MarketOverview = {
      summary: "Market data temporarily unavailable. Please check back later.",
      keyHighlights: ["Market data service temporarily unavailable"],
      topStories: [],
      trendingStocks: [],
      upcomingEvents: [],
      fedEvents: [],
      economicIndicators: [],
      lastUpdated: new Date().toISOString(),
    };

    return {
      marketOverview: {
        "1D": fallbackOverview,
        "1W": fallbackOverview,
        "1M": fallbackOverview,
      },
      news: [],
    };
  }
};

// Create immediate mock data for hydration (portfolio data only)
const createInitialMockData = () => {
  // Transform mock accounts
  const accounts: Account[] = mockAccountsData.accounts.map((account) => {
    const isInvestmentAccount = account.type === "investment";
    const mockDayChange = isInvestmentAccount
      ? (account.balances.current || 0) * (Math.random() * 0.04 - 0.02)
      : 0;
    const mockDayChangePercent =
      isInvestmentAccount && account.balances.current
        ? (mockDayChange / account.balances.current) * 100
        : 0;

    return {
      id: account.account_id,
      provider: getProviderFromAccountName(account.name),
      accountName: account.name,
      accountType: formatAccountType(account.type, account.subtype),
      category: getAccountCategory(account.type, account.subtype),
      balance: account.balances.current || 0,
      dayChange: mockDayChange,
      dayChangePercent: mockDayChangePercent,
      lastSync: new Date().toISOString(),
      isConnected: true,
    };
  });

  // Transform mock positions
  const securityMap = new Map(
    mockHoldingsData.securities.map((sec) => [sec.security_id, sec])
  );

  const positions: Position[] = mockHoldingsData.holdings.map((holding) => {
    const security = securityMap.get(holding.security_id);
    const currentPrice = holding.institution_price;
    const quantity = holding.quantity;
    const marketValue = holding.institution_value;
    const costBasis = holding.cost_basis || 0;
    const averageCost = quantity > 0 ? costBasis / quantity : 0;
    const unrealizedPnL = marketValue - costBasis;
    const unrealizedPnLPercent =
      costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

    return {
      symbol: security?.ticker_symbol || "UNKNOWN",
      name: security?.name || "Unknown Security",
      quantity,
      averageCost,
      currentPrice,
      marketValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      provider: getProviderFromAccountName(
        accounts.find((acc) => acc.id === holding.account_id)?.accountName || ""
      ),
    };
  });

  // Calculate portfolio summary
  const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
  const totalCost = positions.reduce(
    (sum, pos) => sum + pos.averageCost * pos.quantity,
    0
  );
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent =
    totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  const sortedByPercent = [...positions].sort(
    (a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent
  );
  const topGainer = sortedByPercent[0] || null;
  const topLoser = sortedByPercent[sortedByPercent.length - 1] || null;

  const dayChange = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  const dayChangePercent =
    totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;

  const portfolioSummary: PortfolioSummary = {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    dayChange,
    dayChangePercent,
    topGainer,
    topLoser,
    positionCount: positions.length,
    connectedAccounts: accounts.filter((acc) => acc.category === "Investment")
      .length,
  };

  // Transform portfolio history
  const portfolioHistory: Record<string, PortfolioHistory> = {};
  Object.entries(mockPortfolioHistory).forEach(([period, data]) => {
    const historyData = data as any[];
    const firstValue = historyData[0]?.totalValue || 0;
    const lastValue = historyData[historyData.length - 1]?.totalValue || 0;
    const totalReturn = lastValue - firstValue;
    const totalReturnPercent =
      firstValue > 0 ? (totalReturn / firstValue) * 100 : 0;

    portfolioHistory[period] = {
      data: historyData.map((point) => ({
        date: point.date,
        totalValue: point.totalValue,
        dayChange: point.dayChange || 0,
        dayChangePercent: point.dayChangePercent || 0,
        positions: {},
      })),
      period: period as any,
      startValue: firstValue,
      endValue: lastValue,
      totalReturn,
      totalReturnPercent,
    };
  });

  // Return only portfolio data - market data will be fetched from APIs
  return {
    accounts,
    positions,
    portfolioSummary,
    portfolioHistory,
  };
};

// Create the store
export const useAppDataStore = create<AppDataState>()(
  persist(
    (set, get) => ({
      // Initial state with mock portfolio data and empty market data
      ...createInitialMockData(),
      marketOverview: {} as Record<Timeframe, MarketOverview>,
      news: [] as NewsItem[],
      isHydrated: false,
      lastRefresh: null,
      isRefreshing: false,

      // Hydrate store with fresh data
      hydrate: async () => {
        console.log("🔄 Hydrating app data store...");

        try {
          // Initialize mock portfolio data
          await MockDataInitializer.initialize();
          const portfolioData = createInitialMockData();

          // Set portfolio data immediately for instant access
          set({
            ...portfolioData,
            isHydrated: true,
            lastRefresh: new Date(),
          });

          console.log("✅ Portfolio data hydrated immediately");

          // Fetch real market data in background
          fetchRealMarketData()
            .then(({ marketOverview, news }) => {
              set((state) => ({
                ...state,
                marketOverview,
                news,
                lastRefresh: new Date(),
              }));
              console.log("✅ Market data loaded in background");
            })
            .catch((error) => {
              console.error("❌ Background market data fetch failed:", error);
            });

          // In parallel, prefetch and cache watchlist quotes across all watchlists
          const allSymbols = getAllWatchlistSymbols();
          prefetchWatchlistQuotes(allSymbols)
            .then(() =>
              console.log("✅ Prefetched watchlist quotes in background")
            )
            .catch((e) =>
              console.error("❌ Failed to prefetch watchlist quotes:", e)
            );
        } catch (error) {
          console.error("❌ Failed to hydrate app data store:", error);
          // Keep existing data if hydration fails
          set({
            isHydrated: true,
            lastRefresh: new Date(),
          });
        }
      },

      // Refresh data (background or manual)
      refresh: async () => {
        const state = get();
        if (state.isRefreshing) return;

        console.log("🔄 Refreshing app data...");
        set({ isRefreshing: true });

        try {
          // Refresh portfolio data (mock for now)
          const portfolioData = createInitialMockData();

          // Start watchlist quotes prefetch in parallel
          const allSymbols = getAllWatchlistSymbols();
          prefetchWatchlistQuotes(allSymbols).catch((e) =>
            console.error(
              "❌ Watchlist quotes prefetch during refresh failed:",
              e
            )
          );

          // Fetch fresh market data from APIs
          const { marketOverview, news } = await fetchRealMarketData();

          set({
            ...portfolioData,
            marketOverview,
            news,
            lastRefresh: new Date(),
            isRefreshing: false,
          });

          console.log("✅ App data refreshed successfully");
        } catch (error) {
          console.error("❌ Failed to refresh app data:", error);
          set({ isRefreshing: false });
        }
      },

      // Background refresh (non-blocking)
      refreshInBackground: () => {
        const { refresh } = get();
        // Don't await - let it run in background
        refresh().catch(console.error);
      },

      // Get portfolio history for specific period
      getPortfolioHistory: (period) => {
        const { portfolioHistory } = get();
        return (
          portfolioHistory[period] || {
            data: [] as HistoricalDataPoint[],
            period,
            startValue: 0,
            endValue: 0,
            totalReturn: 0,
            totalReturnPercent: 0,
          }
        );
      },

      // Get accounts by category
      getAccountsByCategory: (category) => {
        const { accounts } = get();
        if (!category || category === "All") {
          return accounts;
        }
        return accounts.filter((account) => account.category === category);
      },

      // Get unique account categories
      getAccountCategories: () => {
        const { accounts } = get();
        const categories = ["All"];
        const uniqueCategories = [
          ...new Set(accounts.map((account) => account.category)),
        ];
        return [...categories, ...uniqueCategories.sort()];
      },

      // Get market overview for specific timeframe
      getMarketOverview: (timeframe) => {
        const { marketOverview } = get();
        return marketOverview[timeframe] || null;
      },

      // Get sentiment summary from market data
      getSentimentSummary: () => {
        const { marketOverview, news } = get();

        // Try to get sentiment from market overview first
        const overview =
          marketOverview["1D"] || marketOverview["1W"] || marketOverview["1M"];
        if (overview?.marketSentiment) {
          // Convert API format to our format
          return {
            overall: overview.marketSentiment.overall,
            confidence: overview.marketSentiment.confidence,
          };
        }

        // Fallback to news sentiment calculation
        if (!news || news.length === 0) return null;

        let positive = 0;
        let negative = 0;
        let neutral = 0;

        for (const item of news) {
          const sentiment = (item.sentiment || "").toLowerCase();
          if (sentiment === "positive") positive++;
          else if (sentiment === "negative") negative++;
          else neutral++;
        }

        const total = positive + negative + neutral;
        if (total === 0) return null;

        const pos = positive / total;
        const neg = negative / total;

        let overall: "bullish" | "bearish" | "neutral";
        let confidence: number;

        if (pos > 0.6) {
          overall = "bullish";
          confidence = Math.round(pos * 100);
        } else if (neg > 0.6) {
          overall = "bearish";
          confidence = Math.round(neg * 100);
        } else {
          overall = "neutral";
          confidence = Math.round(Math.max(pos, neg) * 100);
        }

        return { overall, confidence };
      },

      // Get news sentiment counts
      getNewsSentimentCounts: () => {
        const { news } = get();
        let positive = 0;
        let negative = 0;
        let neutral = 0;

        for (const item of news) {
          const sentiment = (item.sentiment || "").toLowerCase();
          if (sentiment === "positive") positive++;
          else if (sentiment === "negative") negative++;
          else neutral++;
        }

        return { positive, negative, neutral };
      },
    }),
    {
      name: "app-data-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist essential data, not computed values
      partialize: (state) => ({
        accounts: state.accounts,
        positions: state.positions,
        portfolioSummary: state.portfolioSummary,
        portfolioHistory: state.portfolioHistory,
        marketOverview: state.marketOverview,
        news: state.news,
        lastRefresh: state.lastRefresh,
      }),
    }
  )
);

// Auto-refresh mechanism
let refreshInterval: NodeJS.Timeout | null = null;

export const startBackgroundRefresh = () => {
  if (refreshInterval) return;

  console.log("🔄 Starting background refresh (every 5 minutes)");

  // Refresh every 5 minutes
  refreshInterval = setInterval(() => {
    const store = useAppDataStore.getState();
    store.refreshInBackground();
  }, 5 * 60 * 1000);
};

export const stopBackgroundRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log("⏹️ Stopped background refresh");
  }
};

// Watchlist quotes auto-refresh (more frequent than full refresh)
let watchlistQuotesInterval: NodeJS.Timeout | null = null;
let watchlistQuotesFrequencyMs = 5000; // default 5s

export const startWatchlistQuotesAutoRefresh = (frequencyMs?: number) => {
  if (typeof frequencyMs === "number" && frequencyMs > 0) {
    watchlistQuotesFrequencyMs = frequencyMs;
  }

  if (watchlistQuotesInterval) {
    clearInterval(watchlistQuotesInterval);
    watchlistQuotesInterval = null;
  }

  console.log(
    `🔄 Starting watchlist quotes auto-refresh (every ${Math.round(
      watchlistQuotesFrequencyMs / 1000
    )}s)`
  );

  watchlistQuotesInterval = setInterval(() => {
    const symbols = getAllWatchlistSymbols();
    prefetchWatchlistQuotes(symbols).catch((e) =>
      console.error("❌ Watchlist quotes auto-refresh failed:", e)
    );
  }, watchlistQuotesFrequencyMs);
};

export const stopWatchlistQuotesAutoRefresh = () => {
  if (watchlistQuotesInterval) {
    clearInterval(watchlistQuotesInterval);
    watchlistQuotesInterval = null;
    console.log("⏹️ Stopped watchlist quotes auto-refresh");
  }
};

export const setWatchlistQuotesFrequency = (ms: number) => {
  if (!ms || ms <= 0) return;
  watchlistQuotesFrequencyMs = ms;
  // restart with new frequency
  startWatchlistQuotesAutoRefresh(ms);
};

// Initialize store on app start
export const initializeAppDataStore = async () => {
  console.log("🚀 Initializing app data store...");

  const store = useAppDataStore.getState();

  // Hydrate with fresh data
  await store.hydrate();

  // Start background refresh
  startBackgroundRefresh();

  // Start frequent watchlist quotes auto-refresh so UI can read fresh cache
  startWatchlistQuotesAutoRefresh();

  console.log("✅ App data store initialized");
};
