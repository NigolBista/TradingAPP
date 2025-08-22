import Constants from "expo-constants";
import { polygonRealtime } from "./polygonRealtime";
import { simulatorRealtime } from "./simulatorRealtime";

type Listener = (symbol: string, price: number, ts: number) => void;

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

  unsubscribe(symbols: string[]): void {
    try {
      polygonRealtime.unsubscribeTrades(symbols);
      polygonRealtime.unsubscribeAggMin(symbols);
    } catch {}
    try {
      simulatorRealtime.unsubscribe(symbols);
    } catch {}
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
