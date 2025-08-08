import Constants from "expo-constants";
import type { NewsItem } from "./marketProviders";

export type SentimentLabel = "bullish" | "bearish" | "neutral";

export interface NewsSentimentItem {
  id: string;
  score: number; // -1..1
  label: SentimentLabel;
}

export interface SentimentSummary {
  overallScore: number; // -1..1
  label: SentimentLabel;
  items: NewsSentimentItem[];
}

const POSITIVE = [
  "beats",
  "surge",
  "rally",
  "record",
  "upgrade",
  "outperform",
  "growth",
  "strong",
  "bullish",
  "optimistic",
];
const NEGATIVE = [
  "miss",
  "drop",
  "plunge",
  "downgrade",
  "underperform",
  "weak",
  "bearish",
  "lawsuit",
  "investigation",
  "concern",
];

function naiveScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  POSITIVE.forEach((k) => {
    if (lower.includes(k)) score += 1;
  });
  NEGATIVE.forEach((k) => {
    if (lower.includes(k)) score -= 1;
  });
  // normalize roughly to -1..1
  return Math.max(-1, Math.min(1, score / 3));
}

function labelFor(score: number): SentimentLabel {
  if (score > 0.15) return "bullish";
  if (score < -0.15) return "bearish";
  return "neutral";
}

export async function analyzeNewsSentiment(
  items: NewsItem[]
): Promise<SentimentSummary> {
  const { openaiApiKey } = (Constants.expoConfig?.extra || {}) as any;
  if (openaiApiKey && items.length) {
    try {
      const prompt = `Score the following news headlines for stock market sentiment on a -1 to 1 scale (bearish to bullish). Return JSON array [{id, score}]. Headlines: ${items
        .map((i) => `(${i.id}) ${i.title}`)
        .join("; ")}`;
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You output valid JSON only." },
            { role: "user", content: prompt },
          ],
          temperature: 0,
        }),
      });
      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "[]";
      const arr = JSON.parse(content);
      const byId: Record<string, number> = {};
      arr.forEach((x: any) => {
        if (x && typeof x.id === "string" && typeof x.score === "number") {
          byId[x.id] = Math.max(-1, Math.min(1, x.score));
        }
      });
      const scored: NewsSentimentItem[] = items.map((i) => {
        const s = byId[i.id] ?? naiveScore(i.title || "");
        return { id: i.id, score: s, label: labelFor(s) };
      });
      const overall = scored.reduce((a, b) => a + b.score, 0) / scored.length;
      return { overallScore: overall, label: labelFor(overall), items: scored };
    } catch {
      // fall through to naive
    }
  }

  const scored: NewsSentimentItem[] = items.map((i) => {
    const s = naiveScore(i.title || "");
    return { id: i.id, score: s, label: labelFor(s) };
  });
  const overall = scored.length
    ? scored.reduce((a, b) => a + b.score, 0) / scored.length
    : 0;
  return { overallScore: overall, label: labelFor(overall), items: scored };
}
