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

  // Unified level arrays
  entries?: number[]; // ordered entries
  exits?: number[]; // ordered exits / stops
  tps?: number[]; // ordered take-profit targets

  // Metadata
  riskReward?: number;
  positionSizing?: {
    totalSize: number;
    entryAllocations?: number[]; // % for each entry
    exitAllocations?: number[]; // % for each exit
    targetAllocations?: number[]; // % for each TP
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
