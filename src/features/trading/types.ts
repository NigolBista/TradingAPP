// Trading feature types
export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  type: 'market' | 'limit' | 'stop';
  price?: number;
  stopPrice?: number;
}

export interface TradingAlert {
  id: string;
  symbol: string;
  condition: string;
  value: number;
  isActive: boolean;
}

export interface ChartTimeframe {
  label: string;
  value: string;
  interval: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export type TradeSide = "long" | "short";

// Strategy complexity levels
export type StrategyComplexity = "simple" | "partial" | "advanced";

export interface StrategyComplexityConfig {
  level: StrategyComplexity;
  description: string;
  features: {
    multipleEntries: boolean;
    multipleExits: boolean;
    multipleTargets: boolean;
    maxTargets: number;
  };
}

// Enhanced trade plan with strategy complexity support
export type TradePlanOverlay = {
  side: TradeSide;
  complexity?: StrategyComplexity;

  // Entry levels
  entry?: number;
  lateEntry?: number; // optional secondary/late entry

  // Exit levels
  exit?: number;
  lateExit?: number; // optional secondary/late exit
  stop?: number;

  // Take profit targets
  targets?: number[];

  // Metadata
  riskReward?: number;
  positionSizing?: {
    totalSize: number;
    entryAllocation?: number; // % for main entry
    lateEntryAllocation?: number; // % for late entry
    targetAllocations?: number[]; // % for each target
  };
};

export interface StrategyContext {
  currentPrice: number;
  recentCloses: number[];
  momentumPct?: number;

  // Strategy preferences
  complexity?: StrategyComplexity;
  riskTolerance?: "conservative" | "moderate" | "aggressive";
  preferredRiskReward?: number;
}