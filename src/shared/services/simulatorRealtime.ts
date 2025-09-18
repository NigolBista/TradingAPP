import { saveQuotes, SimpleQuote } from "./quotes";

type PriceListener = (symbol: string, price: number, ts: number) => void;

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

class SimulatorRealtimeClient {
  private listeners = new Set<PriceListener>();
  private timers = new Map<string, any>();
  private basePrice = new Map<string, number>();
  private volatility = 0.002; // ~0.2% per tick

  onPrice(listener: PriceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(symbol: string, price: number, ts: number) {
    for (const l of Array.from(this.listeners)) {
      try {
        l(symbol, price, ts);
      } catch {}
    }
  }

  private nextPrice(symbol: string): number {
    const current = this.basePrice.get(symbol) ?? 100 + Math.random() * 50;
    const drift = (Math.random() - 0.5) * 2 * this.volatility;
    const next = Math.max(0.01, current * (1 + drift));
    this.basePrice.set(symbol, next);
    return next;
  }

  async subscribe(symbols: string[]): Promise<void> {
    for (const s of symbols) {
      if (this.timers.has(s)) continue;
      // start a jittery interval per symbol
      const tick = async () => {
        const price = this.nextPrice(s);
        const ts = Date.now();
        this.emit(s, price, ts);
        try {
          const q: SimpleQuote = {
            symbol: s,
            last: price,
            change: 0,
            changePercent: 0,
            updated: Math.floor(ts / 1000),
          };
          await saveQuotes({ [s]: q });
        } catch {}
        // randomize next tick 50-200ms
        const delay = 50 + Math.round(Math.random() * 150);
        this.timers.set(s, setTimeout(tick, delay));
      };
      this.timers.set(s, setTimeout(tick, 20 + Math.round(Math.random() * 60)));
    }
  }

  unsubscribe(symbols: string[]): void {
    for (const s of symbols) {
      const t = this.timers.get(s);
      if (t) clearTimeout(t);
      this.timers.delete(s);
    }
  }

  clearAll(): void {
    this.unsubscribe(Array.from(this.timers.keys()));
  }
}

export const simulatorRealtime = new SimulatorRealtimeClient();
export default simulatorRealtime;
