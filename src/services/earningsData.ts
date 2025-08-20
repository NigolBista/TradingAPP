import Constants from "expo-constants";

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
    .slice(0, 10); // Limit to top 10 most recent
}

/**
 * Fetch upcoming earnings calendar
 */
export async function fetchUpcomingEarnings(
  symbols: string[],
  daysAhead: number = 14
): Promise<EarningsCalendarItem[]> {
  if (!symbols || symbols.length === 0) {
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
    `📊 Raw upcoming earnings fetched:`,
    upcomingEarnings.length,
    upcomingEarnings
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
      console.log(
        `📅 ${item.symbol} ${item.date}: ${
          isInRange ? "✅" : "❌"
        } (${d.toDateString()})`
      );
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
