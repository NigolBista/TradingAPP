import { fetchCandles, Candle } from "./marketProviders";
import {
  performComprehensiveAnalysis,
  MarketAnalysis,
  TradingSignal,
} from "./aiAnalytics";
import { useUserStore } from "../store/userStore";
import { useStrategyBuilderStore } from "../store/strategyBuilderStore";
import { buildStrategySnapshots } from "./polygonIndicators";
import type { StrategyConfig } from "../types/strategy";
import { buildTradePlan } from "./riskManager";

export interface ScanFilter {
  rsiMin?: number;
  rsiMax?: number;
  volumeRatioMin?: number;
  priceMin?: number;
  priceMax?: number;
  marketCapMin?: number;
  marketCapMax?: number;
  signalTypes?: ("intraday" | "swing" | "longterm")[];
  minConfidence?: number;
  trendDirection?: "uptrend" | "downtrend" | "sideways";
  sectors?: string[];
}

export interface ScanResult {
  symbol: string;
  analysis: MarketAnalysis;
  alerts: string[];
  score: number;
}

export interface MarketScreenerData {
  topGainers: ScanResult[];
  topLosers: ScanResult[];
  highVolume: ScanResult[];
  breakouts: ScanResult[];
  oversold: ScanResult[];
  overbought: ScanResult[];
  signalAlerts: ScanResult[];
}

export interface ScanOptions {
  symbols?: string[];
  batchSize?: number;
  groupId?: string;
}

export class MarketScanner {
  private static collectUserSymbols(): string[] {
    try {
      const { watchlists, favorites } = useUserStore.getState().profile;
      const symbols = new Set<string>();

      (favorites || []).forEach((favoriteSymbol: string) => {
        if (favoriteSymbol) symbols.add(favoriteSymbol.toUpperCase());
      });

      (watchlists || []).forEach((watchlist) => {
        (watchlist.items || []).forEach((item) => {
          if (item?.symbol) {
            symbols.add(item.symbol.toUpperCase());
          }
        });
      });

      return Array.from(symbols);
    } catch (error) {
      console.warn("Failed to collect user watchlist symbols", error);
      return [];
    }
  }

  static getDefaultSymbols(): string[] {
    return this.collectUserSymbols();
  }

  static async scanMarket(
    filters: ScanFilter = {},
    options: ScanOptions = {}
  ): Promise<ScanResult[]> {
    // Resolve active group strategy & watchlist symbols
    const profile = useUserStore.getState().profile;
    const activeGroupId = options.groupId ?? profile.selectedStrategyGroupId;
    const groupStore = useStrategyBuilderStore.getState();
    const groupWatchlist = activeGroupId
      ? groupStore.getWatchlist(activeGroupId)
      : undefined;
    const groupSymbols = groupWatchlist?.symbols || [];

    const inputSymbols =
      options.symbols && options.symbols.length > 0
        ? options.symbols
        : groupSymbols.length > 0
        ? groupSymbols
        : this.getDefaultSymbols();

    const symbols = Array.from(
      new Set(
        inputSymbols
          .filter((symbol): symbol is string => Boolean(symbol))
          .map((symbol: string) => symbol.toUpperCase())
      )
    );

    if (symbols.length === 0) {
      return [];
    }

    const results: ScanResult[] = [];

    // Process symbols in batches to avoid rate limiting
    const batchSize =
      options.batchSize && options.batchSize > 0 ? options.batchSize : 5;

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = batch.map((symbol) =>
        this.analyzeSingleStock(symbol, filters, activeGroupId)
      );

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value) {
            results.push(result.value);
          } else {
            console.warn(
              `Failed to analyze ${batch[index]}:`,
              result.status === "rejected" ? result.reason : "Unknown error"
            );
          }
        });
      } catch (error) {
        console.error("Batch processing error:", error);
      }

      // Add delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private static async analyzeSingleStock(
    symbol: string,
    filters: ScanFilter,
    groupId?: string | null
  ): Promise<ScanResult | null> {
    try {
      // Fetch multiple timeframes
      const timeframes = ["1d", "1h", "15m", "5m"];
      const candleData: { [timeframe: string]: Candle[] } = {};

      for (const timeframe of timeframes) {
        try {
          const resolution = this.mapTimeframeToResolution(timeframe);
          const candles = await fetchCandles(symbol, { resolution });
          if (candles && candles.length > 0) {
            candleData[timeframe] = candles;
          }
        } catch (error) {
          console.warn(
            `Failed to fetch ${timeframe} data for ${symbol}:`,
            error
          );
        }
      }

      if (Object.keys(candleData).length === 0) {
        return null;
      }

      // Perform comprehensive analysis (baseline)
      const analysis = await performComprehensiveAnalysis(symbol, candleData);

      // If a group strategy exists, compute strategy-driven entry/exit overlays
      let entryExitAlerts: string[] = [];
      try {
        if (groupId) {
          const store = useStrategyBuilderStore.getState();
          const strategy: StrategyConfig | undefined =
            store.getStrategy(groupId);
          if (strategy && strategy.timeframes.length > 0) {
            // Build snapshots on the strategy's timeframes
            const tfCandles: Record<string, Candle[]> = {};
            for (const tf of strategy.timeframes) {
              const res = this.mapTimeframeToResolution(tf.timeframe as any);
              try {
                tfCandles[tf.timeframe] = await fetchCandles(symbol, {
                  resolution: res,
                });
              } catch {}
            }
            const snapshots = await buildStrategySnapshots(
              symbol,
              strategy,
              tfCandles as any
            );
            // Very simple derivation: use last candle of primary timeframe for entry/stop
            const primary = snapshots[0];
            if (primary && (primary.candles || []).length > 1) {
              const last = primary.candles[primary.candles.length - 1];
              const prev = primary.candles[primary.candles.length - 2];
              if (last && prev) {
                const bullish = last.close >= prev.close;
                const entry = last.close;
                const stop = bullish
                  ? Math.min(last.low, prev.low)
                  : Math.max(last.high, prev.high);
                const tp = bullish
                  ? entry + Math.abs(entry - stop) * 2
                  : entry - Math.abs(entry - stop) * 2;
                entryExitAlerts.push(
                  `Strategy(${primary.timeframe}): entry ${entry.toFixed(
                    2
                  )} | stop ${stop.toFixed(2)} | tp ${tp.toFixed(2)}`
                );
              }
            }
          }
        }
      } catch (e) {
        // Non-fatal: strategy overlay is best-effort
      }

      // Apply filters
      if (!this.passesFilters(analysis, filters)) {
        return null;
      }

      // Generate alerts + append strategy-derived entry/exit if present
      const alerts = [...this.generateAlerts(analysis), ...entryExitAlerts];

      // Calculate overall score
      const score = this.calculateScore(analysis);

      return {
        symbol,
        analysis,
        alerts,
        score,
      };
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
      return null;
    }
  }

  private static mapTimeframeToResolution(
    timeframe: string
  ): "1" | "5" | "15" | "30" | "1H" | "D" {
    switch (timeframe) {
      case "1m":
        return "1";
      case "5m":
        return "5";
      case "15m":
        return "15";
      case "30m":
        return "30";
      case "1h":
        return "1H";
      case "1d":
        return "D";
      default:
        return "D";
    }
  }

  private static passesFilters(
    analysis: MarketAnalysis,
    filters: ScanFilter
  ): boolean {
    // RSI filters
    if (
      filters.rsiMin !== undefined &&
      analysis.indicators.rsi < filters.rsiMin
    )
      return false;
    if (
      filters.rsiMax !== undefined &&
      analysis.indicators.rsi > filters.rsiMax
    )
      return false;

    // Volume ratio filter
    if (
      filters.volumeRatioMin !== undefined &&
      analysis.indicators.volume.ratio < filters.volumeRatioMin
    )
      return false;

    // Price filters
    if (
      filters.priceMin !== undefined &&
      analysis.currentPrice < filters.priceMin
    )
      return false;
    if (
      filters.priceMax !== undefined &&
      analysis.currentPrice > filters.priceMax
    )
      return false;

    // Signal type filters
    if (filters.signalTypes && filters.signalTypes.length > 0) {
      const hasMatchingSignal = analysis.signals.some((signal) =>
        filters.signalTypes!.includes(signal.type)
      );
      if (!hasMatchingSignal) return false;
    }

    // Minimum confidence filter
    if (filters.minConfidence !== undefined) {
      const maxConfidence = Math.max(
        ...analysis.signals.map((s) => s.confidence),
        0
      );
      if (maxConfidence < filters.minConfidence) return false;
    }

    // Trend direction filter
    if (
      filters.trendDirection &&
      analysis.marketStructure.trend !== filters.trendDirection
    )
      return false;

    return true;
  }

  private static generateAlerts(analysis: MarketAnalysis): string[] {
    const alerts: string[] = [];

    // RSI alerts
    if (analysis.indicators.rsi > 80) {
      alerts.push("🔴 Extremely overbought (RSI > 80)");
    } else if (analysis.indicators.rsi < 20) {
      alerts.push("🟢 Extremely oversold (RSI < 20)");
    }

    // Volume alerts
    if (analysis.indicators.volume.ratio > 3) {
      alerts.push("📈 Massive volume spike (3x+ average)");
    } else if (analysis.indicators.volume.ratio > 2) {
      alerts.push("📊 High volume (2x+ average)");
    }

    // MACD alerts
    if (
      analysis.indicators.macd.histogram > 0 &&
      analysis.indicators.macd.macd > analysis.indicators.macd.signal
    ) {
      alerts.push("🚀 MACD bullish momentum");
    } else if (
      analysis.indicators.macd.histogram < 0 &&
      analysis.indicators.macd.macd < analysis.indicators.macd.signal
    ) {
      alerts.push("📉 MACD bearish momentum");
    }

    // Bollinger Bands alerts
    if (analysis.currentPrice > analysis.indicators.bollingerBands.upper) {
      alerts.push("⚠️ Price above Bollinger upper band");
    } else if (
      analysis.currentPrice < analysis.indicators.bollingerBands.lower
    ) {
      alerts.push("💡 Price below Bollinger lower band");
    }

    // Signal alerts
    analysis.signals.forEach((signal) => {
      if (signal.confidence > 70) {
        const action = signal.action.toUpperCase();
        const type = signal.type.toUpperCase();
        alerts.push(
          `🎯 ${action} signal for ${type} (${signal.confidence}% confidence)`
        );
      }
    });

    // Support/Resistance alerts
    const nearSupport = analysis.supportResistance.support.some(
      (level) =>
        Math.abs(analysis.currentPrice - level) / analysis.currentPrice < 0.02
    );
    const nearResistance = analysis.supportResistance.resistance.some(
      (level) =>
        Math.abs(analysis.currentPrice - level) / analysis.currentPrice < 0.02
    );

    if (nearSupport) alerts.push("🛡️ Near key support level");
    if (nearResistance) alerts.push("🔒 Near key resistance level");

    return alerts;
  }

  private static calculateScore(analysis: MarketAnalysis): number {
    let score = analysis.overallRating.score;

    // Boost score for high confidence signals
    const highConfidenceSignals = analysis.signals.filter(
      (s) => s.confidence > 70
    );
    score += highConfidenceSignals.length * 10;

    // Boost score for multiple timeframe alignment
    const bullishTimeframes = Object.values(analysis.momentum).filter(
      (m) => m.direction === "bullish"
    ).length;
    const bearishTimeframes = Object.values(analysis.momentum).filter(
      (m) => m.direction === "bearish"
    ).length;

    if (bullishTimeframes > bearishTimeframes) {
      score += (bullishTimeframes - bearishTimeframes) * 5;
    } else if (bearishTimeframes > bullishTimeframes) {
      score -= (bearishTimeframes - bullishTimeframes) * 5;
    }

    // Boost score for high volume
    if (analysis.indicators.volume.ratio > 2) {
      score += 15;
    } else if (analysis.indicators.volume.ratio > 1.5) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  static buildScreenerData(allResults: ScanResult[]): MarketScreenerData {
    const topGainers = allResults
      .filter(
        (r) =>
          r.analysis.overallRating.recommendation === "strong_buy" ||
          r.analysis.overallRating.recommendation === "buy"
      )
      .slice(0, 10);

    const topLosers = allResults
      .filter(
        (r) =>
          r.analysis.overallRating.recommendation === "strong_sell" ||
          r.analysis.overallRating.recommendation === "sell"
      )
      .slice(0, 10);

    const highVolume = allResults
      .filter((r) => r.analysis.indicators.volume.ratio > 1.5)
      .sort(
        (a, b) =>
          b.analysis.indicators.volume.ratio -
          a.analysis.indicators.volume.ratio
      )
      .slice(0, 10);

    const breakouts = allResults
      .filter(
        (r) =>
          r.analysis.currentPrice >
            r.analysis.indicators.bollingerBands.upper ||
          r.analysis.indicators.rsi > 70
      )
      .slice(0, 10);

    const oversold = allResults
      .filter((r) => r.analysis.indicators.rsi < 30)
      .sort((a, b) => a.analysis.indicators.rsi - b.analysis.indicators.rsi)
      .slice(0, 10);

    const overbought = allResults
      .filter((r) => r.analysis.indicators.rsi > 70)
      .sort((a, b) => b.analysis.indicators.rsi - a.analysis.indicators.rsi)
      .slice(0, 10);

    const signalAlerts = allResults
      .filter((r) => r.analysis.signals.some((s) => s.confidence > 70))
      .slice(0, 15);

    return {
      topGainers,
      topLosers,
      highVolume,
      breakouts,
      oversold,
      overbought,
      signalAlerts,
    };
  }

  static async getMarketScreenerData(
    filters: ScanFilter = {},
    options: ScanOptions = {}
  ): Promise<MarketScreenerData> {
    const allResults = await this.scanMarket(filters, options);
    return this.buildScreenerData(allResults);
  }

  static async getWatchlistAlerts(symbols: string[]): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    for (const symbol of symbols) {
      try {
        const result = await this.analyzeSingleStock(symbol, {
          minConfidence: 60,
        });
        if (result && result.alerts.length > 0) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Error analyzing watchlist symbol ${symbol}:`, error);
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  static getFilterPresets(): { [key: string]: ScanFilter } {
    return {
      oversoldBounce: {
        rsiMax: 30,
        volumeRatioMin: 1.2,
        minConfidence: 60,
        signalTypes: ["intraday", "swing"],
      },
      momentumBreakout: {
        rsiMin: 60,
        volumeRatioMin: 1.5,
        minConfidence: 70,
        trendDirection: "uptrend",
      },
      swingSetup: {
        rsiMin: 40,
        rsiMax: 70,
        volumeRatioMin: 1.0,
        minConfidence: 65,
        signalTypes: ["swing"],
      },
      longTermInvestment: {
        rsiMin: 30,
        rsiMax: 80,
        minConfidence: 60,
        signalTypes: ["longterm"],
        trendDirection: "uptrend",
      },
      dayTradingSetup: {
        volumeRatioMin: 2.0,
        minConfidence: 70,
        signalTypes: ["intraday"],
      },
    };
  }
}
