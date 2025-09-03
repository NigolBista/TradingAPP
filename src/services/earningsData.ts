import Constants from "expo-constants";

interface StockNewsEarningsResponse {
  data: StockNewsEarningsItem[];
  total_pages: number;
  page: number;
}

interface StockNewsEarningsItem {
  ID: number;
  Ticker: string;
  Company: string;
  "Earnings Date": string;
  Type: string;
  Time: string;
  URL?: string;
  eps_estimate?: number;
  eps_actual?: number;
  revenue_estimate?: number;
  revenue_actual?: number;
  fiscal_quarter?: string;
  fiscal_year?: number;
}

export interface EarningsReport {
  symbol: string;
  date: string;
  fiscalQuarter: string;
  fiscalYear: string;
  reportedEPS?: number;
  estimatedEPS?: number;
  actualEPS?: number;
  revenue?: number;
  estimatedRevenue?: number;
  actualRevenue?: number;
  surprisePercent?: number;
  time?: "bmo" | "amc" | "dmh"; // before market open, after market close, during market hours
}

export interface EarningsCalendarItem {
  symbol: string;
  companyName?: string;
  date: string;
  time?: "bmo" | "amc" | "dmh";
  estimatedEPS?: number;
  estimatedRevenue?: number;
  fiscalQuarter?: string;
  fiscalYear?: string;
}

export interface RecentEarningsItem extends EarningsReport {
  companyName?: string;
  beatEstimate?: boolean;
  missedEstimate?: boolean;
  revenueGrowthYoY?: number;
  epsGrowthYoY?: number;
}

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  console.log(`🌐 Making request to: ${url}`);
  const maskedHeaders = { ...headers } as any;
  if (maskedHeaders.Authorization) {
    maskedHeaders.Authorization = "Bearer ***";
  }
  console.log(`📋 Headers:`, maskedHeaders);

  const res = await fetch(url, { headers });
  console.log(`📊 Response: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const errorText = await res.text();
    console.log(`❌ Error response:`, errorText);
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch earnings data for a specific symbol using Market Data API
 * @param symbol Stock symbol (e.g., "AAPL")
 * @param options Query options
 */
export async function fetchEarningsData(
  symbol: string,
  options: {
    from?: string; // ISO date string
    to?: string; // ISO date string
    countback?: number; // Number of reports to fetch
    limit?: number;
  } = {}
): Promise<EarningsReport[]> {
  const apiToken = (Constants.expoConfig?.extra as any)?.marketDataApiToken;

  if (!apiToken) {
    throw new Error(
      "Market Data API token missing. Set extra.marketDataApiToken."
    );
  }

  const params = new URLSearchParams();
  if (options.from) params.append("from", options.from);
  if (options.to) params.append("to", options.to);
  if (options.countback)
    params.append("countback", options.countback.toString());
  if (options.limit) params.append("limit", options.limit.toString());
  if (apiToken) params.append("token", apiToken);

  const url = `https://api.marketdata.app/v1/stocks/earnings/${encodeURIComponent(
    symbol
  )}/?${params.toString()}`;

  console.log(`🎯 Fetching earnings for ${symbol} from: ${url}`);
  console.log(`🔑 API Token available: ${!!apiToken}`);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const json = await fetchJson(url, headers);
    console.log(`✅ Earnings API response status:`, json?.s);
    console.log(`📈 Full response:`, JSON.stringify(json, null, 2));

    if (json?.s !== "ok") {
      const errorMsg = json?.errmsg || "Unknown error";
      console.warn("Market Data API earnings error:", errorMsg);
      return [];
    }

    // Parse the earnings data
    const reports: EarningsReport[] = [];
    const length =
      (Array.isArray(json.reportDate) && json.reportDate.length) ||
      (Array.isArray(json.date) && json.date.length) ||
      0;

    function toIsoFromEpoch(value: any): string | undefined {
      if (typeof value === "number") {
        // API returns epoch seconds
        return new Date(value * 1000).toISOString();
      }
      if (typeof value === "string") {
        // Already ISO or date-like
        const dt = new Date(value);
        return isNaN(dt.getTime()) ? undefined : dt.toISOString();
      }
      return undefined;
    }

    function normalizeEarningsTime(
      value?: string
    ): "bmo" | "amc" | "dmh" | undefined {
      if (!value) return undefined;
      const v = value.toLowerCase();
      if (v.includes("after") && v.includes("close")) return "amc";
      if (
        (v.includes("before") && v.includes("open")) ||
        v === "pre" ||
        v === "premarket"
      )
        return "bmo";
      if (
        v.includes("during") ||
        v.includes("hours") ||
        v.includes("midday") ||
        v === "dmh"
      )
        return "dmh";
      if (v === "amc" || v === "bmo") return v as any;
      return undefined;
    }

    for (let i = 0; i < length; i++) {
      const rawDate = (json.reportDate?.[i] ?? json.date?.[i]) as any;
      const isoDate = toIsoFromEpoch(rawDate);
      const rawTime = (json.time?.[i] ?? json.reportTime?.[i]) as
        | string
        | undefined;
      const normTime = normalizeEarningsTime(rawTime);

      const report: EarningsReport = {
        symbol: symbol.toUpperCase(),
        date: isoDate || (json.date?.[i] as any),
        fiscalQuarter: json.fiscalQuarter?.[i] || "",
        fiscalYear: json.fiscalYear?.[i] || "",
        reportedEPS: json.reportedEPS?.[i],
        estimatedEPS: json.estimatedEPS?.[i],
        actualEPS: json.actualEPS?.[i],
        revenue: json.revenue?.[i],
        estimatedRevenue: json.estimatedRevenue?.[i],
        actualRevenue: json.actualRevenue?.[i],
        surprisePercent: json.surprisePercent?.[i] ?? json.surpriseEPSpct?.[i],
        time: normTime,
      };
      reports.push(report);
    }

    console.log(
      `Successfully parsed ${reports.length} earnings reports for ${symbol}`
    );
    return reports.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch (error) {
    console.error("Market Data API earnings error:", error);
    throw error;
  }
}

/**
 * Fetch recent earnings for multiple symbols to display in market overview
 */
export async function fetchRecentEarnings(
  symbols: string[] = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "TSLA",
    "META",
    "NVDA",
    "NFLX",
  ],
  daysBack: number = 7
): Promise<RecentEarningsItem[]> {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - daysBack);

  const recentEarnings: RecentEarningsItem[] = [];

  // Fetch earnings for each symbol in parallel
  const promises = symbols.map(async (symbol) => {
    try {
      const reports = await fetchEarningsData(symbol, {
        from: fromDate.toISOString().split("T")[0],
        to: toDate.toISOString().split("T")[0],
        limit: 1,
      });

      return reports.map((report) => ({
        ...report,
        companyName: getCompanyName(symbol),
        beatEstimate:
          report.actualEPS && report.estimatedEPS
            ? report.actualEPS > report.estimatedEPS
            : undefined,
        missedEstimate:
          report.actualEPS && report.estimatedEPS
            ? report.actualEPS < report.estimatedEPS
            : undefined,
      }));
    } catch (error) {
      console.warn(`Failed to fetch earnings for ${symbol}:`, error);
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach((reports) => recentEarnings.push(...reports));

  // Sort by date (most recent first)
  return recentEarnings
    .filter((report) => report.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5); // Limit to top 10 most recent
}

/**
 * Fetch upcoming earnings calendar from Stock News API
 * Note: Earnings calendar endpoint requires premium subscription
 */
export async function fetchUpcomingEarningsFromStockNewsAPI(
  daysAhead: number = 30
): Promise<EarningsCalendarItem[]> {
  const apiToken = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;

  if (!apiToken) {
    console.warn(
      "Stock News API token missing. Falling back to Market Data API."
    );
    return [];
  }

  try {
    const url = `https://stocknewsapi.com/api/v1/earnings-calendar?&page=1&items=100&token=${apiToken}`;

    console.log(`🎯 Attempting to fetch earnings calendar from Stock News API`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    // console.log(`📊 Stock News API earnings response:`, json);

    // Check if earnings calendar is available with current subscription
    if (
      json.message &&
      json.message.includes("not available with current Subscription")
    ) {
      console.warn(
        "📋 Earnings calendar endpoint requires premium subscription. Using fallback approach."
      );
      return await fetchEarningsFromNewsAnalysis(daysAhead);
    }

    if (!json.data || !Array.isArray(json.data)) {
      console.warn("Invalid earnings calendar response format");
      return [];
    }

    // Convert Stock News API format to our format
    const earnings: EarningsCalendarItem[] = json.data.map((item: any) => {
      const earningsDate = item["Earnings Date"];
      const parsedDate = parseEarningsDate(earningsDate);

      return {
        symbol: item.Ticker,
        companyName: item.Company || getCompanyName(item.Ticker),
        date: parsedDate,
        time: normalizeEarningsTimeFromType(item.Type),
        estimatedEPS: item.eps_estimate,
        estimatedRevenue: item.revenue_estimate,
        fiscalQuarter:
          item.fiscal_quarter ||
          `Q${Math.ceil(new Date(parsedDate).getMonth() / 3) + 1}`,
        fiscalYear:
          item.fiscal_year?.toString() ||
          new Date(parsedDate).getFullYear().toString(),
      };
    });

    // Filter for future dates within the specified window
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfWindow = new Date();
    endOfWindow.setDate(startOfToday.getDate() + daysAhead);
    endOfWindow.setHours(23, 59, 59, 999);

    const filtered = earnings
      .filter((item) => {
        const d = new Date(item.date);
        const isInRange = d >= startOfToday && d <= endOfWindow;
        return isInRange;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(
      `📈 Filtered Stock News API earnings:`,
      filtered.length,
      filtered
    );
    return filtered;
  } catch (error) {
    console.error("Stock News API earnings error:", error);
    // Fallback to news analysis approach
    return await fetchEarningsFromNewsAnalysis(daysAhead);
  }
}

/**
 * Fallback: Extract earnings information from earnings-related news
 */
async function fetchEarningsFromNewsAnalysis(
  daysAhead: number = 30
): Promise<EarningsCalendarItem[]> {
  console.log("📰 Using news analysis fallback for earnings calendar");

  const apiToken = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;
  if (!apiToken) return [];

  try {
    // Search for earnings-related news
    const url = `https://stocknewsapi.com/api/v1/category?section=general&items=50&topic=earnings&token=${apiToken}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    if (!json.data || !Array.isArray(json.data)) {
      return [];
    }

    const earnings: EarningsCalendarItem[] = [];
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + daysAhead);

    // Extract earnings information from news titles and content
    json.data.forEach((newsItem: any) => {
      const title = newsItem.title || "";
      const text = newsItem.text || "";
      const tickers = newsItem.tickers || [];

      // Look for earnings-related keywords and dates
      const earningsKeywords = [
        "earnings",
        "reports",
        "quarterly",
        "Q1",
        "Q2",
        "Q3",
        "Q4",
        "fiscal",
        "results",
        "announces",
        "eps",
      ];

      const hasEarningsKeyword = earningsKeywords.some(
        (keyword) =>
          title.toLowerCase().includes(keyword) ||
          text.toLowerCase().includes(keyword)
      );

      if (hasEarningsKeyword && tickers.length > 0) {
        // Extract potential earnings date from news
        const dateMatch = text.match(
          /(\w+\s+\d{1,2},?\s+\d{4})|(\d{1,2}\/\d{1,2}\/\d{4})/
        );
        let earningsDate = newsItem.date;

        if (dateMatch) {
          const extractedDate = new Date(dateMatch[0]);
          if (
            !isNaN(extractedDate.getTime()) &&
            extractedDate > today &&
            extractedDate <= endDate
          ) {
            earningsDate = extractedDate.toISOString();
          }
        }

        tickers.forEach((ticker: string) => {
          // Avoid duplicates
          const exists = earnings.some(
            (e) => e.symbol === ticker && e.date === earningsDate
          );
          if (!exists) {
            earnings.push({
              symbol: ticker,
              companyName: getCompanyName(ticker),
              date: earningsDate,
              time: undefined, // Time not available from news analysis
              estimatedEPS: undefined,
              estimatedRevenue: undefined,
              fiscalQuarter: extractQuarterFromText(text),
              fiscalYear: new Date(earningsDate).getFullYear().toString(),
            });
          }
        });
      }
    });

    console.log(
      `📊 Extracted ${earnings.length} potential earnings from news analysis`
    );
    return earnings.slice(0, 15); // Limit results
  } catch (error) {
    console.error("News analysis fallback failed:", error);
    return [];
  }
}

/**
 * Extract fiscal quarter from news text
 */
function extractQuarterFromText(text: string): string | undefined {
  const quarterMatch = text.match(
    /Q([1-4])|quarter\s+([1-4])|first|second|third|fourth/i
  );
  if (quarterMatch) {
    if (quarterMatch[1]) return `Q${quarterMatch[1]}`;
    if (quarterMatch[2]) return `Q${quarterMatch[2]}`;
    const quarter = quarterMatch[0].toLowerCase();
    if (quarter.includes("first")) return "Q1";
    if (quarter.includes("second")) return "Q2";
    if (quarter.includes("third")) return "Q3";
    if (quarter.includes("fourth")) return "Q4";
  }
  return undefined;
}

function normalizeEarningsTime(
  value?: string
): "bmo" | "amc" | "dmh" | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v.includes("after") || v.includes("amc") || v.includes("close"))
    return "amc";
  if (
    v.includes("before") ||
    v.includes("bmo") ||
    v.includes("open") ||
    v.includes("pre")
  )
    return "bmo";
  if (v.includes("during") || v.includes("dmh") || v.includes("hours"))
    return "dmh";
  return undefined;
}

/**
 * Parse earnings date from Stock News API format (MM/DD/YYYY)
 */
function parseEarningsDate(dateString: string): string {
  if (!dateString) return new Date().toISOString();

  try {
    // Stock News API returns dates in MM/DD/YYYY format
    const [month, day, year] = dateString.split("/");
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toISOString();
  } catch (error) {
    console.warn(`Failed to parse earnings date: ${dateString}`, error);
    return new Date().toISOString();
  }
}

/**
 * Normalize earnings time from Stock News API Type field
 */
function normalizeEarningsTimeFromType(
  type?: string
): "bmo" | "amc" | "dmh" | undefined {
  if (!type) return undefined;
  const t = type.toLowerCase();

  if (t.includes("bm") || t.includes("before market")) return "bmo";
  if (t.includes("am") || t.includes("after market")) return "amc";
  if (t.includes("dmh") || t.includes("during market")) return "dmh";
  if (t.includes("tbd") || t.includes("to be determined")) return undefined;

  return undefined;
}

/**
 * Fetch upcoming earnings calendar (enhanced with better data sources)
 */
export async function fetchUpcomingEarnings(
  symbols: string[],
  daysAhead: number = 14
): Promise<EarningsCalendarItem[]> {
  console.log(
    `🎯 Fetching upcoming earnings for ${symbols.length} symbols, ${daysAhead} days ahead`
  );

  // Try Stock News API first (if premium subscription is available)
  try {
    const stockNewsEarnings = await fetchUpcomingEarningsFromStockNewsAPI(
      daysAhead
    );

    // If we have specific symbols, filter for those
    if (symbols && symbols.length > 0 && stockNewsEarnings.length > 0) {
      const symbolsSet = new Set(symbols.map((s) => s.toUpperCase()));
      const filtered = stockNewsEarnings.filter((item) =>
        symbolsSet.has(item.symbol.toUpperCase())
      );

      if (filtered.length > 0) {
        console.log(
          `📊 Found ${filtered.length} earnings for favorite symbols from Stock News API`
        );
        return filtered.slice(0, 15);
      }
    } else if (!symbols || symbols.length === 0) {
      // No specific symbols requested, return all upcoming earnings
      return stockNewsEarnings.slice(0, 15);
    }
  } catch (error) {
    console.log(
      "📋 Stock News API not available, using Market Data API:",
      error instanceof Error ? error.message : String(error)
    );
  }

  // Fallback to Market Data API implementation
  if (!symbols || symbols.length === 0) {
    console.log("⚠️ No symbols provided for Market Data API fallback");
    return [];
  }

  const fromDate = new Date();
  const toDate = new Date();
  toDate.setDate(fromDate.getDate() + daysAhead);

  const upcomingEarnings: EarningsCalendarItem[] = [];

  // Fetch earnings for each symbol in parallel
  const promises = symbols.map(async (symbol) => {
    try {
      const reports = await fetchEarningsData(symbol);

      return reports.map((report) => ({
        symbol: report.symbol,
        companyName: getCompanyName(symbol),
        date: report.date,
        time: report.time,
        estimatedEPS: report.estimatedEPS,
        estimatedRevenue: report.estimatedRevenue,
        fiscalQuarter: report.fiscalQuarter,
        fiscalYear: report.fiscalYear,
      }));
    } catch (error) {
      console.warn(`Failed to fetch upcoming earnings for ${symbol}:`, error);
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach((reports) => upcomingEarnings.push(...reports));

  console.log(
    `📊 Raw upcoming earnings fetched from Market Data API:`,
    upcomingEarnings.length
  );

  // Filter for future dates and sort by date
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfWindow = new Date(toDate);
  endOfWindow.setHours(23, 59, 59, 999);

  const filtered = upcomingEarnings
    .filter((item) => {
      const d = new Date(item.date);
      const isInRange = d >= startOfToday && d <= endOfWindow;
      return isInRange;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 15); // Limit to next 15 earnings

  console.log(`📈 Filtered upcoming earnings:`, filtered.length, filtered);
  return filtered;
}

/**
 * Simple company name mapping - in a real app, this would come from a more comprehensive database
 */
function getCompanyName(symbol: string): string {
  const companyNames: Record<string, string> = {
    AAPL: "Apple Inc.",
    MSFT: "Microsoft Corporation",
    GOOGL: "Alphabet Inc.",
    AMZN: "Amazon.com Inc.",
    TSLA: "Tesla Inc.",
    META: "Meta Platforms Inc.",
    NVDA: "NVIDIA Corporation",
    NFLX: "Netflix Inc.",
    HD: "The Home Depot Inc.",
    WMT: "Walmart Inc.",
    TGT: "Target Corporation",
    PANW: "Palo Alto Networks Inc.",
    MDT: "Medtronic plc",
    ALC: "Alcon Inc.",
    BZ: "Kanzhun Limited",
    DY: "Dycom Industries Inc.",
    GDS: "GDS Holdings Limited",
    COTY: "Coty Inc.",
    KC: "Kingsoft Cloud Holdings Limited",
    CAAP: "Corporación América Airports S.A.",
    BBAR: "Banco BBVA Argentina S.A.",
    EL: "The Estée Lauder Companies Inc.",
    WDAY: "Workday Inc.",
    ROST: "Ross Stores Inc.",
    HEI: "HEICO Corporation",
    AS: "Amer Sports Inc.",
    FN: "Fabrinet",
    XP: "XP Inc.",
  };

  return companyNames[symbol.toUpperCase()] || symbol.toUpperCase();
}

/**
 * Format earnings time for display
 */
export function formatEarningsTime(time?: string): string {
  switch (time) {
    case "bmo":
      return "Before Market Open";
    case "amc":
      return "After Market Close";
    case "dmh":
      return "During Market Hours";
    default:
      return "Time TBD";
  }
}

/**
 * Calculate EPS surprise percentage
 */
export function calculateEPSSurprise(
  actual?: number,
  estimated?: number
): number | undefined {
  if (actual === undefined || estimated === undefined || estimated === 0) {
    return undefined;
  }
  return ((actual - estimated) / Math.abs(estimated)) * 100;
}

/**
 * Format currency values for display
 */
export function formatCurrency(
  value?: number,
  options: { compact?: boolean } = {}
): string {
  if (value === undefined || value === null) return "N/A";

  if (options.compact && Math.abs(value) >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (options.compact && Math.abs(value) >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (options.compact && Math.abs(value) >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format EPS values for display
 */
export function formatEPS(value?: number): string {
  if (value === undefined || value === null) return "N/A";
  return `$${value.toFixed(2)}`;
}

/**
 * Fetch today's earnings from Stock News API
 */
export async function fetchTodaysEarnings(): Promise<EarningsCalendarItem[]> {
  const apiToken = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;

  if (!apiToken) {
    console.warn("Stock News API token missing");
    return [];
  }

  try {
    const url = `https://stocknewsapi.com/api/v1/earnings-calendar?&page=1&items=100&token=${apiToken}`;

    console.log(`🎯 Fetching today's earnings`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    if (!json.data || !Array.isArray(json.data)) {
      console.warn("Invalid earnings calendar response format");
      return [];
    }

    // Get today's date in MM/DD/YYYY format to match API
    const today = new Date();
    const todayString = `${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}/${String(today.getDate()).padStart(2, "0")}/${today.getFullYear()}`;

    // Filter for today's earnings only
    const todaysEarnings = json.data
      .filter((item: any) => item["Earnings Date"] === todayString)
      .map((item: any) => {
        const earningsDate = item["Earnings Date"];
        const parsedDate = parseEarningsDate(earningsDate);

        return {
          symbol: item.Ticker,
          companyName: item.Company || getCompanyName(item.Ticker),
          date: parsedDate,
          time: normalizeEarningsTimeFromType(item.Type),
          estimatedEPS: item.eps_estimate,
          estimatedRevenue: item.revenue_estimate,
          fiscalQuarter:
            item.fiscal_quarter ||
            `Q${Math.ceil(new Date(parsedDate).getMonth() / 3) + 1}`,
          fiscalYear:
            item.fiscal_year?.toString() ||
            new Date(parsedDate).getFullYear().toString(),
        };
      });

    console.log(
      `📊 Found ${todaysEarnings.length} earnings for today (${todayString})`
    );
    return todaysEarnings;
  } catch (error) {
    console.error("Failed to fetch today's earnings:", error);
    return [];
  }
}

/**
 * Fetch earnings for the current week from Stock News API
 */
export async function fetchWeeklyEarnings(): Promise<EarningsCalendarItem[]> {
  const apiToken = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;

  if (!apiToken) {
    console.warn("Stock News API token missing");
    return [];
  }

  try {
    const url = `https://stocknewsapi.com/api/v1/earnings-calendar?&page=1&items=100&token=${apiToken}`;

    console.log(`🎯 Fetching weekly earnings calendar`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    if (!json.data || !Array.isArray(json.data)) {
      console.warn("Invalid earnings calendar response format");
      return [];
    }

    // Get current week's date range
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

    // Convert Stock News API format and filter for current week
    const weeklyEarnings = json.data
      .map((item: any) => {
        const earningsDate = item["Earnings Date"];
        const parsedDate = parseEarningsDate(earningsDate);
        const earningsDateObj = new Date(parsedDate);

        // Check if earnings date is within current week
        if (earningsDateObj >= startOfWeek && earningsDateObj <= endOfWeek) {
          return {
            symbol: item.Ticker,
            companyName: item.Company || getCompanyName(item.Ticker),
            date: parsedDate,
            time: normalizeEarningsTimeFromType(item.Type),
            estimatedEPS: item.eps_estimate,
            estimatedRevenue: item.revenue_estimate,
            fiscalQuarter:
              item.fiscal_quarter ||
              `Q${Math.ceil(new Date(parsedDate).getMonth() / 3) + 1}`,
            fiscalYear:
              item.fiscal_year?.toString() ||
              new Date(parsedDate).getFullYear().toString(),
          };
        }
        return null;
      })
      .filter((item: any) => item !== null)
      .sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );

    console.log(`📊 Found ${weeklyEarnings.length} earnings for current week`);
    return weeklyEarnings;
  } catch (error) {
    console.error("Failed to fetch weekly earnings:", error);
    return [];
  }
}

/**
 * Fetch all upcoming earnings from Stock News API (not filtered by user favorites)
 * Now with premium access, we can get comprehensive earnings data
 */
export async function fetchAllUpcomingEarnings(
  daysAhead: number = 30
): Promise<EarningsCalendarItem[]> {
  const apiToken = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;

  if (!apiToken) {
    console.warn("Stock News API token missing");
    return [];
  }

  try {
    // With premium access, we can fetch more comprehensive data
    const url = `https://stocknewsapi.com/api/v1/earnings-calendar?&page=1&items=100&token=${apiToken}`;

    console.log(`🎯 Fetching comprehensive earnings calendar (premium access)`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    console.log(`📊 Stock News API premium response:`, json);

    if (!json.data || !Array.isArray(json.data)) {
      console.warn("Invalid earnings calendar response format");
      return [];
    }

    // Convert Stock News API format to our format
    const earnings: EarningsCalendarItem[] = json.data.map((item: any) => {
      const earningsDate = item["Earnings Date"];
      const parsedDate = parseEarningsDate(earningsDate);

      return {
        symbol: item.Ticker,
        companyName: item.Company || getCompanyName(item.Ticker),
        date: parsedDate,
        time: normalizeEarningsTimeFromType(item.Type),
        estimatedEPS: item.eps_estimate,
        estimatedRevenue: item.revenue_estimate,
        fiscalQuarter:
          item.fiscal_quarter ||
          `Q${Math.ceil(new Date(parsedDate).getMonth() / 3) + 1}`,
        fiscalYear:
          item.fiscal_year?.toString() ||
          new Date(parsedDate).getFullYear().toString(),
      };
    });

    // Filter for future dates within the specified window
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfWindow = new Date();
    endOfWindow.setDate(startOfToday.getDate() + daysAhead);
    endOfWindow.setHours(23, 59, 59, 999);

    const filtered = earnings
      .filter((item) => {
        const d = new Date(item.date);
        const isInRange = d >= startOfToday && d <= endOfWindow;
        return isInRange;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(
      `📈 Filtered comprehensive earnings calendar:`,
      filtered.length,
      "items"
    );
    return filtered;
  } catch (error) {
    console.error("Failed to fetch comprehensive earnings:", error);
    return [];
  }
}
