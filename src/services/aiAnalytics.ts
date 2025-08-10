import { Candle } from "./marketProviders";

export interface TechnicalIndicators {
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  stochastic: {
    k: number;
    d: number;
  };
  atr: number;
  volume: {
    sma20: number;
    current: number;
    ratio: number;
  };
}

export interface MomentumAnalysis {
  timeframe: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: number; // 0-100
  confidence: number; // 0-100
  signals: string[];
  warnings: string[];
}

export interface TradingSignal {
  type: "intraday" | "swing" | "longterm";
  action: "buy" | "sell" | "hold";
  confidence: number;
  entry: number;
  targets: number[];
  stopLoss: number;
  riskReward: number;
  reasoning: string[];
  confluence: number; // Number of confirming signals
}

export interface MarketAnalysis {
  symbol: string;
  currentPrice: number;
  indicators: TechnicalIndicators;
  momentum: {
    "1m": MomentumAnalysis;
    "5m": MomentumAnalysis;
    "15m": MomentumAnalysis;
    "1h": MomentumAnalysis;
    "4h": MomentumAnalysis;
    "1d": MomentumAnalysis;
    "1w": MomentumAnalysis;
  };
  signals: TradingSignal[];
  supportResistance: {
    support: number[];
    resistance: number[];
  };
  marketStructure: {
    trend: "uptrend" | "downtrend" | "sideways";
    trendStrength: number;
    phase: "accumulation" | "markup" | "distribution" | "markdown";
  };
  riskFactors: string[];
  newsImpact: "positive" | "negative" | "neutral";
  overallRating: {
    score: number; // 0-100
    recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  };
}

// Technical Indicator Calculations
export class TechnicalAnalysis {
  static calculateSMA(candles: Candle[], period: number): number {
    if (candles.length < period) return 0;
    const prices = candles.slice(-period).map(c => c.close);
    return prices.reduce((sum, price) => sum + price, 0) / period;
  }

  static calculateEMA(candles: Candle[], period: number): number {
    if (candles.length < period) return 0;
    
    const multiplier = 2 / (period + 1);
    const prices = candles.map(c => c.close);
    
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    return ema;
  }

  static calculateRSI(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 50;
    
    const prices = candles.map(c => c.close);
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = period + 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;
      
      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    }
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  static calculateMACD(candles: Candle[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(candles, 12);
    const ema26 = this.calculateEMA(candles, 26);
    const macd = ema12 - ema26;
    
    // Calculate signal line (9-period EMA of MACD)
    const macdValues = [];
    for (let i = 26; i <= candles.length; i++) {
      const slice = candles.slice(0, i);
      const ema12Slice = this.calculateEMA(slice, 12);
      const ema26Slice = this.calculateEMA(slice, 26);
      macdValues.push(ema12Slice - ema26Slice);
    }
    
    const signal = this.calculateEMAFromValues(macdValues, 9);
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  static calculateEMAFromValues(values: number[], period: number): number {
    if (values.length < period) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = values[0];
    
    for (let i = 1; i < values.length; i++) {
      ema = (values[i] * multiplier) + (ema * (1 - multiplier));
    }
    return ema;
  }

  static calculateBollingerBands(candles: Candle[], period: number = 20, multiplier: number = 2): { upper: number; middle: number; lower: number } {
    const sma = this.calculateSMA(candles, period);
    const prices = candles.slice(-period).map(c => c.close);
    
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    return {
      upper: sma + (stdDev * multiplier),
      middle: sma,
      lower: sma - (stdDev * multiplier)
    };
  }

  static calculateStochastic(candles: Candle[], period: number = 14): { k: number; d: number } {
    if (candles.length < period) return { k: 50, d: 50 };
    
    const slice = candles.slice(-period);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const close = candles[candles.length - 1].close;
    
    const k = ((close - low) / (high - low)) * 100;
    
    // Calculate %D (3-period SMA of %K)
    const kValues = [];
    for (let i = period - 1; i < candles.length; i++) {
      const periodSlice = candles.slice(i - period + 1, i + 1);
      const periodHigh = Math.max(...periodSlice.map(c => c.high));
      const periodLow = Math.min(...periodSlice.map(c => c.low));
      const periodClose = candles[i].close;
      kValues.push(((periodClose - periodLow) / (periodHigh - periodLow)) * 100);
    }
    
    const d = kValues.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
    
    return { k, d };
  }

  static calculateATR(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 0;
    
    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
    
    return trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
  }

  static calculateVolumeAnalysis(candles: Candle[]): { sma20: number; current: number; ratio: number } {
    const volumes = candles.map(c => c.volume || 0);
    const sma20 = volumes.slice(-20).reduce((sum, vol) => sum + vol, 0) / 20;
    const current = volumes[volumes.length - 1];
    const ratio = current / sma20;
    
    return { sma20, current, ratio };
  }

  static analyzeIndicators(candles: Candle[]): TechnicalIndicators {
    return {
      sma20: this.calculateSMA(candles, 20),
      sma50: this.calculateSMA(candles, 50),
      sma200: this.calculateSMA(candles, 200),
      ema12: this.calculateEMA(candles, 12),
      ema26: this.calculateEMA(candles, 26),
      rsi: this.calculateRSI(candles),
      macd: this.calculateMACD(candles),
      bollingerBands: this.calculateBollingerBands(candles),
      stochastic: this.calculateStochastic(candles),
      atr: this.calculateATR(candles),
      volume: this.calculateVolumeAnalysis(candles)
    };
  }

  static analyzeMomentum(candles: Candle[], timeframe: string): MomentumAnalysis {
    const indicators = this.analyzeIndicators(candles);
    const currentPrice = candles[candles.length - 1].close;
    
    let direction: "bullish" | "bearish" | "neutral" = "neutral";
    let strength = 50;
    let confidence = 50;
    const signals: string[] = [];
    const warnings: string[] = [];
    
    // Price vs Moving Averages
    if (currentPrice > indicators.sma20 && currentPrice > indicators.sma50) {
      signals.push("Price above key moving averages");
      strength += 15;
      direction = "bullish";
    } else if (currentPrice < indicators.sma20 && currentPrice < indicators.sma50) {
      signals.push("Price below key moving averages");
      strength -= 15;
      direction = "bearish";
    }
    
    // RSI Analysis
    if (indicators.rsi > 70) {
      warnings.push("RSI overbought (>70)");
      confidence -= 10;
    } else if (indicators.rsi < 30) {
      warnings.push("RSI oversold (<30)");
      confidence -= 10;
    } else if (indicators.rsi > 50) {
      signals.push("RSI bullish momentum");
      strength += 10;
    } else {
      signals.push("RSI bearish momentum");
      strength -= 10;
    }
    
    // MACD Analysis
    if (indicators.macd.macd > indicators.macd.signal) {
      signals.push("MACD bullish crossover");
      strength += 10;
      if (direction === "neutral") direction = "bullish";
    } else {
      signals.push("MACD bearish crossover");
      strength -= 10;
      if (direction === "neutral") direction = "bearish";
    }
    
    // Volume Analysis
    if (indicators.volume.ratio > 1.5) {
      signals.push("High volume confirmation");
      confidence += 15;
    } else if (indicators.volume.ratio < 0.7) {
      warnings.push("Low volume - weak confirmation");
      confidence -= 10;
    }
    
    // Bollinger Bands
    if (currentPrice > indicators.bollingerBands.upper) {
      warnings.push("Price above Bollinger upper band");
      confidence -= 5;
    } else if (currentPrice < indicators.bollingerBands.lower) {
      warnings.push("Price below Bollinger lower band");
      confidence -= 5;
    }
    
    // Stochastic
    if (indicators.stochastic.k > indicators.stochastic.d && indicators.stochastic.k > 20) {
      signals.push("Stochastic bullish momentum");
      strength += 5;
    } else if (indicators.stochastic.k < indicators.stochastic.d && indicators.stochastic.k < 80) {
      signals.push("Stochastic bearish momentum");
      strength -= 5;
    }
    
    // Normalize values
    strength = Math.max(0, Math.min(100, strength));
    confidence = Math.max(0, Math.min(100, confidence));
    
    return {
      timeframe,
      direction,
      strength,
      confidence,
      signals,
      warnings
    };
  }

  static generateTradingSignals(candles: Candle[], indicators: TechnicalIndicators): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const currentPrice = candles[candles.length - 1].close;
    const atr = indicators.atr;
    
    // Intraday Signal
    let intradayConfluence = 0;
    const intradayReasons: string[] = [];
    
    if (indicators.rsi < 30 && indicators.macd.macd > indicators.macd.signal) {
      intradayConfluence += 2;
      intradayReasons.push("RSI oversold with MACD bullish cross");
    }
    
    if (currentPrice < indicators.bollingerBands.lower && indicators.volume.ratio > 1.2) {
      intradayConfluence += 2;
      intradayReasons.push("Price below BB lower band with volume spike");
    }
    
    if (indicators.stochastic.k < 20 && indicators.stochastic.k > indicators.stochastic.d) {
      intradayConfluence += 1;
      intradayReasons.push("Stochastic oversold reversal");
    }
    
    if (intradayConfluence >= 2) {
      signals.push({
        type: "intraday",
        action: "buy",
        confidence: Math.min(90, intradayConfluence * 20),
        entry: currentPrice,
        targets: [
          currentPrice + (atr * 1),
          currentPrice + (atr * 2),
          currentPrice + (atr * 3)
        ],
        stopLoss: currentPrice - (atr * 1.5),
        riskReward: 2.0,
        reasoning: intradayReasons,
        confluence: intradayConfluence
      });
    }
    
    // Swing Trading Signal
    let swingConfluence = 0;
    const swingReasons: string[] = [];
    
    if (currentPrice > indicators.sma20 && indicators.sma20 > indicators.sma50) {
      swingConfluence += 2;
      swingReasons.push("Bullish moving average alignment");
    }
    
    if (indicators.macd.histogram > 0 && indicators.rsi > 50 && indicators.rsi < 70) {
      swingConfluence += 2;
      swingReasons.push("MACD momentum with healthy RSI");
    }
    
    if (indicators.volume.ratio > 1.0) {
      swingConfluence += 1;
      swingReasons.push("Above average volume");
    }
    
    if (swingConfluence >= 2) {
      signals.push({
        type: "swing",
        action: "buy",
        confidence: Math.min(85, swingConfluence * 18),
        entry: currentPrice,
        targets: [
          currentPrice + (atr * 3),
          currentPrice + (atr * 5),
          currentPrice + (atr * 8)
        ],
        stopLoss: currentPrice - (atr * 2),
        riskReward: 2.5,
        reasoning: swingReasons,
        confluence: swingConfluence
      });
    }
    
    // Long-term Signal
    let longtermConfluence = 0;
    const longtermReasons: string[] = [];
    
    if (indicators.sma50 > indicators.sma200 && currentPrice > indicators.sma200) {
      longtermConfluence += 3;
      longtermReasons.push("Golden cross formation with price above 200 SMA");
    }
    
    if (indicators.rsi > 40 && indicators.rsi < 80) {
      longtermConfluence += 1;
      longtermReasons.push("RSI in healthy bullish range");
    }
    
    if (indicators.macd.macd > 0) {
      longtermConfluence += 1;
      longtermReasons.push("MACD above zero line");
    }
    
    if (longtermConfluence >= 3) {
      signals.push({
        type: "longterm",
        action: "buy",
        confidence: Math.min(80, longtermConfluence * 15),
        entry: currentPrice,
        targets: [
          currentPrice + (atr * 10),
          currentPrice + (atr * 20),
          currentPrice + (atr * 30)
        ],
        stopLoss: currentPrice - (atr * 5),
        riskReward: 3.0,
        reasoning: longtermReasons,
        confluence: longtermConfluence
      });
    }
    
    return signals;
  }

  static findSupportResistance(candles: Candle[]): { support: number[]; resistance: number[] } {
    const support: number[] = [];
    const resistance: number[] = [];
    
    // Find pivot points
    for (let i = 2; i < candles.length - 2; i++) {
      const current = candles[i];
      const prev2 = candles[i - 2];
      const prev1 = candles[i - 1];
      const next1 = candles[i + 1];
      const next2 = candles[i + 2];
      
      // Resistance (pivot high)
      if (current.high > prev2.high && current.high > prev1.high && 
          current.high > next1.high && current.high > next2.high) {
        resistance.push(current.high);
      }
      
      // Support (pivot low)
      if (current.low < prev2.low && current.low < prev1.low && 
          current.low < next1.low && current.low < next2.low) {
        support.push(current.low);
      }
    }
    
    // Sort and get most recent levels
    support.sort((a, b) => b - a);
    resistance.sort((a, b) => a - b);
    
    return {
      support: support.slice(0, 3),
      resistance: resistance.slice(0, 3)
    };
  }

  static analyzeMarketStructure(candles: Candle[]): { trend: "uptrend" | "downtrend" | "sideways"; trendStrength: number; phase: "accumulation" | "markup" | "distribution" | "markdown" } {
    const indicators = this.analyzeIndicators(candles);
    const currentPrice = candles[candles.length - 1].close;
    
    let trend: "uptrend" | "downtrend" | "sideways" = "sideways";
    let trendStrength = 50;
    
    // Determine trend based on moving averages
    if (indicators.sma20 > indicators.sma50 && indicators.sma50 > indicators.sma200) {
      trend = "uptrend";
      trendStrength = 75;
    } else if (indicators.sma20 < indicators.sma50 && indicators.sma50 < indicators.sma200) {
      trend = "downtrend";
      trendStrength = 75;
    }
    
    // Determine market phase
    let phase: "accumulation" | "markup" | "distribution" | "markdown" = "accumulation";
    
    if (trend === "uptrend" && indicators.volume.ratio > 1.2) {
      phase = "markup";
    } else if (trend === "downtrend" && indicators.volume.ratio > 1.2) {
      phase = "markdown";
    } else if (trend === "sideways" && indicators.rsi > 70) {
      phase = "distribution";
    }
    
    return { trend, trendStrength, phase };
  }

  static generateOverallRating(analysis: Partial<MarketAnalysis>): { score: number; recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell" } {
    let score = 50;
    
    // Factor in signals
    if (analysis.signals) {
      analysis.signals.forEach(signal => {
        if (signal.action === "buy") {
          score += signal.confidence * 0.3;
        } else if (signal.action === "sell") {
          score -= signal.confidence * 0.3;
        }
      });
    }
    
    // Factor in momentum
    if (analysis.momentum) {
      Object.values(analysis.momentum).forEach(momentum => {
        if (momentum.direction === "bullish") {
          score += momentum.strength * 0.1;
        } else if (momentum.direction === "bearish") {
          score -= momentum.strength * 0.1;
        }
      });
    }
    
    // Factor in market structure
    if (analysis.marketStructure) {
      if (analysis.marketStructure.trend === "uptrend") {
        score += analysis.marketStructure.trendStrength * 0.2;
      } else if (analysis.marketStructure.trend === "downtrend") {
        score -= analysis.marketStructure.trendStrength * 0.2;
      }
    }
    
    score = Math.max(0, Math.min(100, score));
    
    let recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
    if (score >= 80) recommendation = "strong_buy";
    else if (score >= 65) recommendation = "buy";
    else if (score >= 35) recommendation = "hold";
    else if (score >= 20) recommendation = "sell";
    else recommendation = "strong_sell";
    
    return { score, recommendation };
  }
}

export async function performComprehensiveAnalysis(
  symbol: string,
  candleData: { [timeframe: string]: Candle[] }
): Promise<MarketAnalysis> {
  const dailyCandles = candleData["1d"] || [];
  const currentPrice = dailyCandles[dailyCandles.length - 1]?.close || 0;
  
  // Calculate indicators based on daily data
  const indicators = TechnicalAnalysis.analyzeIndicators(dailyCandles);
  
  // Analyze momentum for each timeframe
  const momentum = {} as MarketAnalysis["momentum"];
  Object.entries(candleData).forEach(([timeframe, candles]) => {
    if (candles.length > 0) {
      momentum[timeframe as keyof typeof momentum] = TechnicalAnalysis.analyzeMomentum(candles, timeframe);
    }
  });
  
  // Generate trading signals
  const signals = TechnicalAnalysis.generateTradingSignals(dailyCandles, indicators);
  
  // Find support and resistance
  const supportResistance = TechnicalAnalysis.findSupportResistance(dailyCandles);
  
  // Analyze market structure
  const marketStructure = TechnicalAnalysis.analyzeMarketStructure(dailyCandles);
  
  // Identify risk factors
  const riskFactors: string[] = [];
  if (indicators.rsi > 80) riskFactors.push("Extreme overbought conditions");
  if (indicators.rsi < 20) riskFactors.push("Extreme oversold conditions");
  if (indicators.volume.ratio < 0.5) riskFactors.push("Unusually low volume");
  if (marketStructure.trend === "sideways") riskFactors.push("Choppy market conditions");
  
  // Create partial analysis for rating calculation
  const partialAnalysis = {
    signals,
    momentum,
    marketStructure
  };
  
  const overallRating = TechnicalAnalysis.generateOverallRating(partialAnalysis);
  
  return {
    symbol,
    currentPrice,
    indicators,
    momentum,
    signals,
    supportResistance,
    marketStructure,
    riskFactors,
    newsImpact: "neutral", // Will be updated with news analysis
    overallRating
  };
}