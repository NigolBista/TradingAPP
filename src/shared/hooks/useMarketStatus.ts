import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPolygonMarketNow,
  fetchPolygonMarketUpcoming,
  type MarketSessionInfo,
  type PolygonUpcomingItem,
} from "../shared/services/polygonMarketStatus";

export interface UseMarketStatusState extends MarketSessionInfo {
  now: MarketSessionInfo | null;
  upcoming: PolygonUpcomingItem[];
  serverNow: Date | null; // serverTimeIso -> Date
  etOffsetMinutes: number | null; // ET offset from UTC in minutes (-240/-300)
}

export function useMarketStatus(pollMs: number = 30_000): UseMarketStatusState {
  const [now, setNow] = useState<MarketSessionInfo | null>(null);
  const [upcoming, setUpcoming] = useState<PolygonUpcomingItem[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let timer: any;

    async function tick() {
      try {
        const [n, u] = await Promise.all([
          fetchPolygonMarketNow(),
          // Cache upcoming daily; avoid hammering
          upcoming.length === 0
            ? fetchPolygonMarketUpcoming()
            : Promise.resolve(upcoming),
        ]);
        if (!mountedRef.current) return;
        setNow(n);
        if (upcoming.length === 0 && Array.isArray(u)) setUpcoming(u);
      } catch {}
    }

    tick();
    timer = setInterval(tick, Math.max(10_000, pollMs));
    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  const serverNow = useMemo(() => {
    return now?.serverTimeMs ? new Date(now.serverTimeMs) : null;
  }, [now?.serverTimeMs]);

  function parseOffsetFromIso(iso?: string): number | null {
    if (!iso || typeof iso !== "string") return null;
    const m = iso.match(/([+-])(\d{2}):(\d{2})$/);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    const hh = Number(m[2]);
    const mm = Number(m[3]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    return sign * (hh * 60 + mm);
  }

  function estimateEtOffsetMinutes(
    ms?: number | null,
    iso?: string
  ): number | null {
    const parsed = parseOffsetFromIso(iso);
    if (parsed !== null) return parsed;
    if (!ms || !Number.isFinite(ms)) return null;
    try {
      const d = new Date(ms);
      const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(d);
      const eh = Number(parts.find((p) => p.type === "hour")?.value || "0");
      const em = Number(parts.find((p) => p.type === "minute")?.value || "0");
      let delta = eh * 60 + em - utcMin; // ET - UTC (in minutes)
      if (delta > 12 * 60) delta -= 24 * 60;
      if (delta < -12 * 60) delta += 24 * 60;
      return delta;
    } catch {
      return null;
    }
  }

  const etOffsetMinutes = useMemo(() => {
    return estimateEtOffsetMinutes(
      now?.serverTimeMs ?? null,
      now?.serverTimeIso
    );
  }, [now?.serverTimeMs, now?.serverTimeIso]);

  return {
    // Flatten core info for convenience
    sessionLabel: now?.sessionLabel || "closed",
    market: now?.market,
    serverTimeIso: now?.serverTimeIso,
    serverTimeMs: now?.serverTimeMs ?? null,
    serverOffsetMs: now?.serverOffsetMs ?? 0,
    isRegularOpen: Boolean(now?.isRegularOpen),
    isPreMarket: Boolean(now?.isPreMarket),
    isAfterHours: Boolean(now?.isAfterHours),
    isClosed: now ? Boolean(now.isClosed) : true,
    exchanges: now?.exchanges,
    now: now || null,
    upcoming,
    serverNow,
    etOffsetMinutes,
  };
}

export default useMarketStatus;
