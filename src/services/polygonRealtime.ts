import Constants from "expo-constants";
import { saveQuotes, SimpleQuote } from "./quotes";

type PriceListener = (symbol: string, price: number, ts: number) => void;

function getApiKey(): string | undefined {
  const cfg = (Constants.expoConfig?.extra as any) || {};
  return cfg.polygonApiKey as string | undefined;
}

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

class PolygonRealtimeClient {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private authed = false;
  private reconnectAttempts = 0;
  private pendingTrades = new Set<string>();
  private pendingAggMin = new Set<string>();
  private priceListeners = new Set<PriceListener>();

  private get url(): string {
    return "wss://socket.polygon.io/stocks";
  }

  onPrice(listener: PriceListener): () => void {
    this.priceListeners.add(listener);
    return () => {
      this.priceListeners.delete(listener);
    };
  }

  private emitPrice(symbol: string, price: number, ts: number) {
    for (const l of Array.from(this.priceListeners)) {
      try {
        l(symbol, price, ts);
      } catch {}
    }
  }

  async ensureConnected(): Promise<void> {
    if (this.ws && this.authed) return;
    if (this.isConnecting) return;
    const key = getApiKey();
    if (!key)
      throw new Error("Polygon API key missing. Set extra.polygonApiKey.");

    this.isConnecting = true;
    try {
      await this.connect(key);
    } finally {
      this.isConnecting = false;
    }
  }

  private async connect(key: string) {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }

    this.authed = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      try {
        this.send({ action: "auth", params: key });
      } catch {}
    };

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as any);
        // Polygon may send either single object or array of objects
        const msgs: any[] = Array.isArray(data) ? data : [data];
        for (const m of msgs) {
          this.handleMessage(m);
        }
      } catch {}
    };

    this.ws.onerror = () => {
      // no-op; onclose will handle
    };

    this.ws.onclose = async () => {
      this.authed = false;
      this.ws = null;
      // Exponential backoff up to ~10s
      const delay = Math.min(
        10_000,
        500 * Math.pow(2, this.reconnectAttempts++)
      );
      await wait(delay);
      try {
        const k = getApiKey();
        if (k) await this.connect(k);
      } catch {}
    };
  }

  private handleMessage(msg: any) {
    const ev = msg?.ev || msg?.event; // old/new keys
    if (
      ev === "status" &&
      (msg.status === "auth_success" || msg.message === "authenticated")
    ) {
      this.authed = true;
      this.reconnectAttempts = 0;
      // Re-subscribe pending
      this.flushSubscriptions();
      return;
    }

    // Trades: { ev: "T", sym: "AAPL", p: 189.23, t: 1699999999999 }
    if (ev === "T" && msg?.sym && typeof msg?.p === "number") {
      const symbol = String(msg.sym);
      const price = Number(msg.p);
      const ts = Number(msg.t || Date.now());
      this.emitPrice(symbol, price, ts);
      return;
    }

    // Minute aggregate: { ev: "AM", sym: "AAPL", c: close, t: epochMs }
    if (ev === "AM" && msg?.sym && typeof msg?.c === "number") {
      const symbol = String(msg.sym);
      const price = Number(msg.c);
      const ts = Number(msg.t || Date.now());
      this.emitPrice(symbol, price, ts);
      return;
    }
  }

  private send(obj: any) {
    if (!this.ws || this.ws.readyState !== this.ws.OPEN) return;
    try {
      (this.ws as any).send(JSON.stringify(obj));
    } catch {}
  }

  private flushSubscriptions() {
    if (!this.ws || !this.authed) return;
    const tradeParams = Array.from(this.pendingTrades).map((s) => `T.${s}`);
    const aggParams = Array.from(this.pendingAggMin).map((s) => `AM.${s}`);
    const params = [...tradeParams, ...aggParams].join(",");
    if (params.length > 0) {
      this.send({ action: "subscribe", params });
    }
  }

  async subscribeTrades(symbols: string[]): Promise<void> {
    symbols.forEach((s) => this.pendingTrades.add(s));
    await this.ensureConnected();
    this.flushSubscriptions();
  }

  async subscribeAggMin(symbols: string[]): Promise<void> {
    symbols.forEach((s) => this.pendingAggMin.add(s));
    await this.ensureConnected();
    this.flushSubscriptions();
  }

  unsubscribeTrades(symbols: string[]): void {
    symbols.forEach((s) => this.pendingTrades.delete(s));
    const params = symbols.map((s) => `T.${s}`).join(",");
    if (params.length > 0) this.send({ action: "unsubscribe", params });
  }

  unsubscribeAggMin(symbols: string[]): void {
    symbols.forEach((s) => this.pendingAggMin.delete(s));
    const params = symbols.map((s) => `AM.${s}`).join(",");
    if (params.length > 0) this.send({ action: "unsubscribe", params });
  }

  clearAll(): void {
    const trades = Array.from(this.pendingTrades);
    const aggs = Array.from(this.pendingAggMin);
    if (trades.length) this.unsubscribeTrades(trades);
    if (aggs.length) this.unsubscribeAggMin(aggs);
    this.pendingTrades.clear();
    this.pendingAggMin.clear();
  }

  disconnect(): void {
    this.clearAll();
    try {
      this.ws?.close();
    } catch {}
    this.ws = null;
    this.authed = false;
  }
}

export const polygonRealtime = new PolygonRealtimeClient();

// Convenience: attach to save quotes so watchlists update live
polygonRealtime.onPrice(async (symbol, price, ts) => {
  try {
    const q: SimpleQuote = {
      symbol,
      last: price,
      change: 0,
      changePercent: 0,
      updated: Math.floor(ts / 1000),
    };
    await saveQuotes({ [symbol]: q });
  } catch {}
});

export default polygonRealtime;
