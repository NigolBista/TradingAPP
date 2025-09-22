import { IndicatorProfile, normalizeIndicatorOptions, IndicatorStackItem } from "./indicatorDefaults";

export type Pane = "main" | "sub";

export type LayoutIndicator = {
  pane: Pane;
  indicator: string;
  options?: any;
};

export type LayoutPreset = {
  id: string;
  profile: IndicatorProfile;
  name: string;
  description: string;
  preferredTimeframes: string[]; // ordered preference
  indicators: [LayoutIndicator, LayoutIndicator, LayoutIndicator]; // 1 main, 2 sub
  strengths: string[];
  weaknesses: string[];
  scenarios: string[];
};

const DAY: LayoutPreset[] = [
  {
    id: "day_ema_rsi_macd",
    profile: "day_trade",
    name: "EMA(9,21,50) + RSI(14) + MACD",
    description: "Momentum trend on price with RSI and MACD for momentum/turn confirmation.",
    preferredTimeframes: ["1m", "5m"],
    indicators: [
      { pane: "main", indicator: "EMA", options: { calcParams: [9, 21, 50] } },
      { pane: "sub", indicator: "RSI", options: { calcParams: [14] } },
      { pane: "sub", indicator: "MACD", options: { calcParams: [12, 26, 9] } },
    ],
    strengths: ["Fast response to intraday momentum", "Clear pullback alignment"],
    weaknesses: ["Chop in range-bound markets", "Late on news whipsaws"],
    scenarios: ["Trend day", "Opening drive pullback", "VWAP reclaim with momentum"],
  },
  {
    id: "day_boll_rsi_macd",
    profile: "day_trade",
    name: "BOLL(20,2) + RSI(14) + MACD",
    description: "Volatility bands for squeeze/breakouts with RSI/MACD confirmation.",
    preferredTimeframes: ["1m", "5m"],
    indicators: [
      { pane: "main", indicator: "BOLL", options: { calcParams: [20, 2] } },
      { pane: "sub", indicator: "RSI", options: { calcParams: [14] } },
      { pane: "sub", indicator: "MACD", options: { calcParams: [12, 26, 9] } },
    ],
    strengths: ["Identifies squeezes and expansions", "Good for breakout timing"],
    weaknesses: ["False breaks in illiquid names", "Band riding confuses exits"],
    scenarios: ["Squeeze breakout", "Post-news volatility expansion"],
  },
  {
    id: "day_ema_kdj_vol",
    profile: "day_trade",
    name: "EMA(9,21,50) + KDJ(9,3,3) + VOL(5,10,20)",
    description: "Trend with stochastic turns and volume confirmation.",
    preferredTimeframes: ["1m", "5m"],
    indicators: [
      { pane: "main", indicator: "EMA", options: { calcParams: [9, 21, 50] } },
      { pane: "sub", indicator: "KDJ", options: { calcParams: [9, 3, 3] } },
      { pane: "sub", indicator: "VOL", options: { calcParams: [5, 10, 20] } },
    ],
    strengths: ["Good for timing pullback resumes", "Volume trend context"],
    weaknesses: ["Oscillator churn during strong trends", "Volume lags intra-bar"],
    scenarios: ["Pullback entries on trend days", "Range-to-trend transitions"],
  },
];

const SWING: LayoutPreset[] = [
  {
    id: "swing_ema_rsi_macd",
    profile: "swing_trade",
    name: "EMA(20,50,200) + RSI(14) + MACD",
    description: "Multi-horizon trend structure with momentum confirmation.",
    preferredTimeframes: ["1D", "4h"],
    indicators: [
      { pane: "main", indicator: "EMA", options: { calcParams: [20, 50, 200] } },
      { pane: "sub", indicator: "RSI", options: { calcParams: [14] } },
      { pane: "sub", indicator: "MACD", options: { calcParams: [12, 26, 9] } },
    ],
    strengths: ["Follows swing trends", "Clear multi-EMA structure"],
    weaknesses: ["Sideways chop", "EMA whips in late stage"],
    scenarios: ["Breakout pullbacks", "Trend continuation on higher TF"],
  },
  {
    id: "swing_boll_rsi_obv",
    profile: "swing_trade",
    name: "BOLL(20,2) + RSI(14) + OBV(30)",
    description: "Volatility and mean reversion with accumulation insight via OBV.",
    preferredTimeframes: ["1D", "4h"],
    indicators: [
      { pane: "main", indicator: "BOLL", options: { calcParams: [20, 2] } },
      { pane: "sub", indicator: "RSI", options: { calcParams: [14] } },
      { pane: "sub", indicator: "OBV", options: { calcParams: [30] } },
    ],
    strengths: ["Mean reversion bands for entries", "Accumulation/Distribution visibility"],
    weaknesses: ["Trending names ride bands", "OBV noisy around events"],
    scenarios: ["Pullback to mid-band", "Failed breakdown reversals"],
  },
  {
    id: "swing_sma_rsi_macd",
    profile: "swing_trade",
    name: "SMA(50,200) + RSI(14) + MACD",
    description: "Classic SMA structure with momentum confirmation.",
    preferredTimeframes: ["1D", "1W"],
    indicators: [
      { pane: "main", indicator: "SMA", options: { calcParams: [50, 200] } },
      { pane: "sub", indicator: "RSI", options: { calcParams: [14] } },
      { pane: "sub", indicator: "MACD", options: { calcParams: [12, 26, 9] } },
    ],
    strengths: ["Widely followed MAs", "Crossovers for trend shifts"],
    weaknesses: ["Lag during rapid changes", "Whipsaws near 200"],
    scenarios: ["Golden/death cross context", "Higher timeframe pullbacks"],
  },
];

export function getLayoutPresets(profile?: IndicatorProfile): LayoutPreset[] {
  const all = [...DAY, ...SWING];
  if (!profile) return all;
  return all.filter((p) => p.profile === profile);
}

export function getLayoutPresetById(id: string): LayoutPreset | undefined {
  return [...DAY, ...SWING].find((p) => p.id === id);
}

export function buildLayoutIndicatorStack(
  preset: LayoutPreset,
  profile?: IndicatorProfile
): IndicatorStackItem[] {
  return preset.indicators.map((li) => ({
    indicator: li.indicator,
    options: normalizeIndicatorOptions(li.indicator, li.options, profile || preset.profile),
  }));
}


