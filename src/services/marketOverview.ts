import Constants from "expo-constants";
import OpenAI from "openai";
import {
  getGlobalMarketData,
  refreshGlobalCache,
  getAllCachedData,
  getCachedNews,
  getCachedTrendingStocks,
  getCachedMarketEvents,
  isCacheValid,
} from "./marketDataCache";
import { fetchGeneralMarketNews } from "./newsProviders";
import type { NewsItem, TrendingStock, MarketEvent } from "./newsProviders";

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

  try {
    // Get market data from global cache or fetch fresh data
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

    // Generate AI summary
    const aiSummary = await generateAIMarketSummary(
      marketNews,
      trendingStocks,
      marketEvents,
      fedEvents,
      economicIndicators,
      analysisDepth,
      timeframe
    );

    // Extract key highlights from AI response
    const { summary, keyHighlights } = parseAIResponse(aiSummary);

    return {
      summary,
      keyHighlights,
      topStories: marketNews.slice(0, 10), // Top 10 stories for display
      trendingStocks,
      upcomingEvents: marketEvents,
      fedEvents: fedEvents
        .filter((fe) => fe.impact === "high" || fe.impact === "medium")
        .slice(0, 5), // High and medium impact Fed events
      economicIndicators: economicIndicators.slice(0, 5), // Top 5 economic indicators
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Market Overview Error:", error);

    // Fallback to basic news without AI analysis
    try {
      const basicNews = await fetchGeneralMarketNews(10);
      return {
        summary:
          "Market overview temporarily unavailable. Please check individual news stories for the latest updates.",
        keyHighlights: [
          "AI analysis temporarily unavailable",
          "Check individual news stories for updates",
          "Market data refreshes every 2 minutes",
        ],
        topStories: basicNews,
        trendingStocks: [],
        upcomingEvents: [],
        fedEvents: [],
        economicIndicators: [],
        lastUpdated: new Date().toISOString(),
      };
    } catch (fallbackError) {
      console.error("❌ Fallback Market Overview Error:", fallbackError);
      throw new Error("Unable to fetch market overview data");
    }
  }
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
    console.log("🤖 Calling OpenAI API with model: gpt-4o-mini");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional financial analyst providing market overviews. Be concise, accurate, and focus on actionable insights. Always structure your response with clear sections.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: depth === "brief" ? 800 : 1200,
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
  const timeframeContext = {
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

  const context = timeframeContext[timeframe];

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

1. EXECUTIVE_SUMMARY: 3-4 sentences capturing the overall market narrative and key themes

2. KEY_HIGHLIGHTS: 6-8 critical points covering:
   - Major market movers and catalysts
   - Federal Reserve meetings, policy decisions, and economic data
   - Sector rotation or themes
   - Economic indicators (CPI, PPI, employment, etc.) and policy impacts
   - Notable earnings or corporate developments
   - Technical levels or market structure
   - Risk factors to monitor

3. TRENDING_FOCUS: Brief analysis of why certain stocks are trending

4. OUTLOOK: What to watch for in the near term

Structure your response clearly and focus on actionable insights for traders and investors.`;
}

/**
 * Parses the AI response to extract structured data
 */
function parseAIResponse(aiResponse: string): {
  summary: string;
  keyHighlights: string[];
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
  };
}
