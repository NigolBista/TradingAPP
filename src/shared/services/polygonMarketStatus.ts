import Constants from "expo-constants";

export type ExchangeStatus = "open" | "closed" | "extended-hours" | string;

export interface PolygonMarketNowResponse {
  market?: string; // e.g., "open", "closed", "extended-hours", "pre"
  serverTime?: string; // e.g., "2025-09-17T09:45:12-04:00"
  exchanges?: Record<string, ExchangeStatus>;
  [key: string]: any;
}

export interface PolygonUpcomingItem {
  name?: string;
  date?: string; // YYYY-MM-DD
  status?: string; // e.g., holiday, early-close
  open?: string | null; // "09:30" local exchange time
  close?: string | null; // "16:00"
  [key: string]: any;
}

export interface MarketSessionInfo {
  sessionLabel: "pre-market" | "regular" | "after-hours" | "closed";
  market: string | undefined;
  serverTimeIso: string | undefined;
  serverTimeMs: number | null;
  serverOffsetMs: number; // serverTimeMs - Date.now()
  isRegularOpen: boolean;
  isPreMarket: boolean;
  isAfterHours: boolean;
  isClosed: boolean;
  exchanges?: Record<string, ExchangeStatus>;
}

function getPolygonApiKey(): string | undefined {
  const cfg = (Constants.expoConfig?.extra as any) || {};
  return cfg.polygonApiKey as string | undefined;
}

function parseIsoToMs(iso?: string): number | null {
  if (!iso || typeof iso !== "string") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function toNewYorkMinutesSinceMidnight(date: Date): {
  isWeekday: boolean;
  minutes: number;
} {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
    const weekday = parts.find((p) => p.type === "weekday")?.value || "";
    const isWeekday = Boolean(weekday && !["Sat", "Sun"].includes(weekday));
    return { isWeekday, minutes: hour * 60 + minute };
  } catch {
    // Fallback to local clock if Intl/timezone fails (should be rare)
    const d = new Date(date);
    return {
      isWeekday: d.getDay() !== 0 && d.getDay() !== 6,
      minutes: d.getHours() * 60 + d.getMinutes(),
    };
  }
}

function resolveSessionLabel(
  market: string | undefined,
  serverTimeIso: string | undefined,
  exchanges?: Record<string, ExchangeStatus>
): MarketSessionInfo["sessionLabel"] {
  const m = (market || "").toLowerCase();
  if (m.includes("pre")) return "pre-market";
  if (m.includes("extended") || m.includes("after")) return "after-hours";
  if (m === "open") return "regular";
  if (m === "closed") {
    // Might still be pre/after on holidays? Treat as closed.
    return "closed";
  }

  // Fallback: derive from server time windows in ET using Polygon's server clock
  const ms = parseIsoToMs(serverTimeIso);
  if (ms) {
    const { isWeekday, minutes } = toNewYorkMinutesSinceMidnight(new Date(ms));
    if (!isWeekday) return "closed";
    if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return "pre-market";
    if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "regular";
    if (minutes >= 16 * 60 && minutes < 20 * 60) return "after-hours";
    return "closed";
  }

  // Final fallback: use exchange hints if provided
  const nyse = exchanges?.nyse?.toLowerCase();
  if (nyse === "open") return "regular";
  if (nyse === "extended-hours") return "after-hours";
  return "closed";
}

export async function fetchPolygonMarketNow(): Promise<MarketSessionInfo> {
  const key = getPolygonApiKey();
  let payload: PolygonMarketNowResponse | null = null;

  if (key) {
    try {
      const url = `https://api.polygon.io/v1/marketstatus/now?apiKey=${encodeURIComponent(
        key
      )}`;
      const res = await fetch(url);
      if (res.ok) {
        payload = (await res.json()) as PolygonMarketNowResponse;
      }
    } catch {}
  }

  const serverIso = payload?.serverTime;
  const serverMs = parseIsoToMs(serverIso);
  const serverOffsetMs = serverMs !== null ? serverMs - Date.now() : 0;
  const sessionLabel = resolveSessionLabel(
    payload?.market,
    serverIso,
    payload?.exchanges
  );

  const isRegularOpen = sessionLabel === "regular";
  const isPreMarket = sessionLabel === "pre-market";
  const isAfterHours = sessionLabel === "after-hours";
  const isClosed = sessionLabel === "closed";

  return {
    sessionLabel,
    market: payload?.market,
    serverTimeIso: serverIso,
    serverTimeMs: serverMs,
    serverOffsetMs,
    isRegularOpen,
    isPreMarket,
    isAfterHours,
    isClosed,
    exchanges: payload?.exchanges,
  };
}

export async function fetchPolygonMarketUpcoming(): Promise<
  PolygonUpcomingItem[]
> {
  const key = getPolygonApiKey();
  if (!key) return [];
  try {
    const url = `https://api.polygon.io/v1/marketstatus/upcoming?apiKey=${encodeURIComponent(
      key
    )}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as PolygonUpcomingItem[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
