import Constants from "expo-constants";
import { saveQuotes, SimpleQuote } from "./quotes";

type PriceListener = (symbol: string, price: number, ts: number) => void;
type CandleListener = (symbol: string, candle: RealtimeCandle) => void;

export interface RealtimeCandle {
  symbol: string;
  time: number; // timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe: string; // e.g., "1m", "5m", "1h", "1d"
}

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
  private pendingAggSec = new Set<string>();
  private pendingAggHour = new Set<string>();
  private pendingAggDay = new Set<string>();
  private priceListeners = new Set<PriceListener>();
  private candleListeners = new Set<CandleListener>();

  private get url(): string {
    return "wss://socket.polygon.io/stocks";
  }

  onPrice(listener: PriceListener): () => void {
    this.priceListeners.add(listener);
    return () => {
      this.priceListeners.delete(listener);
    };
  }

  onCandle(listener: CandleListener): () => void {
    this.candleListeners.add(listener);
    return () => {
      this.candleListeners.delete(listener);
    };
  }

  private emitPrice(symbol: string, price: number, ts: number) {
    for (const l of Array.from(this.priceListeners)) {
      try {
        l(symbol, price, ts);
      } catch {}
    }
  }

  private emitCandle(candle: RealtimeCandle) {
    for (const l of Array.from(this.candleListeners)) {
      try {
        l(candle.symbol, candle);
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

    // Handle various aggregate types
    // Second aggregates: { ev: "A", sym: "AAPL", o: open, h: high, l: low, c: close, v: volume, t: epochMs }
    if (ev === "A" && msg?.sym && this.isValidCandle(msg)) {
      this.handleAggregateCandle(msg, "1s");
      return;
    }

    // Minute aggregates: { ev: "AM", sym: "AAPL", o: open, h: high, l: low, c: close, v: volume, t: epochMs }
    if (ev === "AM" && msg?.sym && this.isValidCandle(msg)) {
      this.handleAggregateCandle(msg, "1m");
      return;
    }

    // Hour aggregates: { ev: "AH", sym: "AAPL", o: open, h: high, l: low, c: close, v: volume, t: epochMs }
    if (ev === "AH" && msg?.sym && this.isValidCandle(msg)) {
      this.handleAggregateCandle(msg, "1h");
      return;
    }

    // Day aggregates: { ev: "AD", sym: "AAPL", o: open, h: high, l: low, c: close, v: volume, t: epochMs }
    if (ev === "AD" && msg?.sym && this.isValidCandle(msg)) {
      this.handleAggregateCandle(msg, "1d");
      return;
    }

    // Fallback: emit price for any aggregate with close price
    if (
      (ev === "AM" || ev === "A" || ev === "AH" || ev === "AD") &&
      msg?.sym &&
      typeof msg?.c === "number"
    ) {
      const symbol = String(msg.sym);
      const price = Number(msg.c);
      const ts = Number(msg.t || Date.now());
      this.emitPrice(symbol, price, ts);
      return;
    }
  }

  private isValidCandle(msg: any): boolean {
    return (
      typeof msg.o === "number" &&
      typeof msg.h === "number" &&
      typeof msg.l === "number" &&
      typeof msg.c === "number" &&
      typeof msg.v === "number" &&
      typeof msg.t === "number"
    );
  }

  private getTimeframeMs(timeframe: string): number {
    const tf = (timeframe || "").toLowerCase();
    if (tf === "1s") return 1000;
    if (tf === "1m") return 60 * 1000;
    if (tf === "1h") return 60 * 60 * 1000;
    if (tf === "1d") return 24 * 60 * 60 * 1000;
    if (tf === "1w" || tf.includes("week")) return 7 * 24 * 60 * 60 * 1000;
    if (tf === "1m" || tf === "1min") return 60 * 1000;
    if (tf === "1mo" || tf.includes("month") || timeframe === "1M")
      return 30 * 24 * 60 * 60 * 1000; // approx month
    return 60 * 1000;
  }

  private handleAggregateCandle(msg: any, timeframe: string) {
    const symbol = String(msg.sym);

    // Ensure proper time alignment for the timeframe
    const timestamp = Number(msg.t);
    const timeframeMs = this.getTimeframeMs(timeframe);
    const alignedTime = Math.floor(timestamp / timeframeMs) * timeframeMs;

    const candle: RealtimeCandle = {
      symbol,
      time: alignedTime,
      open: Number(msg.o),
      high: Number(msg.h),
      low: Number(msg.l),
      close: Number(msg.c),
      volume: Number(msg.v),
      timeframe,
    };

    // Emit both candle and price events
    this.emitCandle(candle);
    this.emitPrice(symbol, candle.close, candle.time);
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
    const aggSecParams = Array.from(this.pendingAggSec).map((s) => `A.${s}`);
    const aggMinParams = Array.from(this.pendingAggMin).map((s) => `AM.${s}`);
    const aggHourParams = Array.from(this.pendingAggHour).map((s) => `AH.${s}`);
    const aggDayParams = Array.from(this.pendingAggDay).map((s) => `AD.${s}`);
    const params = [
      ...tradeParams,
      ...aggSecParams,
      ...aggMinParams,
      ...aggHourParams,
      ...aggDayParams,
    ].join(",");
    if (params.length > 0) {
      this.send({ action: "subscribe", params });
    }
  }

  async subscribeTrades(symbols: string[]): Promise<void> {
    symbols.forEach((s) => this.pendingTrades.add(s));
    await this.ensureConnected();
    this.flushSubscriptions();
  }

  async subscribeAggSec(symbols: string[]): Promise<void> {
    symbols.forEach((s) => this.pendingAggSec.add(s));
    await this.ensureConnected();
    this.flushSubscriptions();
  }

  async subscribeAggMin(symbols: string[]): Promise<void> {
    symbols.forEach((s) => this.pendingAggMin.add(s));
    await this.ensureConnected();
    this.flushSubscriptions();
  }

  async subscribeAggHour(symbols: string[]): Promise<void> {
    symbols.forEach((s) => this.pendingAggHour.add(s));
    await this.ensureConnected();
    this.flushSubscriptions();
  }

  async subscribeAggDay(symbols: string[]): Promise<void> {
    symbols.forEach((s) => this.pendingAggDay.add(s));
    await this.ensureConnected();
    this.flushSubscriptions();
  }

  // Convenience method to subscribe to appropriate aggregate based on timeframe
  async subscribeForTimeframe(
    symbols: string[],
    timeframe: string
  ): Promise<void> {
    const tf = timeframe.toLowerCase();
    // Always include trades to keep last price flowing
    await this.subscribeTrades(symbols);
    if (tf.includes("s")) {
      await this.subscribeAggSec(symbols);
      return;
    }
    if (tf.includes("min") || /(^|\d)m($|[^o])/.test(tf)) {
      await this.subscribeAggMin(symbols);
      return;
    }
    if (tf.includes("h") || tf.includes("hour")) {
      await this.subscribeAggHour(symbols);
      return;
    }
    if (tf.includes("d") || tf.includes("day")) {
      await this.subscribeAggDay(symbols);
      return;
    }
    if (tf.includes("w") || tf.includes("week")) {
      // No native weekly; approximate by day and let aggregator roll
      await this.subscribeAggDay(symbols);
      return;
    }
    if (tf.includes("mo") || tf.includes("month") || timeframe === "1M") {
      // No native monthly; approximate by day and let aggregator roll
      await this.subscribeAggDay(symbols);
      return;
    }
    await this.subscribeAggMin(symbols);
  }

  unsubscribeTrades(symbols: string[]): void {
    symbols.forEach((s) => this.pendingTrades.delete(s));
    const params = symbols.map((s) => `T.${s}`).join(",");
    if (params.length > 0) this.send({ action: "unsubscribe", params });
  }

  unsubscribeAggSec(symbols: string[]): void {
    symbols.forEach((s) => this.pendingAggSec.delete(s));
    const params = symbols.map((s) => `A.${s}`).join(",");
    if (params.length > 0) this.send({ action: "unsubscribe", params });
  }

  unsubscribeAggMin(symbols: string[]): void {
    symbols.forEach((s) => this.pendingAggMin.delete(s));
    const params = symbols.map((s) => `AM.${s}`).join(",");
    if (params.length > 0) this.send({ action: "unsubscribe", params });
  }

  unsubscribeAggHour(symbols: string[]): void {
    symbols.forEach((s) => this.pendingAggHour.delete(s));
    const params = symbols.map((s) => `AH.${s}`).join(",");
    if (params.length > 0) this.send({ action: "unsubscribe", params });
  }

  unsubscribeAggDay(symbols: string[]): void {
    symbols.forEach((s) => this.pendingAggDay.delete(s));
    const params = symbols.map((s) => `AD.${s}`).join(",");
    if (params.length > 0) this.send({ action: "unsubscribe", params });
  }

  clearAll(): void {
    const trades = Array.from(this.pendingTrades);
    const aggSecs = Array.from(this.pendingAggSec);
    const aggMins = Array.from(this.pendingAggMin);
    const aggHours = Array.from(this.pendingAggHour);
    const aggDays = Array.from(this.pendingAggDay);

    if (trades.length) this.unsubscribeTrades(trades);
    if (aggSecs.length) this.unsubscribeAggSec(aggSecs);
    if (aggMins.length) this.unsubscribeAggMin(aggMins);
    if (aggHours.length) this.unsubscribeAggHour(aggHours);
    if (aggDays.length) this.unsubscribeAggDay(aggDays);

    this.pendingTrades.clear();
    this.pendingAggSec.clear();
    this.pendingAggMin.clear();
    this.pendingAggHour.clear();
    this.pendingAggDay.clear();
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
