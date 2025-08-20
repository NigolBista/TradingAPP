import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { plaidIntegrationService } from "../services/plaidIntegration";
import { plaidPortfolioService } from "../services/portfolioAggregationService_NEW";
import { MockDataInitializer } from "../services/mockDataInitializer";

// Import mock data for immediate hydration
import mockAccountsData from "../data/mockPlaidAccounts.json";
import mockHoldingsData from "../data/mockPlaidHoldings.json";
import mockPortfolioHistory from "../data/mockPortfolioHistory.json";

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
  lastSync: Date;
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

export interface AppDataState {
  // Data
  accounts: Account[];
  positions: Position[];
  portfolioSummary: PortfolioSummary;
  portfolioHistory: Record<string, PortfolioHistory>;

  // Status
  isHydrated: boolean;
  lastRefresh: Date | null;
  isRefreshing: boolean;

  // Actions
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshInBackground: () => void;
  getPortfolioHistory: (
    period: "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL"
  ) => PortfolioHistory;
  getAccountsByCategory: (category?: string) => Account[];
  getAccountCategories: () => string[];
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

// Create immediate mock data for hydration
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
      lastSync: new Date(),
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
      // Initial state with mock data for immediate hydration
      ...createInitialMockData(),
      isHydrated: false,
      lastRefresh: null,
      isRefreshing: false,

      // Hydrate store with fresh data
      hydrate: async () => {
        console.log("🔄 Hydrating app data store...");

        try {
          // Initialize mock data
          await MockDataInitializer.initialize();

          // Get fresh data (which will be mock data in our case)
          const mockData = createInitialMockData();

          set({
            ...mockData,
            isHydrated: true,
            lastRefresh: new Date(),
          });

          console.log("✅ App data store hydrated successfully");
        } catch (error) {
          console.error("❌ Failed to hydrate app data store:", error);
          // Keep existing mock data if hydration fails
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
          // In a real app, this would fetch fresh data from APIs
          // For now, we'll regenerate mock data with slight variations
          const mockData = createInitialMockData();

          set({
            ...mockData,
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

// Initialize store on app start
export const initializeAppDataStore = async () => {
  console.log("🚀 Initializing app data store...");

  const store = useAppDataStore.getState();

  // Hydrate with fresh data
  await store.hydrate();

  // Start background refresh
  startBackgroundRefresh();

  console.log("✅ App data store initialized");
};
