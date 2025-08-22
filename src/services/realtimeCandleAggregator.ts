import { polygonRealtime, RealtimeCandle } from "./polygonRealtime";

export interface AggregatedCandle {
  symbol: string;
  time: number; // timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe: string;
  isComplete: boolean; // true if the candle period is finished
}

type CandleUpdateListener = (symbol: string, candle: AggregatedCandle) => void;

interface CandleBuffer {
  [symbol: string]: {
    [timeframe: string]: AggregatedCandle | null;
  };
}

class RealtimeCandleAggregator {
  private candleBuffer: CandleBuffer = {};
  private listeners = new Set<CandleUpdateListener>();
  private tickBuffer: {
    [symbol: string]: { price: number; ts: number; volume?: number }[];
  } = {};
  private intervalTimers: { [key: string]: NodeJS.Timeout } = {};

  constructor() {
    // Listen to both candle and price events from Polygon
    polygonRealtime.onCandle((symbol, candle) => {
      this.handlePolygonCandle(symbol, candle);
    });

    polygonRealtime.onPrice((symbol, price, ts) => {
      this.handlePolygonTick(symbol, price, ts);
    });
  }

  onCandleUpdate(listener: CandleUpdateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitCandleUpdate(symbol: string, candle: AggregatedCandle) {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(symbol, candle);
      } catch (error) {
        console.warn("Error in candle update listener:", error);
      }
    }
  }

  private handlePolygonCandle(symbol: string, candle: RealtimeCandle) {
    const aggregated: AggregatedCandle = {
      ...candle,
      isComplete: true, // Polygon aggregates are complete bars
    };

    this.updateCandleBuffer(symbol, candle.timeframe, aggregated);
    this.emitCandleUpdate(symbol, aggregated);
  }

  private handlePolygonTick(symbol: string, price: number, ts: number) {
    // Buffer ticks for custom timeframe aggregation
    if (!this.tickBuffer[symbol]) {
      this.tickBuffer[symbol] = [];
    }

    this.tickBuffer[symbol].push({ price, ts });

    // Keep only last 1000 ticks per symbol to prevent memory issues
    if (this.tickBuffer[symbol].length > 1000) {
      this.tickBuffer[symbol] = this.tickBuffer[symbol].slice(-500);
    }

    // Update current candles for all active timeframes
    this.updateCurrentCandles(symbol, price, ts);
  }

  private updateCurrentCandles(symbol: string, price: number, ts: number) {
    if (!this.candleBuffer[symbol]) return;

    for (const timeframe in this.candleBuffer[symbol]) {
      const currentCandle = this.candleBuffer[symbol][timeframe];
      if (!currentCandle) continue;

      const timeframeMs = this.parseTimeframeToMs(timeframe);
      const candleStartTime = Math.floor(ts / timeframeMs) * timeframeMs;

      // Check if this tick belongs to the current candle
      if (currentCandle.time === candleStartTime) {
        // Handle first tick initialization
        const isFirstTick =
          currentCandle.open === 0 &&
          currentCandle.high === 0 &&
          currentCandle.low === Number.MAX_VALUE;

        const updatedCandle: AggregatedCandle = {
          ...currentCandle,
          open: isFirstTick ? price : currentCandle.open, // Set open on first tick
          high: isFirstTick ? price : Math.max(currentCandle.high, price),
          low: isFirstTick ? price : Math.min(currentCandle.low, price),
          close: price,
          isComplete: false,
        };

        this.updateCandleBuffer(symbol, timeframe, updatedCandle);
        this.emitCandleUpdate(symbol, updatedCandle);
      } else if (candleStartTime > currentCandle.time) {
        // Complete the previous candle first
        const completedCandle: AggregatedCandle = {
          ...currentCandle,
          isComplete: true,
        };
        this.emitCandleUpdate(symbol, completedCandle);

        // Start new candle - ensure we have a valid previous close, otherwise use current price
        const previousClose =
          currentCandle.close > 0 ? currentCandle.close : price;
        const newCandle: AggregatedCandle = {
          symbol,
          time: candleStartTime,
          open: previousClose, // Use previous close as new open, fallback to current price
          high: price, // First tick sets initial high
          low: price, // First tick sets initial low
          close: price,
          volume: 0, // We don't have volume from ticks
          timeframe,
          isComplete: false,
        };

        this.updateCandleBuffer(symbol, timeframe, newCandle);
        this.emitCandleUpdate(symbol, newCandle);
      }
    }
  }

  private updateCandleBuffer(
    symbol: string,
    timeframe: string,
    candle: AggregatedCandle
  ) {
    if (!this.candleBuffer[symbol]) {
      this.candleBuffer[symbol] = {};
    }
    this.candleBuffer[symbol][timeframe] = candle;
  }

  private parseTimeframeToMs(timeframe: string): number {
    const tf = timeframe.toLowerCase();

    if (tf.includes("s")) {
      const seconds = parseInt(tf.replace(/[^0-9]/g, "")) || 1;
      return seconds * 1000;
    } else if (tf.includes("m") || tf.includes("min")) {
      const minutes = parseInt(tf.replace(/[^0-9]/g, "")) || 1;
      return minutes * 60 * 1000;
    } else if (tf.includes("h") || tf.includes("hour")) {
      const hours = parseInt(tf.replace(/[^0-9]/g, "")) || 1;
      return hours * 60 * 60 * 1000;
    } else if (tf.includes("d") || tf.includes("day")) {
      const days = parseInt(tf.replace(/[^0-9]/g, "")) || 1;
      return days * 24 * 60 * 60 * 1000;
    }

    // Default to 1 minute
    return 60 * 1000;
  }

  // Initialize candle tracking for a symbol and timeframe
  initializeCandle(
    symbol: string,
    timeframe: string,
    initialCandle?: AggregatedCandle
  ) {
    if (!this.candleBuffer[symbol]) {
      this.candleBuffer[symbol] = {};
    }

    if (initialCandle) {
      // Ensure the initial candle has proper time alignment
      const timeframeMs = this.parseTimeframeToMs(timeframe);
      const alignedTime =
        Math.floor(initialCandle.time / timeframeMs) * timeframeMs;
      this.candleBuffer[symbol][timeframe] = {
        ...initialCandle,
        time: alignedTime,
      };
    } else {
      // Create a placeholder candle that will be properly initialized with first tick
      const now = Date.now();
      const timeframeMs = this.parseTimeframeToMs(timeframe);
      const candleStartTime = Math.floor(now / timeframeMs) * timeframeMs;

      this.candleBuffer[symbol][timeframe] = {
        symbol,
        time: candleStartTime,
        open: 0, // Will be set with first tick
        high: 0, // Will be set with first tick
        low: Number.MAX_VALUE, // Will be set with first tick
        close: 0, // Will be set with first tick
        volume: 0,
        timeframe,
        isComplete: false,
      };
    }

    // Set up periodic completion check for this timeframe
    const key = `${symbol}-${timeframe}`;
    if (this.intervalTimers[key]) {
      clearInterval(this.intervalTimers[key]);
    }

    const timeframeMs = this.parseTimeframeToMs(timeframe);
    this.intervalTimers[key] = setInterval(() => {
      this.checkCandleCompletion(symbol, timeframe);
    }, Math.min(timeframeMs / 10, 5000)); // Check every 1/10th of timeframe or max 5 seconds
  }

  private checkCandleCompletion(symbol: string, timeframe: string) {
    const candle = this.candleBuffer[symbol]?.[timeframe];
    if (!candle || candle.isComplete) return;

    const now = Date.now();
    const timeframeMs = this.parseTimeframeToMs(timeframe);
    const candleEndTime = candle.time + timeframeMs;

    if (now >= candleEndTime) {
      // Mark candle as complete
      const completedCandle: AggregatedCandle = {
        ...candle,
        isComplete: true,
      };

      this.updateCandleBuffer(symbol, timeframe, completedCandle);
      this.emitCandleUpdate(symbol, completedCandle);
    }
  }

  // Clean up resources for a symbol
  cleanup(symbol: string, timeframe?: string) {
    if (timeframe) {
      // Clean up specific timeframe
      if (this.candleBuffer[symbol]) {
        delete this.candleBuffer[symbol][timeframe];
      }

      const key = `${symbol}-${timeframe}`;
      if (this.intervalTimers[key]) {
        clearInterval(this.intervalTimers[key]);
        delete this.intervalTimers[key];
      }
    } else {
      // Clean up all timeframes for symbol
      delete this.candleBuffer[symbol];
      delete this.tickBuffer[symbol];

      // Clear all timers for this symbol
      Object.keys(this.intervalTimers).forEach((key) => {
        if (key.startsWith(`${symbol}-`)) {
          clearInterval(this.intervalTimers[key]);
          delete this.intervalTimers[key];
        }
      });
    }
  }

  // Get current candle for a symbol and timeframe
  getCurrentCandle(symbol: string, timeframe: string): AggregatedCandle | null {
    return this.candleBuffer[symbol]?.[timeframe] || null;
  }

  // Build candles from tick buffer for custom timeframes
  buildCandlesFromTicks(
    symbol: string,
    timeframe: string,
    count: number = 100
  ): AggregatedCandle[] {
    const ticks = this.tickBuffer[symbol];
    if (!ticks || ticks.length === 0) return [];

    const timeframeMs = this.parseTimeframeToMs(timeframe);
    const candleMap: { [time: number]: AggregatedCandle } = {};

    // Sort ticks by timestamp to ensure proper order
    const sortedTicks = [...ticks].sort((a, b) => a.ts - b.ts);

    // Group ticks into candles
    for (const tick of sortedTicks) {
      const candleStartTime = Math.floor(tick.ts / timeframeMs) * timeframeMs;

      if (!candleMap[candleStartTime]) {
        candleMap[candleStartTime] = {
          symbol,
          time: candleStartTime,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price,
          volume: tick.volume || 0,
          timeframe,
          isComplete: true,
        };
      } else {
        const candle = candleMap[candleStartTime];
        candle.high = Math.max(candle.high, tick.price);
        candle.low = Math.min(candle.low, tick.price);
        candle.close = tick.price; // Last tick in chronological order sets close
        candle.volume += tick.volume || 0;
      }
    }

    // Convert to array and sort by time
    const sortedCandles = Object.values(candleMap).sort(
      (a, b) => a.time - b.time
    );

    // Return last 'count' candles
    return sortedCandles.slice(-count);
  }
}

export const realtimeCandleAggregator = new RealtimeCandleAggregator();
