import Constants from "expo-constants";

// Federal Reserve Economic Data (FRED) API Service
// Provides access to Federal Reserve meetings, economic indicators, and policy data

export interface FedEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "meeting" | "release" | "announcement";
  impact: "high" | "medium" | "low";
  category: "monetary_policy" | "economic_data" | "financial_stability";
}

export interface EconomicIndicator {
  seriesId: string;
  title: string;
  value: number;
  date: string;
  unit: string;
  change?: number;
  changePercent?: number;
}

export interface FedRelease {
  id: number;
  name: string;
  releaseDate: string;
  link: string;
  pressRelease: boolean;
}

interface FredApiResponse<T> {
  realtime_start: string;
  realtime_end: string;
  count: number;
  offset: number;
  limit: number;
  releases?: T[];
  observations?: T[];
}

interface FredRelease {
  id: number;
  realtime_start: string;
  realtime_end: string;
  name: string;
  press_release: boolean;
  link: string;
}

interface FredObservation {
  realtime_start: string;
  realtime_end: string;
  date: string;
  value: string;
}

const FRED_BASE_URL = "https://api.stlouisfed.org/fred";

// Key economic series IDs for Federal Reserve data
const ECONOMIC_SERIES = {
  FEDERAL_FUNDS_RATE: "FEDFUNDS",
  CPI_ALL_ITEMS: "CPIAUCSL",
  CORE_CPI: "CPILFESL",
  PPI_FINAL_DEMAND: "PPIFIS",
  CORE_PPI: "PPIFES",
  UNEMPLOYMENT_RATE: "UNRATE",
  GDP_GROWTH: "GDPC1",
  INFLATION_EXPECTATIONS: "T5YIE",
  REAL_GDP: "GDPC1",
  M2_MONEY_SUPPLY: "M2SL",
};

// Important Federal Reserve release IDs
const FED_RELEASES = {
  FOMC_MINUTES: 62,
  BEIGE_BOOK: 83,
  MONETARY_POLICY: 18, // H.15 Selected Interest Rates
  CONSUMER_PRICE_INDEX: 10,
  PRODUCER_PRICE_INDEX: 46,
  EMPLOYMENT_SITUATION: 50,
  GDP: 53,
};

/**
 * Get Federal Reserve API key from configuration
 */
function getFredApiKey(): string {
  const { fredApiKey } = (Constants.expoConfig?.extra || {}) as any;
  if (!fredApiKey) {
    throw new Error(
      "FRED API key not configured. Please add FRED_API_KEY to your environment variables."
    );
  }
  return fredApiKey;
}

/**
 * Make a request to the FRED API
 */
async function fredApiRequest<T>(
  endpoint: string,
  params: Record<string, any> = {}
): Promise<FredApiResponse<T>> {
  const apiKey = getFredApiKey();

  const queryParams = new URLSearchParams({
    api_key: apiKey,
    file_type: "json",
    ...params,
  });

  const url = `${FRED_BASE_URL}${endpoint}?${queryParams}`;

  console.log(`🏛️ FRED API Request: ${endpoint}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `FRED API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log(`✅ FRED API Response: ${data.count || 0} items`);

    return data;
  } catch (error) {
    console.error("❌ FRED API Error:", error);
    throw error;
  }
}

/**
 * Get upcoming Federal Reserve releases and events
 */
export async function getUpcomingFedEvents(): Promise<FedEvent[]> {
  try {
    // Get recent releases to identify upcoming events
    const releasesResponse = await fredApiRequest<FredRelease>("/releases", {
      limit: 50,
      order_by: "release_id",
    });

    const fedEvents: FedEvent[] = [];
    const today = new Date();
    const thirtyDaysFromNow = new Date(
      today.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    // Filter for key Federal Reserve releases
    const keyReleases =
      releasesResponse.releases?.filter(
        (release) =>
          Object.values(FED_RELEASES).includes(release.id) ||
          release.name.toLowerCase().includes("federal") ||
          release.name.toLowerCase().includes("fomc") ||
          release.name.toLowerCase().includes("monetary") ||
          release.name.toLowerCase().includes("beige book")
      ) || [];

    // Convert releases to events (simplified - in real implementation, you'd get actual dates)
    for (const release of keyReleases.slice(0, 10)) {
      const eventDate = new Date(
        today.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000
      );

      let type: FedEvent["type"] = "release";
      let impact: FedEvent["impact"] = "medium";
      let category: FedEvent["category"] = "economic_data";

      if (
        release.name.toLowerCase().includes("fomc") ||
        release.name.toLowerCase().includes("monetary")
      ) {
        type = "meeting";
        impact = "high";
        category = "monetary_policy";
      } else if (release.name.toLowerCase().includes("beige book")) {
        type = "announcement";
        impact = "high";
        category = "monetary_policy";
      } else if (
        release.name.toLowerCase().includes("cpi") ||
        release.name.toLowerCase().includes("ppi")
      ) {
        impact = "high";
      }

      fedEvents.push({
        id: `fed_${release.id}`,
        title: release.name,
        description: `Federal Reserve ${type} - ${release.name}`,
        date: eventDate.toISOString(),
        type,
        impact,
        category,
      });
    }

    // Add some known recurring Fed events
    const recurringEvents: Omit<FedEvent, "id" | "date">[] = [
      {
        title: "FOMC Meeting",
        description:
          "Federal Open Market Committee meeting to discuss monetary policy and interest rates",
        type: "meeting",
        impact: "high",
        category: "monetary_policy",
      },
      {
        title: "Fed Chair Speech",
        description:
          "Federal Reserve Chair speech on economic outlook and monetary policy",
        type: "announcement",
        impact: "high",
        category: "monetary_policy",
      },
      {
        title: "Beige Book Release",
        description:
          "Federal Reserve's summary of economic conditions across districts",
        type: "release",
        impact: "high",
        category: "monetary_policy",
      },
    ];

    // Add recurring events with estimated dates
    recurringEvents.forEach((event, index) => {
      const eventDate = new Date(
        today.getTime() + (index + 1) * 7 * 24 * 60 * 60 * 1000
      );
      fedEvents.push({
        ...event,
        id: `recurring_${index}`,
        date: eventDate.toISOString(),
      });
    });

    return fedEvents.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  } catch (error) {
    console.error("Error fetching Fed events:", error);
    return [];
  }
}

/**
 * Get key economic indicators from FRED
 */
export async function getKeyEconomicIndicators(): Promise<EconomicIndicator[]> {
  try {
    const indicators: EconomicIndicator[] = [];

    // Get recent data for key economic series
    const seriesPromises = Object.entries(ECONOMIC_SERIES).map(
      async ([name, seriesId]) => {
        try {
          const response = await fredApiRequest<FredObservation>(
            `/series/observations`,
            {
              series_id: seriesId,
              limit: 2, // Get last 2 observations to calculate change
              sort_order: "desc",
            }
          );

          if (response.observations && response.observations.length > 0) {
            const latest = response.observations[0];
            const previous = response.observations[1];

            const value = parseFloat(latest.value);
            const prevValue = previous ? parseFloat(previous.value) : null;

            let change = null;
            let changePercent = null;

            if (prevValue !== null && !isNaN(prevValue) && prevValue !== 0) {
              change = value - prevValue;
              changePercent = (change / prevValue) * 100;
            }

            return {
              seriesId,
              title: name
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(/\b\w/g, (l) => l.toUpperCase()),
              value,
              date: latest.date,
              unit: getUnitForSeries(seriesId),
              change,
              changePercent,
            };
          }
        } catch (error) {
          console.error(`Error fetching ${seriesId}:`, error);
          return null;
        }
      }
    );

    const results = await Promise.all(seriesPromises);
    indicators.push(...(results.filter(Boolean) as EconomicIndicator[]));

    return indicators;
  } catch (error) {
    console.error("Error fetching economic indicators:", error);
    return [];
  }
}

/**
 * Get unit for a given series ID
 */
function getUnitForSeries(seriesId: string): string {
  const units: Record<string, string> = {
    [ECONOMIC_SERIES.FEDERAL_FUNDS_RATE]: "%",
    [ECONOMIC_SERIES.CPI_ALL_ITEMS]: "Index",
    [ECONOMIC_SERIES.CORE_CPI]: "Index",
    [ECONOMIC_SERIES.PPI_FINAL_DEMAND]: "Index",
    [ECONOMIC_SERIES.CORE_PPI]: "Index",
    [ECONOMIC_SERIES.UNEMPLOYMENT_RATE]: "%",
    [ECONOMIC_SERIES.GDP_GROWTH]: "Billions $",
    [ECONOMIC_SERIES.INFLATION_EXPECTATIONS]: "%",
    [ECONOMIC_SERIES.REAL_GDP]: "Billions $",
    [ECONOMIC_SERIES.M2_MONEY_SUPPLY]: "Billions $",
  };

  return units[seriesId] || "";
}

/**
 * Get Federal Reserve releases for a specific time period
 */
export async function getFedReleases(days: number = 30): Promise<FedRelease[]> {
  try {
    const response = await fredApiRequest<FredRelease>("/releases", {
      limit: 100,
      order_by: "release_id",
    });

    const fedReleases =
      response.releases
        ?.filter(
          (release) =>
            Object.values(FED_RELEASES).includes(release.id) ||
            release.name.toLowerCase().includes("federal") ||
            release.name.toLowerCase().includes("monetary") ||
            release.name.toLowerCase().includes("fomc") ||
            release.name.toLowerCase().includes("beige")
        )
        .map((release) => ({
          id: release.id,
          name: release.name,
          releaseDate: release.realtime_start,
          link: release.link,
          pressRelease: release.press_release,
        })) || [];

    return fedReleases;
  } catch (error) {
    console.error("Error fetching Fed releases:", error);
    return [];
  }
}

/**
 * Get comprehensive Federal Reserve data for market analysis
 */
export async function getFederalReserveData(): Promise<{
  events: FedEvent[];
  indicators: EconomicIndicator[];
  releases: FedRelease[];
}> {
  try {
    console.log("🏛️ Fetching Federal Reserve data...");

    const [events, indicators, releases] = await Promise.all([
      getUpcomingFedEvents(),
      getKeyEconomicIndicators(),
      getFedReleases(),
    ]);

    console.log(
      `✅ Federal Reserve data fetched: ${events.length} events, ${indicators.length} indicators, ${releases.length} releases`
    );

    return {
      events,
      indicators,
      releases,
    };
  } catch (error) {
    console.error("❌ Error fetching Federal Reserve data:", error);
    return {
      events: [],
      indicators: [],
      releases: [],
    };
  }
}
