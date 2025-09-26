export type TradeMode = "day" | "swing";

export type StrategyTimeframe = "5m" | "15m" | "30m" | "1h" | "4h";

export type StrategyIndicatorType = "sma" | "ema" | "rsi" | "macd";

export interface IndicatorParams {
  window?: number;
  short_window?: number;
  long_window?: number;
  signal_window?: number;
}

export interface IndicatorConfigSpec {
  type: StrategyIndicatorType;
  label: string;
  params: IndicatorParams;
}

export interface StrategyTimeframeConfig {
  timeframe: StrategyTimeframe;
  indicators: IndicatorConfigSpec[];
}

export interface StrategyConfig {
  id: string; // unique by group
  name: string;
  description?: string;
  tradeMode: TradeMode;
  timeframes: StrategyTimeframeConfig[];
  createdAt: number;
  updatedAt: number;
}

export interface StrategyLibraryState {
  strategies: StrategyConfig[];
  activeStrategyId?: string;
}

export interface StrategySummary {
  id: string;
  name: string;
  tradeMode: TradeMode;
  timeframes: StrategyTimeframe[];
}

export interface GroupStrategyBundle {
  groupId: string;
  strategy: StrategyConfig;
  watchlist: {
    id: string;
    name: string;
    symbols: string[];
    updatedAt: number;
  };
}
