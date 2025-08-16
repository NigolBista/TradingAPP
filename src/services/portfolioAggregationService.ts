import {
  brokerageApiService,
  BrokeragePosition,
  BrokerageWatchlistItem,
} from "./brokerageApiService";
import { brokerageAuthService, BrokerageProvider } from "./brokerageAuth";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AggregatedPosition {
  symbol: string;
  totalQuantity: number;
  totalMarketValue: number;
  totalCost: number;
  averagePrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  providers: {
    provider: BrokerageProvider;
    quantity: number;
    marketValue: number;
    cost: number;
    price: number;
  }[];
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  topGainer: AggregatedPosition | null;
  topLoser: AggregatedPosition | null;
  positionsCount: number;
  providersConnected: BrokerageProvider[];
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

class PortfolioAggregationService {
  private readonly STORAGE_KEY = "portfolio_history";
  private readonly WATCHLIST_CACHE_KEY = "watchlist_cache";
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly WATCHLIST_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for watchlist
  private portfolioCache: { data: PortfolioSummary; timestamp: number } | null =
    null;
  private watchlistCache: {
    data: BrokerageWatchlistItem[];
    timestamp: number;
  } | null = null;

  // Get aggregated portfolio summary
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    // Check cache first
    if (
      this.portfolioCache &&
      Date.now() - this.portfolioCache.timestamp < this.CACHE_TTL
    ) {
      return this.portfolioCache.data;
    }

    try {
      const activeSessions = brokerageAuthService.getActiveSessions();

      if (activeSessions.length === 0) {
        return this.getEmptyPortfolio();
      }

      // Fetch positions from all connected accounts
      const allPositions: (BrokeragePosition & {
        provider: BrokerageProvider;
      })[] = [];

      for (const provider of activeSessions) {
        try {
          const positions = await brokerageApiService.getPositions(provider);
          allPositions.push(...positions.map((pos) => ({ ...pos, provider })));
        } catch (error) {
          console.warn(`Failed to fetch positions from ${provider}:`, error);
        }
      }

      // Aggregate positions by symbol
      const aggregatedPositions = this.aggregatePositions(allPositions);

      // Calculate portfolio summary
      const summary = this.calculatePortfolioSummary(
        aggregatedPositions,
        activeSessions
      );

      // Cache the result
      this.portfolioCache = { data: summary, timestamp: Date.now() };

      // Store historical data point
      await this.storeHistoricalDataPoint(summary);

      return summary;
    } catch (error) {
      console.error("Failed to get portfolio summary:", error);
      return this.getEmptyPortfolio();
    }
  }

  // Aggregate positions from multiple providers
  private aggregatePositions(
    positions: (BrokeragePosition & { provider: BrokerageProvider })[]
  ): AggregatedPosition[] {
    const positionMap = new Map<string, AggregatedPosition>();

    positions.forEach((position) => {
      const {
        symbol,
        quantity,
        averageCost,
        currentPrice,
        marketValue,
        unrealizedPnL,
        provider,
      } = position;

      if (positionMap.has(symbol)) {
        const existing = positionMap.get(symbol)!;

        // Add to existing position
        const newTotalQuantity = existing.totalQuantity + quantity;
        const newTotalCost = existing.totalCost + quantity * averageCost;
        const newTotalMarketValue = existing.totalMarketValue + marketValue;

        existing.totalQuantity = newTotalQuantity;
        existing.totalCost = newTotalCost;
        existing.totalMarketValue = newTotalMarketValue;
        existing.averagePrice = newTotalCost / newTotalQuantity;
        existing.unrealizedPnL = newTotalMarketValue - newTotalCost;
        existing.unrealizedPnLPercent =
          ((newTotalMarketValue - newTotalCost) / newTotalCost) * 100;

        existing.providers.push({
          provider,
          quantity,
          marketValue,
          cost: quantity * averageCost,
          price: currentPrice,
        });
      } else {
        // Create new aggregated position
        positionMap.set(symbol, {
          symbol,
          totalQuantity: quantity,
          totalMarketValue: marketValue,
          totalCost: quantity * averageCost,
          averagePrice: averageCost,
          unrealizedPnL,
          unrealizedPnLPercent:
            ((marketValue - quantity * averageCost) /
              (quantity * averageCost)) *
            100,
          providers: [
            {
              provider,
              quantity,
              marketValue,
              cost: quantity * averageCost,
              price: currentPrice,
            },
          ],
        });
      }
    });

    return Array.from(positionMap.values());
  }

  // Calculate portfolio summary from aggregated positions
  private calculatePortfolioSummary(
    positions: AggregatedPosition[],
    providers: BrokerageProvider[]
  ): PortfolioSummary {
    const totalValue = positions.reduce(
      (sum, pos) => sum + pos.totalMarketValue,
      0
    );
    const totalCost = positions.reduce((sum, pos) => sum + pos.totalCost, 0);
    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercent =
      totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    // Find top gainer and loser
    const sortedByPercent = [...positions].sort(
      (a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent
    );
    const topGainer = sortedByPercent[0] || null;
    const topLoser = sortedByPercent[sortedByPercent.length - 1] || null;

    // Calculate day change (this would need real-time data, for now using unrealized P&L as approximation)
    const dayChange = positions.reduce(
      (sum, pos) => sum + pos.unrealizedPnL,
      0
    );
    const dayChangePercent =
      totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalGainLoss,
      totalGainLossPercent,
      dayChange,
      dayChangePercent,
      topGainer:
        topGainer && topGainer.unrealizedPnLPercent > 0 ? topGainer : null,
      topLoser: topLoser && topLoser.unrealizedPnLPercent < 0 ? topLoser : null,
      positionsCount: positions.length,
      providersConnected: providers,
    };
  }

  // Get empty portfolio for when no accounts are connected
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
      positionsCount: 0,
      providersConnected: [],
    };
  }

  // Get detailed positions breakdown
  async getDetailedPositions(): Promise<AggregatedPosition[]> {
    const activeSessions = brokerageAuthService.getActiveSessions();
    const allPositions: (BrokeragePosition & {
      provider: BrokerageProvider;
    })[] = [];

    for (const provider of activeSessions) {
      try {
        const positions = await brokerageApiService.getPositions(provider);
        allPositions.push(...positions.map((pos) => ({ ...pos, provider })));
      } catch (error) {
        console.warn(`Failed to fetch positions from ${provider}:`, error);
      }
    }

    return this.aggregatePositions(allPositions);
  }

  // Store historical data point
  private async storeHistoricalDataPoint(
    summary: PortfolioSummary
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split("T")[0];
      const existingData = await this.getStoredHistory();

      const newDataPoint: HistoricalDataPoint = {
        date: today,
        totalValue: summary.totalValue,
        dayChange: summary.dayChange,
        dayChangePercent: summary.dayChangePercent,
        positions: {}, // Would need individual position values
      };

      // Remove existing data for today and add new point
      const filteredData = existingData.filter((point) => point.date !== today);
      filteredData.push(newDataPoint);

      // Keep only last 365 days
      const sortedData = filteredData
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-365);

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(sortedData));
    } catch (error) {
      console.error("Failed to store historical data:", error);
    }
  }

  // Get stored historical data
  private async getStoredHistory(): Promise<HistoricalDataPoint[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Failed to get stored history:", error);
      return [];
    }
  }

  // Get portfolio history for a specific period
  async getPortfolioHistory(
    period: "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL" = "1M"
  ): Promise<PortfolioHistory> {
    try {
      const allData = await this.getStoredHistory();

      if (allData.length === 0) {
        return this.getEmptyHistory(period);
      }

      // Filter data based on period
      const now = new Date();
      let startDate = new Date();

      switch (period) {
        case "1D":
          startDate.setDate(now.getDate() - 1);
          break;
        case "1W":
          startDate.setDate(now.getDate() - 7);
          break;
        case "1M":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "3M":
          startDate.setMonth(now.getMonth() - 3);
          break;
        case "1Y":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        case "ALL":
          startDate = new Date(
            Math.min(...allData.map((d) => new Date(d.date).getTime()))
          );
          break;
      }

      const filteredData = allData.filter(
        (point) => new Date(point.date) >= startDate
      );

      if (filteredData.length === 0) {
        return this.getEmptyHistory(period);
      }

      const startValue = filteredData[0].totalValue;
      const endValue = filteredData[filteredData.length - 1].totalValue;
      const totalReturn = endValue - startValue;
      const totalReturnPercent =
        startValue > 0 ? (totalReturn / startValue) * 100 : 0;

      return {
        data: filteredData,
        period,
        startValue,
        endValue,
        totalReturn,
        totalReturnPercent,
      };
    } catch (error) {
      console.error("Failed to get portfolio history:", error);
      return this.getEmptyHistory(period);
    }
  }

  private getEmptyHistory(
    period: "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL"
  ): PortfolioHistory {
    return {
      data: [],
      period,
      startValue: 0,
      endValue: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
    };
  }

  // Get consolidated watchlist from all providers
  async getConsolidatedWatchlist(): Promise<BrokerageWatchlistItem[]> {
    // Check cache first
    if (
      this.watchlistCache &&
      Date.now() - this.watchlistCache.timestamp < this.WATCHLIST_CACHE_TTL
    ) {
      return this.watchlistCache.data;
    }

    try {
      const activeSessions = brokerageAuthService.getActiveSessions();
      const allWatchlistItems: BrokerageWatchlistItem[] = [];
      const symbolsSet = new Set<string>();

      for (const provider of activeSessions) {
        try {
          const watchlist = await brokerageApiService.getWatchlist(provider);
          watchlist.forEach((item) => {
            if (!symbolsSet.has(item.symbol)) {
              symbolsSet.add(item.symbol);
              allWatchlistItems.push(item);
            }
          });
        } catch (error) {
          console.warn(`Failed to fetch watchlist from ${provider}:`, error);
        }
      }

      // Cache the result
      this.watchlistCache = { data: allWatchlistItems, timestamp: Date.now() };

      return allWatchlistItems;
    } catch (error) {
      console.error("Failed to get consolidated watchlist:", error);
      return [];
    }
  }

  // Add stock to watchlist on all connected accounts
  async addToAllWatchlists(symbol: string): Promise<{
    success: boolean;
    results: Record<BrokerageProvider, boolean>;
  }> {
    const activeSessions = brokerageAuthService.getActiveSessions();
    const results: Record<BrokerageProvider, boolean> = {} as Record<
      BrokerageProvider,
      boolean
    >;
    let overallSuccess = true;

    for (const provider of activeSessions) {
      try {
        const success = await brokerageApiService.addToWatchlist(
          symbol,
          provider
        );
        results[provider] = success;
        if (!success) overallSuccess = false;
      } catch (error) {
        console.error(`Failed to add ${symbol} to ${provider}:`, error);
        results[provider] = false;
        overallSuccess = false;
      }
    }

    // Clear watchlist cache
    this.watchlistCache = null;

    return { success: overallSuccess, results };
  }

  // Remove stock from watchlist on all connected accounts
  async removeFromAllWatchlists(symbol: string): Promise<{
    success: boolean;
    results: Record<BrokerageProvider, boolean>;
  }> {
    const activeSessions = brokerageAuthService.getActiveSessions();
    const results: Record<BrokerageProvider, boolean> = {} as Record<
      BrokerageProvider,
      boolean
    >;
    let overallSuccess = true;

    for (const provider of activeSessions) {
      try {
        const success = await brokerageApiService.removeFromWatchlist(
          symbol,
          provider
        );
        results[provider] = success;
        if (!success) overallSuccess = false;
      } catch (error) {
        console.error(`Failed to remove ${symbol} from ${provider}:`, error);
        results[provider] = false;
        overallSuccess = false;
      }
    }

    // Clear watchlist cache
    this.watchlistCache = null;

    return { success: overallSuccess, results };
  }

  // Clear cache to force refresh
  clearCache(): void {
    this.portfolioCache = null;
    this.watchlistCache = null;
  }

  // Get performance metrics
  async getPerformanceMetrics(): Promise<{
    bestDay: { date: string; change: number; changePercent: number } | null;
    worstDay: { date: string; change: number; changePercent: number } | null;
    avgDailyReturn: number;
    volatility: number;
    sharpeRatio: number;
  }> {
    const history = await this.getPortfolioHistory("1Y");

    if (history.data.length < 2) {
      return {
        bestDay: null,
        worstDay: null,
        avgDailyReturn: 0,
        volatility: 0,
        sharpeRatio: 0,
      };
    }

    // Calculate daily returns
    const dailyReturns = history.data.slice(1).map((point, index) => {
      const prevValue = history.data[index].totalValue;
      const currentValue = point.totalValue;
      return prevValue > 0 ? ((currentValue - prevValue) / prevValue) * 100 : 0;
    });

    // Find best and worst days
    const bestDayIndex = dailyReturns.indexOf(Math.max(...dailyReturns));
    const worstDayIndex = dailyReturns.indexOf(Math.min(...dailyReturns));

    const bestDay =
      bestDayIndex >= 0
        ? {
            date: history.data[bestDayIndex + 1].date,
            change: history.data[bestDayIndex + 1].dayChange,
            changePercent: dailyReturns[bestDayIndex],
          }
        : null;

    const worstDay =
      worstDayIndex >= 0
        ? {
            date: history.data[worstDayIndex + 1].date,
            change: history.data[worstDayIndex + 1].dayChange,
            changePercent: dailyReturns[worstDayIndex],
          }
        : null;

    // Calculate metrics
    const avgDailyReturn =
      dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce(
        (sum, ret) => sum + Math.pow(ret - avgDailyReturn, 2),
        0
      ) / dailyReturns.length;
    const volatility = Math.sqrt(variance);
    const sharpeRatio = volatility > 0 ? avgDailyReturn / volatility : 0;

    return {
      bestDay,
      worstDay,
      avgDailyReturn,
      volatility,
      sharpeRatio,
    };
  }
}

export const portfolioAggregationService = new PortfolioAggregationService();
