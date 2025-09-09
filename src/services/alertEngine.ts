import {
  useAlertStore,
  shouldTrigger,
  type PriceAlert,
} from "../store/alertStore";
import { sendLocalNotification } from "./notifications";
import polygonRealtime from "./polygonRealtime";
import { simulatorRealtime } from "./simulatorRealtime";
import Constants from "expo-constants";

type PriceListener = (symbol: string, price: number, ts: number) => void;

class AlertEngine {
  private started = false;
  private lastPriceMap = new Map<
    string,
    { prev?: number; last?: number; ts?: number }
  >();
  private unsubPolygon: (() => void) | null = null;
  private unsubSimulator: (() => void) | null = null;

  start(): void {
    if (this.started) return;
    this.started = true;

    const onPrice: PriceListener = (symbol, price, ts) => {
      const key = symbol.toUpperCase();
      const record = this.lastPriceMap.get(key) || {};
      this.lastPriceMap.set(key, { prev: record.last, last: price, ts });
      this.evaluateSymbol(key);
    };

    // Attach both polygon and simulator listeners (whichever is used in app)
    try {
      this.unsubPolygon = polygonRealtime.onPrice(onPrice);
    } catch {}
    try {
      this.unsubSimulator = simulatorRealtime.onPrice(onPrice);
    } catch {}
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.unsubPolygon) {
      try {
        this.unsubPolygon();
      } catch {}
      this.unsubPolygon = null;
    }
    if (this.unsubSimulator) {
      try {
        this.unsubSimulator();
      } catch {}
      this.unsubSimulator = null;
    }
  }

  private evaluateSymbol(symbol: string): void {
    const { getActiveAlertsForSymbol, markTriggered } =
      useAlertStore.getState();
    const alerts = getActiveAlertsForSymbol(symbol);
    if (!alerts || alerts.length === 0) return;

    const prices = this.lastPriceMap.get(symbol) || {};
    const last = prices.last;
    const prev = prices.prev;
    if (!Number.isFinite(last)) return;

    for (const a of alerts) {
      if (shouldTrigger(a.condition, last as number, a.price, prev)) {
        markTriggered(a.id);
        // Fire local notification
        const cond = a.condition.replace("_", " ");
        const body = `${symbol} ${cond} ${a.price.toFixed(2)} (${a.source})`;
        sendLocalNotification("Price Alert", body).catch(() => {});
      }
    }
  }
}

export const alertEngine = new AlertEngine();

export function initializeAlertEngine(): void {
  try {
    alertEngine.start();
  } catch (e) {
    // no-op
  }
}
