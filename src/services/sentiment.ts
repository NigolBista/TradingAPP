import Constants from "expo-constants";
import { NewsItem } from "./marketProviders";

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

export interface SentimentAnalysis {
  label: "Very Positive" | "Positive" | "Neutral" | "Negative" | "Very Negative";
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  keywords: {
    positive: string[];
    negative: string[];
  };
  summary: string;
  marketImpact: "bullish" | "bearish" | "neutral";
  urgency: "low" | "medium" | "high";
}

const POSITIVE_KEYWORDS = [
  "surge", "soar", "rally", "gain", "profit", "beat", "exceed", "growth", "strong",
  "bullish", "positive", "upgrade", "buy", "breakout", "momentum", "record",
  "expansion", "acquisition", "partnership", "success", "outperform", "upside",
  "earnings beat", "revenue growth", "margin expansion", "guidance raise"
];

const NEGATIVE_KEYWORDS = [
  "plunge", "crash", "fall", "drop", "loss", "miss", "decline", "weak", "bearish",
  "negative", "downgrade", "sell", "breakdown", "concerns", "risk", "cut",
  "recession", "bankruptcy", "lawsuit", "investigation", "warning", "downside",
  "earnings miss", "revenue decline", "margin compression", "guidance cut"
];

const MARKET_MOVING_KEYWORDS = [
  "earnings", "fed", "federal reserve", "inflation", "gdp", "jobs report",
  "unemployment", "interest rate", "merger", "acquisition", "ipo", "split",
  "dividend", "guidance", "forecast", "analyst", "upgrade", "downgrade",
  "cpi", "ppi", "fomc", "nonfarm payrolls", "retail sales", "consumer confidence"
];

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

export class NewsAnalyzer {
  static analyzeSentiment(text: string): SentimentAnalysis {
    const words = text.toLowerCase().split(/\s+/);
    
    let positiveScore = 0;
    let negativeScore = 0;
    const foundPositive: string[] = [];
    const foundNegative: string[] = [];
    
    // Count sentiment words with weighted scoring
    words.forEach(word => {
      POSITIVE_KEYWORDS.forEach(keyword => {
        if (word.includes(keyword) || keyword.includes(word)) {
          positiveScore += 1;
          if (!foundPositive.includes(keyword)) {
            foundPositive.push(keyword);
          }
        }
      });
      
      NEGATIVE_KEYWORDS.forEach(keyword => {
        if (word.includes(keyword) || keyword.includes(word)) {
          negativeScore += 1;
          if (!foundNegative.includes(keyword)) {
            foundNegative.push(keyword);
          }
        }
      });
    });
    
    // Calculate normalized score (-1 to 1)
    const totalScore = positiveScore - negativeScore;
    const maxPossibleScore = Math.max(POSITIVE_KEYWORDS.length, NEGATIVE_KEYWORDS.length);
    const normalizedScore = Math.max(-1, Math.min(1, totalScore / (maxPossibleScore * 0.3)));
    
    // Determine label and confidence
    let label: SentimentAnalysis["label"];
    let confidence = Math.min(1, Math.abs(normalizedScore) * 2);
    
    if (normalizedScore > 0.6) label = "Very Positive";
    else if (normalizedScore > 0.2) label = "Positive";
    else if (normalizedScore > -0.2) label = "Neutral";
    else if (normalizedScore > -0.6) label = "Negative";
    else label = "Very Negative";
    
    // Determine market impact
    let marketImpact: "bullish" | "bearish" | "neutral" = "neutral";
    if (normalizedScore > 0.3) marketImpact = "bullish";
    else if (normalizedScore < -0.3) marketImpact = "bearish";
    
    // Determine urgency based on market-moving keywords
    let urgency: "low" | "medium" | "high" = "low";
    const marketMovingCount = MARKET_MOVING_KEYWORDS.filter(keyword => 
      text.toLowerCase().includes(keyword)
    ).length;
    
    if (marketMovingCount > 2) urgency = "high";
    else if (marketMovingCount > 0) urgency = "medium";
    
    // Generate summary
    const summary = this.generateSummary(normalizedScore, foundPositive, foundNegative, urgency);
    
    return {
      label,
      score: normalizedScore,
      confidence,
      keywords: {
        positive: foundPositive,
        negative: foundNegative
      },
      summary,
      marketImpact,
      urgency
    };
  }
  
  private static generateSummary(score: number, positive: string[], negative: string[], urgency: string): string {
    if (Math.abs(score) < 0.1) {
      return "Neutral sentiment with balanced positive and negative indicators.";
    }
    
    if (score > 0) {
      const strength = score > 0.6 ? "Very strong" : score > 0.3 ? "Strong" : "Moderate";
      return `${strength} positive sentiment detected. Key drivers: ${positive.slice(0, 3).join(", ")}. ${urgency === "high" ? "High market impact expected." : ""}`;
    } else {
      const strength = score < -0.6 ? "Very strong" : score < -0.3 ? "Strong" : "Moderate";
      return `${strength} negative sentiment detected. Key concerns: ${negative.slice(0, 3).join(", ")}. ${urgency === "high" ? "High market impact expected." : ""}`;
    }
  }
}

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

export async function analyzeNewsWithEnhancedSentiment(news: NewsItem[]): Promise<SentimentAnalysis> {
  if (!news || news.length === 0) {
    return {
      label: "Neutral",
      score: 0,
      confidence: 0,
      keywords: { positive: [], negative: [] },
      summary: "No news available for analysis",
      marketImpact: "neutral",
      urgency: "low"
    };
  }
  
  // Try AI analysis first
  const openaiApiKey = (Constants.expoConfig?.extra as any)?.openaiApiKey;
  if (openaiApiKey && news.length > 0) {
    try {
      return await analyzeNewsWithAI(news, openaiApiKey);
    } catch (error) {
      console.warn("AI news analysis failed, falling back to local analysis:", error);
    }
  }
  
  // Fallback to local analysis
  const combinedText = news
    .slice(0, 10) // Analyze up to 10 most recent articles
    .map(item => `${item.title} ${item.summary || ""}`)
    .join(" ");
  
  return NewsAnalyzer.analyzeSentiment(combinedText);
}

async function analyzeNewsWithAI(news: NewsItem[], apiKey: string): Promise<SentimentAnalysis> {
  const articles = news.slice(0, 5).map(item => ({
    title: item.title,
    summary: item.summary || "",
    source: item.source
  }));
  
  const prompt = `Analyze the sentiment and market impact of these news articles:

${articles.map((article, i) => `${i + 1}. ${article.title}\n${article.summary}`).join("\n\n")}

Provide analysis in this JSON format:
{
  "sentiment_score": <number between -1 and 1>,
  "label": "<Very Positive|Positive|Neutral|Negative|Very Negative>",
  "confidence": <number between 0 and 1>,
  "market_impact": "<bullish|bearish|neutral>",
  "urgency": "<low|medium|high>",
  "summary": "<brief explanation>",
  "positive_keywords": ["keyword1", "keyword2"],
  "negative_keywords": ["keyword1", "keyword2"]
}

Focus on market-moving news like earnings, Fed announcements, economic data, etc.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a financial news sentiment analyst. Provide accurate, objective analysis of market impact."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 500
    }),
  });
  
  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content?.trim();
  
  if (!content) throw new Error("No AI response");
  
  try {
    const parsed = JSON.parse(content);
    return {
      label: parsed.label,
      score: parsed.sentiment_score,
      confidence: parsed.confidence,
      keywords: {
        positive: parsed.positive_keywords || [],
        negative: parsed.negative_keywords || []
      },
      summary: parsed.summary,
      marketImpact: parsed.market_impact,
      urgency: parsed.urgency
    };
  } catch (parseError) {
    throw new Error("Failed to parse AI response");
  }
}

export function getNewsAlerts(sentiment: SentimentAnalysis): string[] {
  const alerts: string[] = [];
  
  if (sentiment.urgency === "high") {
    alerts.push("🚨 HIGH IMPACT NEWS DETECTED");
  }
  
  if (Math.abs(sentiment.score) > 0.7) {
    const direction = sentiment.score > 0 ? "EXTREMELY POSITIVE" : "EXTREMELY NEGATIVE";
    alerts.push(`📰 ${direction} NEWS SENTIMENT`);
  }
  
  if (sentiment.marketImpact === "bullish" && sentiment.confidence > 0.7) {
    alerts.push("🟢 BULLISH NEWS CATALYST");
  } else if (sentiment.marketImpact === "bearish" && sentiment.confidence > 0.7) {
    alerts.push("🔴 BEARISH NEWS CATALYST");
  }
  
  return alerts;
}