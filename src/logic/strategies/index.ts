export type StrategyKey =
  | "day_trade"
  | "swing_trade"
  | "trend_follow"
  | "mean_reversion"
  | "breakout";

export interface StrategyPrompt {
  key: StrategyKey;
  title: string;
  description: string;
  system: string;
  userTemplate: string;
}

const outputFormat = `
You must reply with ONLY valid JSON that strictly matches this TypeScript interface (no markdown, no commentary):
{
  "strategyChosen": string,              // one of: day_trade | swing_trade | trend_follow | mean_reversion | breakout
  "side": "long" | "short",
  "entry": number,
  "lateEntry"?: number,
  "exit": number,
  "lateExit"?: number,
  "stop": number,
  "targets"?: number[],                  // up to 3 profit targets
  "confidence": number,                  // 0-100
  "riskReward"?: number,                 // e.g. 1.5 = 1:1.5 RR
  "why": string[],                       // concise bullet reasons used
  "tradePlanNotes"?: string[]            // constraints, caveats
}`;

export const DAY_TRADE_PROMPT: StrategyPrompt = {
  key: "day_trade",
  title: "Day Trading (tight risk, fast targets)",
  description:
    "Focus on short-term intraday momentum, VWAP/MA confluence, and ATR-based stops. Prefer quick rotations with tight risk.",
  system:
    "You are an experienced intraday trader. Be decisive and risk-aware. Avoid overfitting.",
  userTemplate: `Using the provided multi-timeframe candles and indicators, produce a tight intraday plan with ATR-based levels and clear risk. ${outputFormat}`,
};

export const SWING_TRADE_PROMPT: StrategyPrompt = {
  key: "swing_trade",
  title: "Swing Trading (multi-day to weeks)",
  description:
    "Ride multi-day trends. Use MA structure, momentum breadth, and higher timeframe levels. Allow wider stops/targets.",
  system:
    "You are a disciplined swing trader. Emphasize trend, pullbacks, and risk to multi-day structure.",
  userTemplate: `Build a swing plan using higher timeframe structure and momentum. ${outputFormat}`,
};

export const TREND_FOLLOW_PROMPT: StrategyPrompt = {
  key: "trend_follow",
  title: "Trend Following",
  description:
    "Trade in the direction of the prevailing trend. Favor pullback entries and structure-based stops.",
  system:
    "You are a trend-following specialist. Avoid counter-trend trades unless structure breaks.",
  userTemplate: `Choose a plan that follows the dominant trend with pullback entries. ${outputFormat}`,
};

export const MEAN_REVERSION_PROMPT: StrategyPrompt = {
  key: "mean_reversion",
  title: "Mean Reversion",
  description:
    "Fade extremes back to a mean (e.g., SMA20/VWAP). Use volatility-aware stops and conservative targets.",
  system:
    "You are a mean reversion trader. Only act on statistically significant extremes.",
  userTemplate: `If extremes are present, craft a reversion plan back to a fair value. ${outputFormat}`,
};

export const BREAKOUT_PROMPT: StrategyPrompt = {
  key: "breakout",
  title: "Breakout/Breakdown",
  description:
    "Trade confirmed breakouts from consolidation or key levels. Define invalidation tightly below/above structure.",
  system:
    "You are a breakout trader. Demand confirmation and manage false breaks.",
  userTemplate: `If price is coiling or near key levels, plan a breakout/breakdown trade with confirmation. ${outputFormat}`,
};

export const STRATEGY_PROMPTS: Record<StrategyKey, StrategyPrompt> = {
  day_trade: DAY_TRADE_PROMPT,
  swing_trade: SWING_TRADE_PROMPT,
  trend_follow: TREND_FOLLOW_PROMPT,
  mean_reversion: MEAN_REVERSION_PROMPT,
  breakout: BREAKOUT_PROMPT,
};

export function getAllStrategyKeys(): StrategyKey[] {
  return Object.keys(STRATEGY_PROMPTS) as StrategyKey[];
}
