// Deprecated: replaced by services/marketProviders
export type Provider = "yahoo" | "finnhub" | "polygon" | "alphaVantage";
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export { fetchCandles } from "./marketProviders";
