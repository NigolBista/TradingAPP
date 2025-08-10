import { NewsItem } from "./newsProviders";
import {
  EnhancedSignal,
  buildSignalContext,
  enrichSignalsWithPatternsAndRisk,
} from "./signalEngine";

export type EventType =
  | "buyback"
  | "dividend_hike"
  | "ceo_exit"
  | "contract_win"
  | "layoffs"
  | "upgrade"
  | "downgrade"
  | "guidance_raise"
  | "guidance_cut"
  | "mna";

export interface EventSignal {
  symbol: string;
  event: EventType;
  headline: string;
  timestamp?: string;
  action: "buy" | "sell" | "hold";
  confidence: number; // 0-100
  rationale: string[];
}

const EVENT_KEYWORDS: Record<EventType, string[]> = {
  buyback: ["buyback", "repurchase", "share repurchase"],
  dividend_hike: ["dividend increase", "raises dividend", "dividend hike"],
  ceo_exit: ["ceo resigns", "ceo steps down", "ceo exit"],
  contract_win: [
    "award",
    "wins contract",
    "billion dollar contract",
    "deal win",
  ],
  layoffs: ["layoffs", "job cuts", "restructuring"],
  upgrade: ["upgrade", "raises rating", "initiated overweight"],
  downgrade: ["downgrade", "lowers rating", "initiated underweight"],
  guidance_raise: ["raises guidance", "lifts outlook", "boosts forecast"],
  guidance_cut: ["cuts guidance", "lowers outlook", "reduces forecast"],
  mna: ["acquires", "merger", "acquisition", "to buy"],
};

function detectEvent(headline: string): EventType | null {
  const text = headline.toLowerCase();
  for (const [type, words] of Object.entries(EVENT_KEYWORDS) as [
    EventType,
    string[]
  ][]) {
    if (words.some((w) => text.includes(w))) return type;
  }
  return null;
}

function defaultActionAndConfidence(event: EventType): {
  action: "buy" | "sell";
  confidence: number;
  rationale: string[];
} {
  switch (event) {
    case "buyback":
    case "dividend_hike":
    case "contract_win":
    case "upgrade":
    case "guidance_raise":
    case "mna":
      return {
        action: "buy",
        confidence: 75,
        rationale: ["Positive corporate action historically bullish"],
      };
    case "layoffs":
    case "guidance_cut":
    case "downgrade":
    case "ceo_exit":
      return {
        action: "sell",
        confidence: 65,
        rationale: ["Negative corporate signal historically bearish"],
      };
    default:
      return { action: "hold", confidence: 50, rationale: ["Unclear impact"] };
  }
}

export async function generateEventSignals(
  symbol: string,
  news: NewsItem[]
): Promise<EventSignal[]> {
  const signals: EventSignal[] = [];
  for (const n of news.slice(0, 10)) {
    const type = detectEvent(n.title || n.summary || "");
    if (!type) continue;
    const base = defaultActionAndConfidence(type);
    signals.push({
      symbol,
      event: type,
      headline: n.title || "",
      timestamp: n.publishedAt,
      action: base.action,
      confidence: base.confidence,
      rationale: base.rationale,
    });
  }
  return signals;
}
