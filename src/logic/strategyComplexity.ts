import {
  StrategyComplexity,
  StrategyComplexityConfig,
  TradePlanOverlay,
  StrategyContext,
} from "./types";

// Strategy complexity configurations
export const STRATEGY_COMPLEXITY_CONFIGS: Record<
  StrategyComplexity,
  StrategyComplexityConfig
> = {
  simple: {
    level: "simple",
    description: "Single entry, single exit, single take profit",
    features: {
      multipleEntries: false,
      multipleExits: false,
      multipleTargets: false,
      maxTargets: 1,
    },
  },
  partial: {
    level: "partial",
    description: "Entry + stop loss with 2 take profit targets",
    features: {
      multipleEntries: false,
      multipleExits: false,
      multipleTargets: true,
      maxTargets: 2,
    },
  },
  advanced: {
    level: "advanced",
    description:
      "Multiple entries, stop losses, and up to 3 take profit targets",
    features: {
      multipleEntries: true,
      multipleExits: true, // This represents multiple stop levels
      multipleTargets: true,
      maxTargets: 3,
    },
  },
};

// Generate trade plan based on complexity level
export function generateTradePlanByComplexity(
  basePrice: number,
  side: "long" | "short",
  complexity: StrategyComplexity,
  context: StrategyContext
): TradePlanOverlay {
  const config = STRATEGY_COMPLEXITY_CONFIGS[complexity];
  const isLong = side === "long";

  // Calculate ATR-based levels (simplified)
  const atr = calculateATR(context.recentCloses);
  const riskMultiplier = getRiskMultiplier(context.riskTolerance || "moderate");

  let plan: TradePlanOverlay = {
    side,
    complexity,
  };

  switch (complexity) {
    case "simple":
      plan = generateSimplePlan(basePrice, side, atr, riskMultiplier);
      break;
    case "partial":
      plan = generatePartialPlan(basePrice, side, atr, riskMultiplier);
      break;
    case "advanced":
      plan = generateAdvancedPlan(basePrice, side, atr, riskMultiplier);
      break;
  }

  // Add position sizing
  plan.positionSizing = calculatePositionSizing(plan, complexity);

  return plan;
}

// Simple strategy: 1 entry, 1 exit, 1 take profit
function generateSimplePlan(
  basePrice: number,
  side: "long" | "short",
  atr: number,
  riskMultiplier: number
): TradePlanOverlay {
  const isLong = side === "long";
  const stopDistance = atr * riskMultiplier;
  const targetDistance = stopDistance * 2; // 1:2 RR

  return {
    side,
    complexity: "simple",
    entries: [basePrice],
    exits: [isLong ? basePrice - stopDistance : basePrice + stopDistance],
    tps: [isLong ? basePrice + targetDistance : basePrice - targetDistance],
    riskReward: 2.0,
  };
}

// Partial strategy: 1 entry, 1 stop loss, 2 take profits (no separate exit)
function generatePartialPlan(
  basePrice: number,
  side: "long" | "short",
  atr: number,
  riskMultiplier: number
): TradePlanOverlay {
  const isLong = side === "long";
  const stopDistance = atr * riskMultiplier;
  const target1Distance = stopDistance * 1.5; // 1:1.5 RR
  const target2Distance = stopDistance * 2.5; // 1:2.5 RR

  return {
    side,
    complexity: "partial",
    entries: [basePrice],
    exits: [isLong ? basePrice - stopDistance : basePrice + stopDistance],
    tps: [
      isLong ? basePrice + target1Distance : basePrice - target1Distance,
      isLong ? basePrice + target2Distance : basePrice - target2Distance,
    ],
    riskReward: 2.0,
  };
}

// Advanced strategy: Multiple entries, stop losses, and 3 take profits
function generateAdvancedPlan(
  basePrice: number,
  side: "long" | "short",
  atr: number,
  riskMultiplier: number
): TradePlanOverlay {
  const isLong = side === "long";
  const stopDistance = atr * riskMultiplier;
  const entrySpacing = atr * 0.3;
  const extendedStopDistance = stopDistance * 1.3; // Extended stop is further away

  const target1Distance = stopDistance * 1.5; // 1:1.5 RR
  const target2Distance = stopDistance * 2.5; // 1:2.5 RR
  const target3Distance = stopDistance * 3.5; // 1:3.5 RR

  const mainEntry = basePrice;
  const secondaryEntry = isLong
    ? basePrice + entrySpacing
    : basePrice - entrySpacing;
  const primaryStop = isLong
    ? basePrice - stopDistance
    : basePrice + stopDistance;
  const extendedStop = isLong
    ? basePrice - extendedStopDistance
    : basePrice + extendedStopDistance;

  return {
    side,
    complexity: "advanced",
    entries: [mainEntry, secondaryEntry],
    exits: [primaryStop, extendedStop],
    tps: [
      isLong ? basePrice + target1Distance : basePrice - target1Distance,
      isLong ? basePrice + target2Distance : basePrice - target2Distance,
      isLong ? basePrice + target3Distance : basePrice - target3Distance,
    ],
    riskReward: 2.5,
  };
}

// Calculate position sizing based on complexity
function calculatePositionSizing(
  plan: TradePlanOverlay,
  complexity: StrategyComplexity
) {
  const totalSize = 100; // 100% of intended position

  switch (complexity) {
    case "simple":
      return {
        totalSize,
        entryAllocations: [100],
        exitAllocations: [100],
        targetAllocations: [100],
      };

    case "partial":
      return {
        totalSize,
        entryAllocations: [100],
        exitAllocations: [100],
        targetAllocations: [50, 50], // Split between 2 targets
      };

    case "advanced":
      return {
        totalSize,
        entryAllocations: [70, 30],
        exitAllocations: [70, 30],
        targetAllocations: [40, 35, 25], // Graduated exit
      };

    default:
      return { totalSize };
  }
}

// Helper functions
function calculateATR(closes: number[]): number {
  if (closes.length < 14) return closes[closes.length - 1] * 0.02; // 2% fallback

  let sum = 0;
  for (let i = 1; i < Math.min(14, closes.length); i++) {
    sum += Math.abs(closes[i] - closes[i - 1]);
  }
  return sum / Math.min(13, closes.length - 1);
}

function getRiskMultiplier(
  riskTolerance: "conservative" | "moderate" | "aggressive"
): number {
  switch (riskTolerance) {
    case "conservative":
      return 1.0;
    case "moderate":
      return 1.5;
    case "aggressive":
      return 2.0;
    default:
      return 1.5;
  }
}

// Validation functions
export function getComplexityDescription(
  complexity: StrategyComplexity
): string {
  return STRATEGY_COMPLEXITY_CONFIGS[complexity].description;
}

export function getComplexityFeatures(complexity: StrategyComplexity) {
  return STRATEGY_COMPLEXITY_CONFIGS[complexity].features;
}
