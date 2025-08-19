import AsyncStorage from "@react-native-async-storage/async-storage";
import { plaidIntegrationService } from "./plaidIntegration";

// Simplified portfolio interfaces using Plaid data
export interface PortfolioPosition {
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
  topGainer: PortfolioPosition | null;
  topLoser: PortfolioPosition | null;
  positionCount: number;
  connectedAccounts: number;
}

export interface PortfolioHistory {
  period: "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";
  data: Array<{
    date: string;
    totalValue: number;
  }>;
  totalReturn: number;
  totalReturnPercent: number;
}

class PlaidPortfolioService {
  private readonly HISTORY_STORAGE_KEY = "portfolio_history";
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  // Get current portfolio summary from all connected Plaid accounts
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const cacheKey = "portfolio_summary";
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const positions = await this.getAllPositions();
      const summary = this.calculatePortfolioSummary(positions);

      // Cache the result
      this.cache.set(cacheKey, { data: summary, timestamp: Date.now() });

      // Store historical data point
      await this.storeHistoricalDataPoint(summary);

      return summary;
    } catch (error) {
      console.error("Failed to get portfolio summary:", error);
      return this.getEmptyPortfolio();
    }
  }

  // Get all positions from all connected Plaid accounts
  async getAllPositions(): Promise<PortfolioPosition[]> {
    const tokens = plaidIntegrationService.getStoredTokens();
    const allPositions: PortfolioPosition[] = [];

    for (const token of tokens) {
      try {
        const { holdings, securities } =
          await plaidIntegrationService.getHoldings(token);
        const positions = plaidIntegrationService.convertToPortfolioPositions(
          holdings,
          securities
        );
        allPositions.push(...positions);
      } catch (error) {
        console.error("Failed to fetch positions from Plaid:", error);
      }
    }

    return this.aggregatePositions(allPositions);
  }

  // Aggregate positions with the same symbol
  private aggregatePositions(
    positions: PortfolioPosition[]
  ): PortfolioPosition[] {
    const positionMap = new Map<string, PortfolioPosition>();

    positions.forEach((position) => {
      const existing = positionMap.get(position.symbol);

      if (existing) {
        // Combine positions
        const newQuantity = existing.quantity + position.quantity;
        const newTotalCost =
          existing.averageCost * existing.quantity +
          position.averageCost * position.quantity;
        const newAverageCost = newQuantity > 0 ? newTotalCost / newQuantity : 0;
        const newMarketValue = existing.marketValue + position.marketValue;
        const newUnrealizedPnL = newMarketValue - newTotalCost;
        const newUnrealizedPnLPercent =
          newTotalCost > 0 ? (newUnrealizedPnL / newTotalCost) * 100 : 0;

        positionMap.set(position.symbol, {
          ...existing,
          quantity: newQuantity,
          averageCost: newAverageCost,
          marketValue: newMarketValue,
          unrealizedPnL: newUnrealizedPnL,
          unrealizedPnLPercent: newUnrealizedPnLPercent,
          provider: `${existing.provider}, ${position.provider}`,
        });
      } else {
        positionMap.set(position.symbol, { ...position });
      }
    });

    return Array.from(positionMap.values());
  }

  // Calculate portfolio summary from positions
  private calculatePortfolioSummary(
    positions: PortfolioPosition[]
  ): PortfolioSummary {
    const totalValue = positions.reduce((sum, pos) => {
      const value = Number.isFinite(pos.marketValue) ? pos.marketValue : 0;
      return sum + value;
    }, 0);

    const totalCost = positions.reduce((sum, pos) => {
      const cost = Number.isFinite(pos.averageCost * pos.quantity)
        ? pos.averageCost * pos.quantity
        : 0;
      return sum + cost;
    }, 0);

    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercent =
      totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    // Find top gainer and loser
    const sortedByPercent = [...positions].sort(
      (a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent
    );
    const topGainer = sortedByPercent[0] || null;
    const topLoser = sortedByPercent[sortedByPercent.length - 1] || null;

    // Day change (using unrealized P&L as approximation)
    const dayChange = positions.reduce((sum, pos) => {
      const pnl = Number.isFinite(pos.unrealizedPnL) ? pos.unrealizedPnL : 0;
      return sum + pnl;
    }, 0);
    const dayChangePercent =
      totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;

    const tokens = plaidIntegrationService.getStoredTokens();

    return {
      totalValue,
      totalCost,
      totalGainLoss,
      totalGainLossPercent,
      dayChange,
      dayChangePercent,
      topGainer,
      topLoser,
      positionCount: positions.length,
      connectedAccounts: tokens.length,
    };
  }

  // Get portfolio history for different time periods
  async getPortfolioHistory(
    period: "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL"
  ): Promise<PortfolioHistory> {
    try {
      const stored = await AsyncStorage.getItem(this.HISTORY_STORAGE_KEY);
      const history = stored ? JSON.parse(stored) : [];

      // Filter data based on period
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case "1D":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "1W":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "1M":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "3M":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "1Y":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0); // All time
      }

      const filteredData = history.filter(
        (point: any) => new Date(point.date) >= startDate
      );

      // Calculate returns
      const firstValue = filteredData[0]?.totalValue || 0;
      const lastValue = filteredData[filteredData.length - 1]?.totalValue || 0;
      const totalReturn = lastValue - firstValue;
      const totalReturnPercent =
        firstValue > 0 ? (totalReturn / firstValue) * 100 : 0;

      return {
        period,
        data: filteredData,
        totalReturn,
        totalReturnPercent,
      };
    } catch (error) {
      console.error("Failed to get portfolio history:", error);
      return {
        period,
        data: [],
        totalReturn: 0,
        totalReturnPercent: 0,
      };
    }
  }

  // Store a historical data point
  private async storeHistoricalDataPoint(
    summary: PortfolioSummary
  ): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.HISTORY_STORAGE_KEY);
      const history = stored ? JSON.parse(stored) : [];

      const today = new Date().toISOString().split("T")[0];
      const existingIndex = history.findIndex((point: any) =>
        point.date.startsWith(today)
      );

      const dataPoint = {
        date: new Date().toISOString(),
        totalValue: summary.totalValue,
      };

      if (existingIndex >= 0) {
        // Update existing point for today
        history[existingIndex] = dataPoint;
      } else {
        // Add new point
        history.push(dataPoint);
      }

      // Keep only last 2 years of data
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const filteredHistory = history.filter(
        (point: any) => new Date(point.date) >= twoYearsAgo
      );

      await AsyncStorage.setItem(
        this.HISTORY_STORAGE_KEY,
        JSON.stringify(filteredHistory)
      );
    } catch (error) {
      console.error("Failed to store historical data point:", error);
    }
  }

  // Get empty portfolio for error states
  private getEmptyPortfolio(): PortfolioSummary {
    return {
      totalValue: 0,
      totalCost: 0,
      totalGainLoss: 0,
      totalGainLossPercent: 0,
      dayChange: 0,
      dayChangePercent: 0,
      topGainer: null,
      topLoser: null,
      positionCount: 0,
      connectedAccounts: 0,
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get account information
  async getAccountInfo(): Promise<
    Array<{
      id: string;
      name: string;
      type: string;
      balance: number;
      lastSync: string;
    }>
  > {
    const tokens = plaidIntegrationService.getStoredTokens();
    const accounts: Array<{
      id: string;
      name: string;
      type: string;
      balance: number;
      lastSync: string;
    }> = [];

    for (const token of tokens) {
      try {
        const plaidAccounts = await plaidIntegrationService.getAccounts(token);
        const investmentAccounts = plaidAccounts.filter(
          (acc) => acc.type === "investment"
        );

        investmentAccounts.forEach((acc) => {
          accounts.push({
            id: acc.account_id,
            name: acc.name,
            type: acc.type,
            balance: acc.balances.current || 0,
            lastSync: new Date().toISOString(),
          });
        });
      } catch (error) {
        console.error("Failed to get account info:", error);
      }
    }

    return accounts;
  }
}

export const plaidPortfolioService = new PlaidPortfolioService();
