import { useMemo } from 'react';

interface SentimentCounts {
  positive: number;
  negative: number;
  neutral: number;
}

interface SentimentSummary {
  overall: "bullish" | "bearish" | "neutral";
  confidence: number;
}

export function useSymbolSentimentSummary(
  symbolSentimentCounts: SentimentCounts | null
): SentimentSummary | null {
  return useMemo(() => {
    if (!symbolSentimentCounts) return null;

    const total =
      symbolSentimentCounts.positive +
      symbolSentimentCounts.negative +
      symbolSentimentCounts.neutral;

    if (total === 0) return null;

    const pos = symbolSentimentCounts.positive / total;
    const neg = symbolSentimentCounts.negative / total;

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
  }, [symbolSentimentCounts]);
}