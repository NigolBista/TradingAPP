import Constants from "expo-constants";
import { Candle } from "./marketProviders";
import {
  IndicatorConfigSpec,
  StrategyConfig,
  StrategyIndicatorType,
  StrategyTimeframe,
} from "../types/strategy";

type PolygonIndicatorEndpoint = "sma" | "ema" | "rsi" | "macd";

type PolygonTimespan = "minute" | "hour" | "day" | "week" | "month";

type IndicatorParams = IndicatorConfigSpec["params"];

interface PolygonIndicatorRequest {
  symbol: string;
  timespan: PolygonTimespan;
  window?: number;
  limit?: number;
  timestamp?: number;
  [key: string]: any;
}

interface PolygonIndicatorResponse<T = any> {
  status: string;
  results?: T[];
  next_url?: string;
  request_id?: string;
}

export interface IndicatorSeriesPoint {
  timestamp: number;
  value: number;
  extra?: Record<string, number>;
}

export interface IndicatorSeries {
  type: StrategyIndicatorType;
  timeframe: StrategyTimeframe;
  params: IndicatorParams;
  values: IndicatorSeriesPoint[];
}

const TIMESCALE_MAP: Record<StrategyTimeframe, PolygonTimespan> = {
  "5m": "minute",
  "15m": "minute",
  "30m": "minute",
  "1h": "hour",
  "4h": "hour",
};

function getPolygonApiKey(): string {
  const key = (Constants.expoConfig?.extra as any)?.polygonApiKey;
  if (!key)
    throw new Error("Polygon API key missing. Set extra.polygonApiKey.");
  return key;
}

function mapTimeframe(timeframe: StrategyTimeframe): PolygonTimespan {
  return TIMESCALE_MAP[timeframe] ?? "minute";
}

async function fetchIndicator<T extends PolygonIndicatorEndpoint, R = any>(
  endpoint: T,
  request: PolygonIndicatorRequest
): Promise<PolygonIndicatorResponse<R>> {
  const apiKey = getPolygonApiKey();
  const query = buildQuery({ ...request, apiKey });
  const url = `https://api.polygon.io/v1/indicators/${endpoint}/${encodeURIComponent(
    request.symbol
  )}?${query}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Polygon indicator request failed: ${res.status} ${body}`);
  }
  return (await res.json()) as PolygonIndicatorResponse<R>;
}

function buildQuery(params: Record<string, any>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    search.append(key, String(value));
  });
  return search.toString();
}

function toSeriesPoints(
  data: any[],
  mapper: (item: any) => IndicatorSeriesPoint
): IndicatorSeriesPoint[] {
  return (data || [])
    .map((item) => {
      try {
        return mapper(item);
      } catch (error) {
        console.warn("Failed to map indicator point", error, item);
        return null;
      }
    })
    .filter((item): item is IndicatorSeriesPoint => Boolean(item));
}

export async function fetchSMA(
  symbol: string,
  timeframe: StrategyTimeframe,
  params: IndicatorParams & { window: number }
): Promise<IndicatorSeries> {
  const response = await fetchIndicator("sma", {
    symbol,
    timespan: mapTimeframe(timeframe),
    window: params.window,
    limit: 200,
  });

  return {
    type: "sma",
    timeframe,
    params,
    values: toSeriesPoints(response.results ?? [], (item: any) => ({
      timestamp: item.timestamp,
      value: item.value,
    })),
  };
}

export async function fetchEMA(
  symbol: string,
  timeframe: StrategyTimeframe,
  params: IndicatorParams & { window: number }
): Promise<IndicatorSeries> {
  const response = await fetchIndicator("ema", {
    symbol,
    timespan: mapTimeframe(timeframe),
    window: params.window,
    limit: 200,
  });

  return {
    type: "ema",
    timeframe,
    params,
    values: toSeriesPoints(response.results ?? [], (item: any) => ({
      timestamp: item.timestamp,
      value: item.value,
    })),
  };
}

export async function fetchRSI(
  symbol: string,
  timeframe: StrategyTimeframe,
  params: IndicatorParams & { window: number }
): Promise<IndicatorSeries> {
  const response = await fetchIndicator("rsi", {
    symbol,
    timespan: mapTimeframe(timeframe),
    window: params.window,
    limit: 200,
  });

  return {
    type: "rsi",
    timeframe,
    params,
    values: toSeriesPoints(response.results ?? [], (item: any) => ({
      timestamp: item.timestamp,
      value: item.value,
    })),
  };
}

export async function fetchMACD(
  symbol: string,
  timeframe: StrategyTimeframe,
  params: IndicatorParams & {
    short_window: number;
    long_window: number;
    signal_window: number;
  }
): Promise<IndicatorSeries> {
  const response = await fetchIndicator("macd", {
    symbol,
    timespan: mapTimeframe(timeframe),
    short_window: params.short_window,
    long_window: params.long_window,
    signal_window: params.signal_window,
    limit: 200,
  });

  return {
    type: "macd",
    timeframe,
    params,
    values: toSeriesPoints(response.results ?? [], (item: any) => ({
      timestamp: item.timestamp,
      value: item.value.macd,
      extra: {
        signal: item.value.signal,
        histogram: item.value.histogram,
      },
    })),
  };
}

export async function fetchIndicatorsForStrategy(
  symbol: string,
  timeframe: StrategyTimeframe,
  indicators: { type: StrategyIndicatorType; params: IndicatorParams }[]
): Promise<IndicatorSeries[]> {
  const results: IndicatorSeries[] = [];
  for (const indicator of indicators) {
    switch (indicator.type) {
      case "sma":
        if (typeof indicator.params.window !== "number") break;
        results.push(
          await fetchSMA(symbol, timeframe, indicator.params as any)
        );
        break;
      case "ema":
        if (typeof indicator.params.window !== "number") break;
        results.push(
          await fetchEMA(symbol, timeframe, indicator.params as any)
        );
        break;
      case "rsi":
        if (typeof indicator.params.window !== "number") break;
        results.push(
          await fetchRSI(symbol, timeframe, indicator.params as any)
        );
        break;
      case "macd":
        if (
          typeof indicator.params.short_window !== "number" ||
          typeof indicator.params.long_window !== "number" ||
          typeof indicator.params.signal_window !== "number"
        )
          break;
        results.push(
          await fetchMACD(symbol, timeframe, indicator.params as any)
        );
        break;
    }
  }
  return results;
}

export interface StrategyIndicatorSnapshot {
  timeframe: StrategyTimeframe;
  candles: Candle[];
  indicators: IndicatorSeries[];
}

export async function buildStrategyIndicatorSnapshot(
  symbol: string,
  timeframe: StrategyTimeframe,
  candles: Candle[],
  indicators: { type: StrategyIndicatorType; params: IndicatorParams }[]
): Promise<StrategyIndicatorSnapshot> {
  const series = await fetchIndicatorsForStrategy(
    symbol,
    timeframe,
    indicators
  );
  return {
    timeframe,
    candles,
    indicators: series,
  };
}

export async function buildStrategySnapshots(
  symbol: string,
  strategy: StrategyConfig,
  candlesByTimeframe: Record<StrategyTimeframe, Candle[]>
): Promise<StrategyIndicatorSnapshot[]> {
  const snapshots: StrategyIndicatorSnapshot[] = [];
  for (const tfConfig of strategy.timeframes) {
    const candles = candlesByTimeframe[tfConfig.timeframe] || [];
    if (candles.length === 0) continue;
    snapshots.push(
      await buildStrategyIndicatorSnapshot(
        symbol,
        tfConfig.timeframe,
        candles,
        tfConfig.indicators
      )
    );
  }
  return snapshots;
}
