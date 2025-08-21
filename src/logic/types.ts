export type TradeSide = "long" | "short";

export type TradePlanOverlay = {
  side: TradeSide;
  entry?: number;
  lateEntry?: number; // optional secondary/late entry
  exit?: number;
  lateExit?: number; // optional secondary/late exit
  stop?: number;
  targets?: number[];
};

export interface StrategyContext {
  currentPrice: number;
  recentCloses: number[];
  momentumPct?: number;
}
