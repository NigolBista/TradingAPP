import Constants from "expo-constants";
import OpenAI from "openai";
import {
  getGlobalMarketData,
  refreshGlobalCache,
  getAllCachedData,
  getCachedNews,
} from "./marketDataCache";
import type { NewsItem, TrendingStock, MarketEvent } from "./newsProviders";
import type { FedEvent, EconomicIndicator } from "./federalReserve";

// Export the global cache functions for backward compatibility
export const refreshMarketDataCache = refreshGlobalCache;
export const getCachedNewsData = getCachedNews;
export const getAllCachedMarketData = getAllCachedData;

/**
 * Generates market overview and returns both analysis and raw data
 * This is the most efficient way to get both AI analysis and news data
 */
export async function generateMarketOverviewWithData(
  options: MarketOverviewRequest = {}
): Promise<{
  overview: MarketOverview;
  rawData: {
    news: NewsItem[];
    trendingStocks: TrendingStock[];
    marketEvents: MarketEvent[];
  };
}> {
  const overview = await generateMarketOverview(options);

  // Since generateMarketOverview already fetched and cached the data,
  // we can get it from global cache without additional API calls
  const cachedData = getAllCachedData();

  return {
    overview,
    rawData: {
      news: cachedData.news,
      trendingStocks: cachedData.trendingStocks,
      marketEvents: cachedData.marketEvents,
    },
  };
}

export interface MarketOverview {
  summary: string;
  keyHighlights: string[];
  topStories: NewsItem[];
  trendingStocks: TrendingStock[];
  upcomingEvents: MarketEvent[];
  fedEvents: any[]; // Federal Reserve events
  economicIndicators: any[]; // Key economic indicators
  lastUpdated: string;
  marketSentiment?: {
    overall: "bullish" | "bearish" | "neutral";
    confidence: number;
    factors: string[];
  };
  dayAheadInsights?: {
    keyEvents: string[];
    watchList: string[];
    riskFactors: string[];
    opportunities: string[];
  };
  timeframeSpecificInsights?: {
    shortTerm: string; // 1D insights
    mediumTerm: string; // 1W insights
    longTerm: string; // 1M insights
  };
}

export interface MarketOverviewRequest {
  includeEvents?: boolean;
  includeTrending?: boolean;
  newsCount?: number;
  analysisDepth?: "brief" | "detailed";
  timeframe?: "1D" | "1W" | "1M";
}

/**
 * Generates a comprehensive market overview using AI analysis of current news
 */
export async function generateMarketOverview(
  options: MarketOverviewRequest = {}
): Promise<MarketOverview> {
  const {
    includeEvents = true,
    includeTrending = true,
    newsCount = 30,
    analysisDepth = "detailed",
    timeframe = "1D",
  } = options;

  const marketData = await getGlobalMarketData(
    newsCount,
    includeTrending,
    includeEvents
  );

  const {
    news: marketNews,
    trendingStocks,
    marketEvents,
    fedEvents,
    economicIndicators,
  } = marketData;

  try {
    const aiSummary = await generateAIMarketSummary(
      marketNews,
      trendingStocks,
      marketEvents,
      fedEvents,
      economicIndicators,
      analysisDepth,
      timeframe
    );

    const {
      summary,
      keyHighlights,
      marketSentiment,
      dayAheadInsights,
      timeframeSpecificInsights,
    } = parseAIResponse(aiSummary);

    return {
      summary,
      keyHighlights,
      topStories: marketNews.slice(0, 10),
      trendingStocks,
      upcomingEvents: marketEvents,
      fedEvents: fedEvents
        .filter((fe) => fe.impact === "high" || fe.impact === "medium")
        .slice(0, 5),
      economicIndicators: economicIndicators.slice(0, 5),
      lastUpdated: new Date().toISOString(),
      ...(marketSentiment && { marketSentiment }),
      ...(dayAheadInsights && { dayAheadInsights }),
      ...(timeframeSpecificInsights && {
        timeframeSpecificInsights: {
          shortTerm: timeframe === "1D" ? timeframeSpecificInsights : "",
          mediumTerm: timeframe === "1W" ? timeframeSpecificInsights : "",
          longTerm: timeframe === "1M" ? timeframeSpecificInsights : "",
        },
      }),
    };
  } catch (error) {
    console.error("❌ Market Overview Error:", error);
    return buildFallbackOverview(
      marketNews,
      trendingStocks,
      marketEvents,
      fedEvents,
      economicIndicators,
      timeframe
    );
  }
}

function buildFallbackOverview(
  marketNews: NewsItem[],
  trendingStocks: TrendingStock[],
  marketEvents: MarketEvent[],
  fedEvents: FedEvent[],
  economicIndicators: EconomicIndicator[],
  timeframe: "1D" | "1W" | "1M"
): MarketOverview {
  const summary = buildHeuristicSummary(
    marketNews,
    fedEvents,
    economicIndicators,
    timeframe
  );
  const keyHighlights = buildHeuristicHighlights(
    marketNews,
    marketEvents,
    fedEvents,
    trendingStocks
  );
  const sentiment = computeFallbackSentiment(trendingStocks, economicIndicators);
  const dayAhead = buildFallbackDayAhead(
    marketEvents,
    fedEvents,
    trendingStocks,
    economicIndicators
  );

  const base: MarketOverview = {
    summary,
    keyHighlights:
      keyHighlights.length > 0
        ? keyHighlights
        : [
            "Monitor top market headlines",
            "Track upcoming macro events",
            "Review trending tickers",
          ],
    topStories: marketNews.slice(0, 10),
    trendingStocks,
    upcomingEvents: marketEvents,
    fedEvents: fedEvents.slice(0, 5),
    economicIndicators: economicIndicators.slice(0, 5),
    lastUpdated: new Date().toISOString(),
  };

  if (sentiment) {
    base.marketSentiment = sentiment;
  }

  if (
    dayAhead.keyEvents.length > 0 ||
    dayAhead.watchList.length > 0 ||
    dayAhead.riskFactors.length > 0 ||
    dayAhead.opportunities.length > 0
  ) {
    base.dayAheadInsights = dayAhead;
  }

  return base;
}

function buildHeuristicSummary(
  news: NewsItem[],
  fedEvents: FedEvent[],
  economicIndicators: EconomicIndicator[],
  timeframe: "1D" | "1W" | "1M"
): string {
  const parts: string[] = [];
  const timeframeLabel =
    timeframe === "1D" ? "today" : timeframe === "1W" ? "this week" : "this month";

  if (news.length > 0 && news[0]?.title) {
    parts.push(`Top story ${timeframeLabel}: ${news[0].title}`);
  }

  if (fedEvents.length > 0) {
    parts.push(
      `Fed focus: ${fedEvents[0].title} (${formatMonthDay(fedEvents[0].date)})`
    );
  }

  if (economicIndicators.length > 0) {
    parts.push(formatIndicatorLine(economicIndicators[0]));
  }

  if (parts.length === 0) {
    return "Monitoring key market catalysts while additional data loads.";
  }

  return `${parts.join(". ")}.`;
}

function buildHeuristicHighlights(
  news: NewsItem[],
  marketEvents: MarketEvent[],
  fedEvents: FedEvent[],
  trendingStocks: TrendingStock[]
): string[] {
  const highlights: string[] = [];

  news
    .slice(0, 3)
    .filter((item) => item?.title)
    .forEach((item) => highlights.push(`Headline: ${item.title}`));

  fedEvents.slice(0, 2).forEach((event) =>
    highlights.push(`Fed: ${event.title} on ${formatMonthDay(event.date)}`)
  );

  marketEvents.slice(0, 2).forEach((event) =>
    highlights.push(`Event: ${event.title} (${event.impact.toLowerCase()})`)
  );

  if (trendingStocks.length > 0) {
    const leaders = trendingStocks
      .slice(0, 3)
      .map((stock) => `${stock.ticker} (${stock.sentiment.toLowerCase()})`)
      .join(", ");
    highlights.push(`Trending: ${leaders}`);
  }

  return highlights.slice(0, 6);
}

function computeFallbackSentiment(
  trendingStocks: TrendingStock[],
  economicIndicators: EconomicIndicator[]
): MarketOverview["marketSentiment"] | undefined {
  if (!trendingStocks || trendingStocks.length === 0) return undefined;

  let score = 0;
  trendingStocks.forEach((stock) => {
    if (stock.sentiment === "Positive") score += 1;
    else if (stock.sentiment === "Negative") score -= 1;
  });

  const normalized = score / trendingStocks.length;
  let overall: "bullish" | "bearish" | "neutral" = "neutral";
  if (normalized > 0.2) overall = "bullish";
  else if (normalized < -0.2) overall = "bearish";

  const confidence = Math.min(
    95,
    Math.max(35, Math.abs(normalized) * 100 + (economicIndicators.length > 0 ? 10 : 0))
  );

  const factors: string[] = [];

  if (trendingStocks.length > 0) {
    const leaders = trendingStocks
      .slice(0, 3)
      .map((stock) => `${stock.ticker} ${stock.sentiment.toLowerCase()}`)
      .join(", ");
    factors.push(`Leaders: ${leaders}`);
  }

  if (economicIndicators.length > 0) {
    factors.push(formatIndicatorLine(economicIndicators[0]));
  }

  return {
    overall,
    confidence,
    factors,
  };
}

function buildFallbackDayAhead(
  marketEvents: MarketEvent[],
  fedEvents: FedEvent[],
  trendingStocks: TrendingStock[],
  economicIndicators: EconomicIndicator[]
): Required<NonNullable<MarketOverview["dayAheadInsights"]>> {
  const keyEvents = [
    ...fedEvents
      .slice(0, 3)
      .map((event) => `${formatMonthDay(event.date)}: ${event.title}`),
    ...marketEvents
      .slice(0, 3)
      .map((event) => `${formatMonthDay(event.date)}: ${event.title}`),
  ].slice(0, 4);

  const watchList = trendingStocks
    .slice(0, 4)
    .map((stock) => `${stock.ticker}: ${stock.sentiment}`);

  const riskFactors = economicIndicators
    .slice(0, 3)
    .map((indicator) => formatIndicatorLine(indicator));

  const opportunities = trendingStocks
    .filter((stock) => stock.sentiment === "Positive")
    .slice(0, 3)
    .map(
      (stock) =>
        `${stock.ticker}: momentum building (${stock.mentions} mentions)`
    );

  return {
    keyEvents,
    watchList,
    riskFactors,
    opportunities,
  };
}

function formatMonthDay(dateIso?: string): string {
  if (!dateIso) return "";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatIndicatorLine(indicator: EconomicIndicator): string {
  const change =
    indicator.changePercent !== undefined
      ? ` (${indicator.changePercent > 0 ? "+" : ""}${indicator.changePercent.toFixed(
          1
        )}%)`
      : indicator.change !== undefined
      ? ` (${indicator.change > 0 ? "+" : ""}${indicator.change})`
      : "";
  return `${indicator.title}: ${indicator.value}${indicator.unit || ""}${change}`;
}

/**
 * Uses OpenAI to analyze market data and generate insights
 */
async function generateAIMarketSummary(
  news: NewsItem[],
  trending: TrendingStock[],
  events: MarketEvent[],
  fedEvents: any[],
  economicIndicators: any[],
  depth: "brief" | "detailed",
  timeframe: "1D" | "1W" | "1M" = "1D"
): Promise<string> {
  const { openaiApiKey } = (Constants.expoConfig?.extra || {}) as any;

  console.log(
    "🔑 OpenAI API Key check:",
    openaiApiKey ? `Present (${openaiApiKey.substring(0, 10)}...)` : "Missing"
  );

  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  // Initialize OpenAI client
  const client = new OpenAI({
    apiKey: openaiApiKey,
  });

  // Prepare context for AI analysis
  const newsContext = news.slice(0, 20).map((n) => ({
    title: n.title,
    summary: n.summary?.substring(0, 200) || "",
    sentiment: n.sentiment,
    source: n.source,
    tickers: n.tickers?.slice(0, 3) || [],
  }));

  const trendingContext = trending.slice(0, 10).map((t) => ({
    ticker: t.ticker,
    company: t.company_name,
    mentions: t.mentions,
    sentiment: t.sentiment,
  }));

  const eventsContext = events.slice(0, 5).map((e) => ({
    title: e.title,
    description: e.description?.substring(0, 150) || "",
    impact: e.impact,
    date: e.date,
  }));

  const fedEventsContext = fedEvents.slice(0, 5).map((fe) => ({
    title: fe.title,
    description: fe.description?.substring(0, 150) || "",
    type: fe.type,
    impact: fe.impact,
    date: fe.date,
    category: fe.category,
  }));

  const economicContext = economicIndicators.slice(0, 8).map((ei) => ({
    title: ei.title,
    value: ei.value,
    unit: ei.unit,
    change: ei.change,
    changePercent: ei.changePercent,
    date: ei.date,
  }));

  const prompt =
    depth === "brief"
      ? createBriefAnalysisPrompt(
          newsContext,
          trendingContext,
          eventsContext,
          fedEventsContext,
          economicContext,
          timeframe
        )
      : createDetailedAnalysisPrompt(
          newsContext,
          trendingContext,
          eventsContext,
          fedEventsContext,
          economicContext,
          timeframe
        );

  try {
    console.log("🤖 Calling OpenAI API with model: gpt-5-mini");

    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional financial analyst providing market overviews. Be concise, accurate, and focus on actionable insights. Always structure your response with clear sections.",
        },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: depth === "brief" ? 800 : 1200,
    });

    const aiResponse = response.choices[0]?.message?.content?.trim();

    if (!aiResponse) {
      throw new Error("No response from OpenAI");
    }

    console.log("✅ OpenAI API response received successfully");
    return aiResponse;
  } catch (error: any) {
    console.error("❌ OpenAI API Error Details:");
    console.error("- Error message:", error?.message);
    console.error("- Error status:", error?.status);
    console.error("- Error code:", error?.code);
    console.error("- Full error:", error);
    throw error;
  }
}

function createBriefAnalysisPrompt(
  news: any[],
  trending: any[],
  events: any[],
  fedEvents: any[],
  economicIndicators: any[],
  timeframe: "1D" | "1W" | "1M" = "1D"
): string {
  const briefTimeframeContext = {
    "1D": {
      title: "today's market conditions",
      focus: "what investors should know today",
      summary: "2-3 sentence overview of today's market conditions",
      highlights: "4-5 bullet points of today's most important developments",
    },
    "1W": {
      title: "this week's market outlook",
      focus: "what to watch for in the upcoming week",
      summary:
        "2-3 sentence overview of this week's market outlook and key events",
      highlights:
        "4-5 bullet points of upcoming developments and opportunities this week",
    },
    "1M": {
      title: "monthly market trends",
      focus: "key trends and events to monitor this month",
      summary:
        "2-3 sentence overview of monthly market trends and major themes",
      highlights:
        "4-5 bullet points of significant trends and upcoming events this month",
    },
  };

  const context = briefTimeframeContext[timeframe];

  return `Analyze ${context.title} and provide a brief overview.

NEWS HEADLINES (${news.length} items):
${news
  .map((n) => `• ${n.title} [${n.sentiment || "Neutral"}] - ${n.summary}`)
  .join("\n")}

TRENDING STOCKS (${trending.length} items):
${trending
  .map(
    (t) =>
      `• ${t.ticker} (${t.company}): ${t.mentions} mentions, ${t.sentiment} sentiment`
  )
  .join("\n")}

UPCOMING EVENTS (${events.length} items):
${events
  .map((e) => `• ${e.title} [${e.impact} impact] - ${e.description}`)
  .join("\n")}

FEDERAL RESERVE EVENTS (${fedEvents.length} items):
${fedEvents
  .map(
    (fe) =>
      `• ${fe.title} [${fe.type}, ${fe.impact} impact] - ${fe.description}`
  )
  .join("\n")}

ECONOMIC INDICATORS (${economicIndicators.length} items):
${economicIndicators
  .map(
    (ei) =>
      `• ${ei.title}: ${ei.value}${ei.unit} ${
        ei.changePercent
          ? `(${ei.changePercent > 0 ? "+" : ""}${ei.changePercent.toFixed(
              1
            )}%)`
          : ""
      }`
  )
  .join("\n")}

Provide a structured response with:
1. SUMMARY: ${context.summary} (do NOT include bullet points here)
2. KEY_HIGHLIGHTS: ${context.highlights} (use bullet points starting with •)
3. Focus on ${context.focus}

IMPORTANT: Keep the SUMMARY as a paragraph without bullet points. Put all bullet points only in KEY_HIGHLIGHTS section.`;
}

function createDetailedAnalysisPrompt(
  news: any[],
  trending: any[],
  events: any[],
  fedEvents: any[],
  economicIndicators: any[],
  timeframe: "1D" | "1W" | "1M" = "1D"
): string {
  const detailedTimeframeContext = {
    "1D": {
      focus:
        "today's trading session, intraday opportunities, and immediate market reactions",
      horizon: "next 24 hours",
      actionItems:
        "key levels to watch, earnings reactions, economic data releases",
    },
    "1W": {
      focus:
        "this week's major events, earnings season impact, and short-term trends",
      horizon: "next 5-7 trading days",
      actionItems:
        "weekly technical levels, FOMC meetings, major earnings, economic calendar",
    },
    "1M": {
      focus: "monthly trends, sector rotation, and longer-term market themes",
      horizon: "next 30 days",
      actionItems:
        "monthly support/resistance, policy changes, seasonal patterns",
    },
  };

  const context = detailedTimeframeContext[timeframe];
  const timeframeContext = {
    "1D": "today's developments",
    "1W": "this week's market outlook and upcoming developments",
    "1M": "monthly market trends and significant developments",
  };

  return `Provide a comprehensive market analysis based on ${
    timeframeContext[timeframe]
  }.

MARKET NEWS ANALYSIS (${news.length} headlines):
${news
  .map(
    (n) =>
      `• ${n.title} [${n.sentiment || "Neutral"}] - ${n.summary} (Source: ${
        n.source
      })`
  )
  .join("\n")}

TRENDING STOCKS (${trending.length} most mentioned):
${trending
  .map(
    (t) =>
      `• ${t.ticker} (${t.company}): ${t.mentions} mentions, ${t.sentiment} sentiment`
  )
  .join("\n")}

MARKET EVENTS & CATALYSTS (${events.length} upcoming):
${events
  .map(
    (e) =>
      `• ${e.title} [${e.impact} impact] - ${e.description} (Date: ${e.date})`
  )
  .join("\n")}

FEDERAL RESERVE & MONETARY POLICY (${fedEvents.length} events):
${fedEvents
  .map(
    (fe) =>
      `• ${fe.title} [${fe.type}, ${fe.impact} impact] - ${fe.description} (${fe.category})`
  )
  .join("\n")}

ECONOMIC INDICATORS & DATA (${economicIndicators.length} key metrics):
${economicIndicators
  .map(
    (ei) =>
      `• ${ei.title}: ${ei.value}${ei.unit} ${
        ei.changePercent
          ? `(${ei.changePercent > 0 ? "+" : ""}${ei.changePercent.toFixed(
              1
            )}% change)`
          : ""
      } [${ei.date}]`
  )
  .join("\n")}

Provide a comprehensive analysis with:

1. EXECUTIVE_SUMMARY: 3-4 sentences capturing the overall market narrative and key themes for ${
    context.horizon
  }

2. KEY_HIGHLIGHTS: 8-10 critical points covering:
   - Major market movers and catalysts
   - Federal Reserve meetings, policy decisions, and economic data
   - Sector rotation or themes  
   - Economic indicators (CPI, PPI, employment, etc.) and policy impacts
   - Notable earnings or corporate developments
   - Technical levels or market structure
   - Risk factors to monitor
   - ${context.actionItems}

3. MARKET_SENTIMENT: Overall market sentiment (BULLISH/BEARISH/NEUTRAL) with confidence level

4. DAY_AHEAD_INSIGHTS: Specific actionable insights for ${context.focus}:
   - KEY_EVENTS: Top 3-5 events to watch
   - WATCH_LIST: Stocks/sectors to monitor closely
   - RISK_FACTORS: Key risks that could impact markets
   - OPPORTUNITIES: Potential trading/investment opportunities

5. TIMEFRAME_INSIGHTS: Specific insights for ${timeframe} timeframe focusing on ${
    context.focus
  }

6. TRENDING_FOCUS: Brief analysis of why certain stocks are trending

7. OUTLOOK: What to watch for in ${context.horizon}

Structure your response clearly and focus on actionable insights for traders and investors.`;
}

/**
 * Parses the AI response to extract structured data
 */
function parseAIResponse(aiResponse: string): {
  summary: string;
  keyHighlights: string[];
  marketSentiment?: {
    overall: "bullish" | "bearish" | "neutral";
    confidence: number;
    factors: string[];
  };
  dayAheadInsights?: {
    keyEvents: string[];
    watchList: string[];
    riskFactors: string[];
    opportunities: string[];
  };
  timeframeSpecificInsights?: string;
} {
  const lines = aiResponse.split("\n").filter((line) => line.trim());

  let summary = "";
  let keyHighlights: string[] = [];

  // Extract summary
  const summaryMatch = aiResponse.match(
    /(?:SUMMARY|EXECUTIVE_SUMMARY):\s*([^]*?)(?=\n\d+\.|KEY_HIGHLIGHTS|$)/i
  );
  if (summaryMatch) {
    summary = summaryMatch[1].trim().replace(/^\d+\.\s*/, "");
  }

  // Extract key highlights
  const highlightsMatch = aiResponse.match(
    /KEY_HIGHLIGHTS:\s*([^]*?)(?=\n\d+\.|TRENDING_FOCUS|OUTLOOK|$)/i
  );
  if (highlightsMatch) {
    const highlightsText = highlightsMatch[1];
    keyHighlights = highlightsText
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.startsWith("•") || line.startsWith("-") || /^\d+\./.test(line)
      )
      .map((line) => line.replace(/^[•\-\d\.]\s*/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 8); // Limit to 8 highlights
  }

  // Fallback parsing if structured format not found
  if (!summary || keyHighlights.length === 0) {
    const paragraphs = aiResponse.split("\n\n").filter((p) => p.trim());

    if (!summary && paragraphs.length > 0) {
      summary = paragraphs[0].replace(/^[^:]*:\s*/, "").trim();
    }

    if (keyHighlights.length === 0) {
      // Extract bullet points from anywhere in the response
      keyHighlights = aiResponse
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.startsWith("•") || line.startsWith("-") || /^\d+\./.test(line)
        )
        .map((line) => line.replace(/^[•\-\d\.]\s*/, "").trim())
        .filter((line) => line.length > 10) // Filter out very short lines
        .slice(0, 6);
    }
  }

  // Extract market sentiment
  let marketSentiment: any = undefined;
  const sentimentMatch = aiResponse.match(
    /MARKET_SENTIMENT:\s*([^]*?)(?=\n\d+\.|DAY_AHEAD_INSIGHTS|$)/i
  );
  if (sentimentMatch) {
    const sentimentText = sentimentMatch[1];
    const bullishMatch = sentimentText.match(/BULLISH/i);
    const bearishMatch = sentimentText.match(/BEARISH/i);
    const neutralMatch = sentimentText.match(/NEUTRAL/i);

    if (bullishMatch || bearishMatch || neutralMatch) {
      const overall = bullishMatch
        ? "bullish"
        : bearishMatch
        ? "bearish"
        : "neutral";
      const confidenceMatch = sentimentText.match(/(\d+)%/);
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 75;

      marketSentiment = {
        overall,
        confidence,
        factors: ["AI analysis", "News sentiment", "Market indicators"],
      };
    }
  }

  // Extract day ahead insights
  let dayAheadInsights: any = undefined;
  const dayAheadMatch = aiResponse.match(
    /DAY_AHEAD_INSIGHTS:\s*([^]*?)(?=\n\d+\.|TIMEFRAME_INSIGHTS|$)/i
  );
  if (dayAheadMatch) {
    const dayAheadText = dayAheadMatch[1];

    const keyEventsMatch = dayAheadText.match(
      /KEY_EVENTS:\s*([^]*?)(?=WATCH_LIST|$)/i
    );
    const watchListMatch = dayAheadText.match(
      /WATCH_LIST:\s*([^]*?)(?=RISK_FACTORS|$)/i
    );
    const riskFactorsMatch = dayAheadText.match(
      /RISK_FACTORS:\s*([^]*?)(?=OPPORTUNITIES|$)/i
    );
    const opportunitiesMatch = dayAheadText.match(
      /OPPORTUNITIES:\s*([^]*?)(?=\n\d+\.|$)/i
    );

    dayAheadInsights = {
      keyEvents: extractBulletPoints(keyEventsMatch?.[1] || ""),
      watchList: extractBulletPoints(watchListMatch?.[1] || ""),
      riskFactors: extractBulletPoints(riskFactorsMatch?.[1] || ""),
      opportunities: extractBulletPoints(opportunitiesMatch?.[1] || ""),
    };
  }

  // Extract timeframe specific insights
  let timeframeSpecificInsights: string | undefined;
  const timeframeMatch = aiResponse.match(
    /TIMEFRAME_INSIGHTS:\s*([^]*?)(?=\n\d+\.|TRENDING_FOCUS|$)/i
  );
  if (timeframeMatch) {
    timeframeSpecificInsights = timeframeMatch[1].trim();
  }

  return {
    summary:
      summary ||
      "Market analysis generated successfully. Check individual news items for detailed information.",
    keyHighlights:
      keyHighlights.length > 0
        ? keyHighlights
        : [
            "Market data analyzed from multiple sources",
            "AI-powered insights generated",
            "Check trending stocks for momentum plays",
            "Monitor upcoming events for volatility",
          ],
    marketSentiment,
    dayAheadInsights,
    timeframeSpecificInsights,
  };
}

/**
 * Helper function to extract bullet points from text
 */
function extractBulletPoints(text: string): string[] {
  if (!text) return [];

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("•") || line.startsWith("-") || /^\d+\./.test(line)
    )
    .map((line) => line.replace(/^[•\-\d\.\s]*/, "").trim())
    .filter((line) => line.length > 5)
    .slice(0, 5);
}
