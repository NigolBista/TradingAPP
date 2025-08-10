import { Candle, fetchCandles } from "./marketProviders";
import {
  TechnicalAnalysis,
  performComprehensiveAnalysis,
  MarketAnalysis,
  TradingSignal,
} from "./aiAnalytics";
import { detectPatterns } from "./patternDetection";
import { buildTradePlan, TradePlan } from "./riskManager";

export interface SignalContext {
  symbol: string;
  candleData: { [timeframe: string]: Candle[] };
  analysis: MarketAnalysis;
}

export interface EnhancedSignal extends TradingSignal {
  patterns: string[];
  tradePlan: TradePlan;
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
  const enhanced: EnhancedSignal[] = signals.map((s) => {
    const tradePlan = buildTradePlan(
      s.entry,
      s.stopLoss,
      s.targets,
      accountSize,
      riskPct
    );
    return { ...s, patterns, tradePlan };
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
