import { Candle, fetchCandles } from "./marketProviders";
import {
  TechnicalAnalysis,
  performComprehensiveAnalysis,
  MarketAnalysis,
  TradingSignal,
} from "./aiAnalytics";
import { detectPatterns } from "./patternDetection";
import { buildTradePlan, TradePlan } from "./riskManager";
import { buildDayTradePlan } from "../logic/dayTrade";
import { buildSwingTradePlan } from "../logic/swingTrade";
import { TradePlanOverlay, StrategyContext } from "../logic/types";

export interface SignalContext {
  symbol: string;
  candleData: { [timeframe: string]: Candle[] };
  analysis: MarketAnalysis;
}

export interface DecalpXData {
  oversoldLevel: number;
  momentumScore: number;
  rsi: number;
  bullishSignals: {
    day: boolean;
    swing: boolean;
    longterm: boolean;
  };
  marketCondition: string;
}

export interface EnhancedSignal extends TradingSignal {
  patterns: string[];
  tradePlan: TradePlan;
  overlay?: TradePlanOverlay;
  decalpX?: DecalpXData;
}

export interface SignalSummary {
  symbol: string;
  timestamp: number;
  timeframes: string[];
  recommendation: MarketAnalysis["overallRating"]; // score and recommendation
  topSignal?: EnhancedSignal;
  allSignals: EnhancedSignal[];
}

export async function buildSignalContext(
  symbol: string
): Promise<SignalContext | null> {
  const timeframes = [
    { tf: "1d", resolution: "D" as const },
    { tf: "1h", resolution: "1H" as const },
    { tf: "15m", resolution: "15" as const },
    { tf: "5m", resolution: "5" as const },
  ];
  const candleData: { [tf: string]: Candle[] } = {};
  for (const { tf, resolution } of timeframes) {
    try {
      candleData[tf] = await fetchCandles(symbol, { resolution });
    } catch {
      candleData[tf] = [];
    }
  }
  if (!candleData["1d"] || candleData["1d"].length === 0) return null;
  const analysis = await performComprehensiveAnalysis(symbol, candleData);
  return { symbol, candleData, analysis };
}

export function getDecalpXDataFromContext(
  context: SignalContext
): DecalpXData | null {
  try {
    const daily = context.candleData["1d"] || [];
    const hourly = context.candleData["1h"] || [];

    if (daily.length < 10) {
      return {
        oversoldLevel: 30,
        momentumScore: 40,
        rsi: 50,
        bullishSignals: { day: false, swing: false, longterm: false },
        marketCondition: "NEUTRAL",
      };
    }

    const rsi = Math.max(
      0,
      Math.min(100, TechnicalAnalysis.calculateRSI(daily, 14))
    );

    const idxA = Math.max(0, daily.length - 7);
    const a = daily[idxA]?.close ?? daily[0].close;
    const b = daily[daily.length - 1].close;
    const momentumPct = a > 0 ? ((b - a) / a) * 100 : 0;
    const momentumScore = Math.min(100, Math.max(0, Math.abs(momentumPct) * 3));

    const sma20 = TechnicalAnalysis.calculateSMA(daily, 20);
    const sma50 = TechnicalAnalysis.calculateSMA(daily, 50);
    const trendDelta = sma50 ? (sma20 - sma50) / sma50 : 0;
    const trendHeat = Math.min(100, Math.abs(trendDelta) * 8000);

    const closes = daily.map((c) => c.close);
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const r = (closes[i] - closes[i - 1]) / (closes[i - 1] || closes[i]);
      if (isFinite(r)) returns.push(r);
    }
    const mean =
      returns.reduce((s, x) => s + x, 0) / Math.max(1, returns.length);
    const variance =
      returns.reduce((s, x) => s + Math.pow(x - mean, 2), 0) /
      Math.max(1, returns.length);
    const volScore = Math.min(100, Math.max(0, Math.sqrt(variance) * 10000));

    const signalStrength = Math.round(
      0.55 * trendHeat + 0.25 * momentumScore + 0.2 * (100 - volScore)
    );

    const oversoldLevel = rsi < 30 ? 100 - rsi : Math.max(0, 70 - rsi);

    const daySma20 = TechnicalAnalysis.calculateSMA(hourly, 20);
    const daySma50 = TechnicalAnalysis.calculateSMA(hourly, 50);
    const dayBull = hourly.length > 55 ? daySma20 > daySma50 : momentumPct > 0;
    const swingBull = sma20 > sma50 && oversoldLevel < 70;
    const longtermBull =
      sma50 > 0 && TechnicalAnalysis.calculateSMA(daily, 200) > 0
        ? TechnicalAnalysis.calculateSMA(daily, 50) >
          TechnicalAnalysis.calculateSMA(daily, 200)
        : trendHeat > 55 && rsi > 45;

    const bullishSignals = {
      day: dayBull,
      swing: swingBull,
      longterm: longtermBull,
    };

    const marketCondition =
      oversoldLevel > 70
        ? "OVERSOLD"
        : momentumScore > 80
        ? "MOMENTUM"
        : signalStrength > 75
        ? "STRONG"
        : "NEUTRAL";

    return {
      oversoldLevel,
      momentumScore,
      rsi,
      bullishSignals,
      marketCondition,
    };
  } catch (error) {
    console.error("Failed to get DecalpX data:", error);
    return null;
  }
}

export function enrichSignalsWithPatternsAndRisk(
  context: SignalContext,
  accountSize: number = 10000,
  riskPct: number = 1
): EnhancedSignal[] {
  const daily = context.candleData["1d"] || [];
  const patternResult = detectPatterns(daily);
  const patterns = patternResult.patterns.map(
    (p) => `${p.type}:${p.confidence}`
  );
  const signals = context.analysis.signals || [];
  const decalpXData = getDecalpXDataFromContext(context);
  const currentPrice = context.analysis.currentPrice;

  const enhanced: EnhancedSignal[] = signals.map((s) => {
    const tradePlan = buildTradePlan(
      s.entry,
      s.stopLoss,
      s.targets,
      accountSize,
      riskPct
    );

    // Generate TradePlanOverlay with extended entry/exit data
    const recentCloses = daily.slice(-20).map((candle) => candle.close);
    const strategyContext: StrategyContext = {
      currentPrice,
      recentCloses,
      momentumPct: s.action === "buy" ? 5 : -5, // Simple momentum based on signal action
    };

    let overlay: TradePlanOverlay;
    if (s.type === "intraday") {
      overlay = buildDayTradePlan(strategyContext);
    } else if (s.type === "swing") {
      overlay = buildSwingTradePlan(strategyContext);
    } else {
      // For longterm, use swing logic but with wider ranges
      overlay = buildSwingTradePlan(strategyContext);
    }

    // Enhance signal confidence based on DecalpX data
    let enhancedConfidence = s.confidence;
    if (decalpXData) {
      // Boost confidence for day trading signals when day timeframe is bullish
      if (s.type === "intraday") {
        if (decalpXData.bullishSignals.day && s.action === "buy") {
          enhancedConfidence = Math.min(100, enhancedConfidence + 15);
        }
        if (decalpXData.oversoldLevel > 70 && s.action === "buy") {
          enhancedConfidence = Math.min(100, enhancedConfidence + 10);
        }
      }

      // Boost confidence for swing trading signals
      if (s.type === "swing") {
        if (decalpXData.bullishSignals.swing && s.action === "buy") {
          enhancedConfidence = Math.min(100, enhancedConfidence + 12);
        }
        if (decalpXData.momentumScore > 80 && s.action === "buy") {
          enhancedConfidence = Math.min(100, enhancedConfidence + 8);
        }
      }
    }

    return {
      ...s,
      confidence: enhancedConfidence,
      patterns,
      tradePlan,
      overlay,
      decalpX: decalpXData || undefined,
    };
  });
  return enhanced.sort((a, b) => b.confidence - a.confidence);
}

export async function generateSignalSummary(
  symbol: string,
  accountSize?: number,
  riskPct?: number
): Promise<SignalSummary | null> {
  const context = await buildSignalContext(symbol);
  if (!context) return null;
  const enriched = enrichSignalsWithPatternsAndRisk(
    context,
    accountSize ?? 10000,
    riskPct ?? 1
  );
  return {
    symbol,
    timestamp: Date.now(),
    timeframes: Object.keys(context.candleData),
    recommendation: context.analysis.overallRating,
    topSignal: enriched[0],
    allSignals: enriched,
  };
}

export function sortSignalsByFreshness(
  signals: SignalSummary[]
): SignalSummary[] {
  return [...signals].sort((a, b) => b.timestamp - a.timestamp);
}
