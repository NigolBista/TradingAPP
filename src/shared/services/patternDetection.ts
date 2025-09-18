import { Candle } from "./marketProviders";

export type DetectedPatternType =
  | "breakout"
  | "breakdown"
  | "pullback_to_sma20"
  | "double_bottom"
  | "double_top"
  | "flag"
  | "pennant";

export interface DetectedPattern {
  type: DetectedPatternType;
  confidence: number; // 0-100
  level?: number; // breakout/breakdown reference price
  context?: string; // human readable summary
}

export interface PatternDetectionResult {
  patterns: DetectedPattern[];
}

function getRecentSlice<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr.slice();
  return arr.slice(arr.length - count);
}

function simpleSMA(values: number[], period: number): number {
  if (values.length < period)
    return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const slice = values.slice(values.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function detectBreakout(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 20) return null;
  const recent = getRecentSlice(candles, 40);
  const closes = recent.map((c) => c.close);
  const highs = recent.map((c) => c.high);
  const lastClose = closes[closes.length - 1];
  const prevHigh = Math.max(...highs.slice(0, highs.length - 1));
  const distance = (lastClose - prevHigh) / prevHigh;
  if (distance > 0.01) {
    const confidence = Math.min(95, 60 + Math.round(distance * 100));
    return {
      type: "breakout",
      confidence,
      level: prevHigh,
      context: `Close broke above recent high ${prevHigh.toFixed(2)} by ${(
        distance * 100
      ).toFixed(1)}%`,
    };
  }
  // breakdown
  const lows = recent.map((c) => c.low);
  const prevLow = Math.min(...lows.slice(0, lows.length - 1));
  const distanceDown = (prevLow - lastClose) / prevLow;
  if (distanceDown > 0.01) {
    const confidence = Math.min(95, 60 + Math.round(distanceDown * 100));
    return {
      type: "breakdown",
      confidence,
      level: prevLow,
      context: `Close broke below recent low ${prevLow.toFixed(2)} by ${(
        distanceDown * 100
      ).toFixed(1)}%`,
    };
  }
  return null;
}

function detectPullbackToSMA20(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 25) return null;
  const closes = candles.map((c) => c.close);
  const sma20 = simpleSMA(closes, 20);
  const lastClose = closes[closes.length - 1];
  const last5 = closes.slice(-5);
  const wasAbove =
    Math.max(...closes.slice(-25, -5)) > sma20 &&
    Math.min(...closes.slice(-25, -5)) > sma20 * 0.9;
  const nearMA =
    Math.abs(lastClose - sma20) / sma20 < 0.01 ||
    last5.some((c) => Math.abs(c - sma20) / sma20 < 0.01);
  if (wasAbove && nearMA) {
    return {
      type: "pullback_to_sma20",
      confidence: 70,
      level: sma20,
      context: `Pullback near 20 SMA at ${sma20.toFixed(2)} after uptrend`,
    };
  }
  return null;
}

function detectDoubleBottom(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 50) return null;
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1];
  // find two recent swing lows within 3% of each other separated by at least 5 bars
  const swingLows: { idx: number; price: number }[] = [];
  for (let i = 2; i < lows.length - 2; i++) {
    if (
      lows[i] < lows[i - 1] &&
      lows[i] < lows[i - 2] &&
      lows[i] < lows[i + 1] &&
      lows[i] < lows[i + 2]
    ) {
      swingLows.push({ idx: i, price: lows[i] });
    }
  }
  if (swingLows.length < 2) return null;
  const lastTwo = swingLows.slice(-3);
  for (let a = 0; a < lastTwo.length; a++) {
    for (let b = a + 1; b < lastTwo.length; b++) {
      const la = lastTwo[a],
        lb = lastTwo[b];
      if (lb.idx - la.idx >= 5) {
        const diff =
          Math.abs(la.price - lb.price) / ((la.price + lb.price) / 2);
        if (
          diff < 0.03 &&
          closes[closes.length - 1] >
            Math.max(...closes.slice(la.idx, lb.idx + 1))
        ) {
          return {
            type: "double_bottom",
            confidence: 68,
            level: Math.max(...closes.slice(la.idx, lb.idx + 1)),
            context: `Double bottom near ${((la.price + lb.price) / 2).toFixed(
              2
            )} with neckline break`,
          };
        }
      }
    }
  }
  return null;
}

function detectDoubleTop(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 50) return null;
  const highs = candles.map((c) => c.high);
  const closes = candles.map((c) => c.close);
  const swingHighs: { idx: number; price: number }[] = [];
  for (let i = 2; i < highs.length - 2; i++) {
    if (
      highs[i] > highs[i - 1] &&
      highs[i] > highs[i - 2] &&
      highs[i] > highs[i + 1] &&
      highs[i] > highs[i + 2]
    ) {
      swingHighs.push({ idx: i, price: highs[i] });
    }
  }
  if (swingHighs.length < 2) return null;
  const lastTwo = swingHighs.slice(-3);
  for (let a = 0; a < lastTwo.length; a++) {
    for (let b = a + 1; b < lastTwo.length; b++) {
      const ha = lastTwo[a],
        hb = lastTwo[b];
      if (hb.idx - ha.idx >= 5) {
        const diff =
          Math.abs(ha.price - hb.price) / ((ha.price + hb.price) / 2);
        if (
          diff < 0.03 &&
          closes[closes.length - 1] <
            Math.min(...closes.slice(ha.idx, hb.idx + 1))
        ) {
          return {
            type: "double_top",
            confidence: 68,
            level: Math.min(...closes.slice(ha.idx, hb.idx + 1)),
            context: `Double top near ${((ha.price + hb.price) / 2).toFixed(
              2
            )} with neckline break`,
          };
        }
      }
    }
  }
  return null;
}

function detectFlagOrPennant(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 40) return null;
  const recent = getRecentSlice(candles, 30);
  const closes = recent.map((c) => c.close);
  const highs = recent.map((c) => c.high);
  const lows = recent.map((c) => c.low);
  const change = (closes[closes.length - 1] - closes[0]) / closes[0];
  const range =
    (Math.max(...highs) - Math.min(...lows)) / closes[closes.length - 1];
  // crude: strong prior move and then contracting range
  const last10 = recent.slice(-10);
  const last10Range =
    (Math.max(...last10.map((c) => c.high)) -
      Math.min(...last10.map((c) => c.low))) /
    closes[closes.length - 1];
  if (Math.abs(change) > 0.08 && last10Range < range * 0.6) {
    const bullish = change > 0;
    return {
      type: "flag",
      confidence: 65,
      context: `${
        bullish ? "Bullish" : "Bearish"
      } flag/pennant after ${Math.round(
        change * 100
      )}% move with contracting range`,
    };
  }
  return null;
}

export function detectPatterns(candles: Candle[]): PatternDetectionResult {
  const patterns: DetectedPattern[] = [];
  const detectors = [
    detectBreakout,
    detectPullbackToSMA20,
    detectDoubleBottom,
    detectDoubleTop,
    detectFlagOrPennant,
  ];
  for (const fn of detectors) {
    try {
      const result = fn(candles);
      if (result) patterns.push(result);
    } catch {}
  }
  // Sort by confidence desc
  patterns.sort((a, b) => b.confidence - a.confidence);
  return { patterns };
}
