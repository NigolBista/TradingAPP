import Constants from "expo-constants";
import { polygonRealtime } from "./polygonRealtime";
import { simulatorRealtime } from "./simulatorRealtime";
import { realtimeCandleAggregator } from "./realtimeCandleAggregator";

type Listener = (symbol: string, price: number, ts: number) => void;
type CandleListener = (symbol: string, candle: any) => void;

export type RealtimeProvider = "polygon" | "simulator";

function getConfig(): { provider: RealtimeProvider; developerMode: boolean } {
  const cfg = (Constants.expoConfig?.extra as any) || {};
  const developerMode = Boolean(cfg.developerMode);
  const provider = (cfg.realtimeProvider as RealtimeProvider) || "polygon";
  return { provider, developerMode };
}

class RealtimeRouter {
  onPrice(listener: Listener): () => void {
    // attach to both and fan-in; underlying providers return detach
    const a = polygonRealtime.onPrice(listener);
    const b = simulatorRealtime.onPrice(listener);
    return () => {
      try {
        a();
      } catch {}
      try {
        b();
      } catch {}
    };
  }

  onCandle(listener: CandleListener): () => void {
    // Listen to aggregated candles from the candle aggregator
    return realtimeCandleAggregator.onCandleUpdate(listener);
  }

  async subscribe(symbols: string[]): Promise<void> {
    const { provider, developerMode } = getConfig();
    const active =
      developerMode && provider === "simulator"
        ? simulatorRealtime
        : polygonRealtime;
    if (developerMode && provider === "simulator") {
      await simulatorRealtime.subscribe(symbols);
      // ensure polygon unsubscribed to avoid noise
      try {
        polygonRealtime.unsubscribeTrades(symbols);
        polygonRealtime.unsubscribeAggMin(symbols);
        polygonRealtime.unsubscribeAggSec(symbols);
        polygonRealtime.unsubscribeAggHour(symbols);
        polygonRealtime.unsubscribeAggDay(symbols);
      } catch {}
      return;
    }
    // polygon path
    try {
      await polygonRealtime.subscribeTrades(symbols);
      await polygonRealtime.subscribeAggMin(symbols);
      // stop simulator for these
      simulatorRealtime.unsubscribe(symbols);
    } catch (e) {
      // fallback: if polygon fails, use simulator in dev mode
      if (developerMode) await simulatorRealtime.subscribe(symbols);
    }
  }

  async subscribeForTimeframe(
    symbols: string[],
    timeframe: string
  ): Promise<void> {
    const { provider, developerMode } = getConfig();

    if (developerMode && provider === "simulator") {
      await simulatorRealtime.subscribe(symbols);
      return;
    }

    // Use Polygon's timeframe-specific subscriptions
    try {
      await polygonRealtime.subscribeForTimeframe(symbols, timeframe);
      // Initialize candle tracking for each symbol
      symbols.forEach((symbol) => {
        realtimeCandleAggregator.initializeCandle(symbol, timeframe);
      });
      // stop simulator for these
      simulatorRealtime.unsubscribe(symbols);
    } catch (e) {
      // fallback: if polygon fails, use simulator in dev mode
      if (developerMode) await simulatorRealtime.subscribe(symbols);
    }
  }

  unsubscribe(symbols: string[]): void {
    try {
      polygonRealtime.unsubscribeTrades(symbols);
      polygonRealtime.unsubscribeAggSec(symbols);
      polygonRealtime.unsubscribeAggMin(symbols);
      polygonRealtime.unsubscribeAggHour(symbols);
      polygonRealtime.unsubscribeAggDay(symbols);
    } catch {}
    try {
      simulatorRealtime.unsubscribe(symbols);
    } catch {}

    // Clean up candle aggregator
    symbols.forEach((symbol) => {
      realtimeCandleAggregator.cleanup(symbol);
    });
  }

  unsubscribeTimeframe(symbols: string[], timeframe: string): void {
    // Clean up specific timeframe tracking
    symbols.forEach((symbol) => {
      realtimeCandleAggregator.cleanup(symbol, timeframe);
    });
  }

  clearAll(): void {
    try {
      polygonRealtime.clearAll();
    } catch {}
    try {
      simulatorRealtime.clearAll();
    } catch {}
  }
}

export const realtimeRouter = new RealtimeRouter();
export default realtimeRouter;
