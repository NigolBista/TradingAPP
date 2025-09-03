import type { IndicatorConfig } from "../../components/charts/SimpleKLineChart";

export type IndicatorLineStyle = {
  color: string;
  size: number;
  style: string;
};

export const BUILTIN_INDICATORS: Array<{
  name: string;
  title: string;
  description: string;
  defaultParams?: number[];
  compatOverlay?: boolean;
  defaultColor?: string;
}> = [
  {
    name: "MA",
    title: "Moving Average",
    description:
      "Average of closing prices over selected periods; smooths price noise.",
    defaultParams: [5, 10, 30, 60],
    compatOverlay: true,
    defaultColor: "#3B82F6",
  },
  {
    name: "EMA",
    title: "Exponential Moving Average",
    description:
      "Moving average with more weight on recent prices; responds faster to changes.",
    defaultParams: [6, 12, 20],
    compatOverlay: true,
    defaultColor: "#22D3EE",
  },
  {
    name: "SMA",
    title: "Smoothed Moving Average",
    description:
      "Wilder-style smoothed average; slower than EMA/SMA to reduce whipsaw.",
    defaultParams: [12, 2],
    compatOverlay: true,
    defaultColor: "#EAB308",
  },
  {
    name: "BBI",
    title: "Bull and Bear Index",
    description:
      "Composite of multiple moving averages; gauges overall bull/bear trend.",
    defaultParams: [3, 6, 12, 24],
    compatOverlay: true,
    defaultColor: "#A78BFA",
  },
  {
    name: "BOLL",
    title: "Bollinger Bands",
    description:
      "Bands at standard deviations around a moving average; shows volatility and extremes.",
    defaultParams: [20, 2],
    compatOverlay: true,
    defaultColor: "#F59E0B",
  },
  {
    name: "VOL",
    title: "Volume",
    description:
      "Volume histogram; optional averages highlight rising/falling participation.",
    defaultParams: [5, 10, 20],
    compatOverlay: false,
    defaultColor: "#6EE7B7",
  },
  {
    name: "MACD",
    title: "MACD",
    description:
      "Trend and momentum via fast/slow EMAs and signal line; common crossovers.",
    defaultParams: [12, 26, 9],
    compatOverlay: false,
    defaultColor: "#60A5FA",
  },
  {
    name: "KDJ",
    title: "Stochastic (KDJ)",
    description:
      "Stochastic oscillator variant with K, D, and J lines to show momentum/overbought.",
    defaultParams: [9, 3, 3],
    compatOverlay: false,
    defaultColor: "#34D399",
  },
  {
    name: "RSI",
    title: "Relative Strength Index",
    description:
      "Momentum oscillator measuring speed of gains vs losses; overbought/oversold levels.",
    defaultParams: [6, 12, 24],
    compatOverlay: false,
    defaultColor: "#F472B6",
  },
  {
    name: "SAR",
    title: "Parabolic SAR",
    description:
      "Stops and reversal dots that trail price to highlight trend direction and exits.",
    defaultParams: [2, 2, 20],
    compatOverlay: true,
    defaultColor: "#FB7185",
  },
  {
    name: "OBV",
    title: "On-Balance Volume",
    description:
      "Cumulative volume flow; rising OBV suggests accumulation, falling implies distribution.",
    defaultParams: [30],
    compatOverlay: false,
    defaultColor: "#93C5FD",
  },
  {
    name: "DMA",
    title: "Difference of Moving Averages",
    description:
      "Difference between short and long MAs with a smoothed signal; trend confirmation.",
    defaultParams: [10, 50, 10],
    compatOverlay: false,
    defaultColor: "#67E8F9",
  },
  {
    name: "TRIX",
    title: "TRIX",
    description:
      "Rate-of-change of a triple-smoothed EMA; filters noise to show trend turns.",
    defaultParams: [12, 20],
    compatOverlay: false,
    defaultColor: "#FDE047",
  },
  {
    name: "BRAR",
    title: "BRAR (BR and AR Index)",
    description:
      "Measures buying (BR) and market popularity (AR); detects sentiment extremes.",
    defaultParams: [26],
    compatOverlay: false,
    defaultColor: "#FCA5A5",
  },
  {
    name: "VR",
    title: "Volume Ratio",
    description:
      "Compares up-volume to down-volume to assess participation behind price moves.",
    defaultParams: [24, 30],
    compatOverlay: false,
    defaultColor: "#A7F3D0",
  },
  {
    name: "WR",
    title: "Williams %R",
    description:
      "Momentum oscillator showing overbought/oversold relative to recent highs/lows.",
    defaultParams: [6, 10, 14],
    compatOverlay: false,
    defaultColor: "#F9A8D4",
  },
  {
    name: "MTM",
    title: "Momentum (MTM)",
    description:
      "Measures price change over a lookback to capture acceleration and reversals.",
    defaultParams: [6, 10],
    compatOverlay: false,
    defaultColor: "#C4B5FD",
  },
  {
    name: "EMV",
    title: "Ease of Movement",
    description:
      "Relates price movement to volume; highlights efficient advances or declines.",
    defaultParams: [14, 9],
    compatOverlay: false,
    defaultColor: "#FDBA74",
  },
  {
    name: "DMI",
    title: "Directional Movement Index",
    description: "+DI, -DI and ADX to gauge trend strength and direction.",
    defaultParams: [14, 6],
    compatOverlay: false,
    defaultColor: "#86EFAC",
  },
  {
    name: "CR",
    title: "CR (Energy) Index",
    description:
      "Momentum of typical price over a reference; tracks internal market strength.",
    defaultParams: [26, 10, 20, 40, 60],
    compatOverlay: false,
    defaultColor: "#FDA4AF",
  },
  {
    name: "PSY",
    title: "Psychological Line",
    description:
      "Percentage of rising days over a period; sentiment-based overbought/oversold.",
    defaultParams: [12, 6],
    compatOverlay: false,
    defaultColor: "#FDE68A",
  },
  {
    name: "AO",
    title: "Awesome Oscillator",
    description:
      "Difference of two SMAs on median price; identifies momentum and saucer setups.",
    defaultParams: [5, 34],
    compatOverlay: false,
    defaultColor: "#A5B4FC",
  },
  {
    name: "ROC",
    title: "Rate of Change",
    description:
      "Percentage change from a prior price; high values indicate strong momentum.",
    defaultParams: [12, 6],
    compatOverlay: false,
    defaultColor: "#FCA5A5",
  },
  {
    name: "PVT",
    title: "Price Volume Trend",
    description:
      "Cumulative volume adjusted by price change; blends OBV with price sensitivity.",
    compatOverlay: false,
    defaultColor: "#93C5FD",
  },
  {
    name: "VWAP",
    title: "Volume Weighted Average Price",
    description:
      "Volume weighted average price line; shows the average price weighted by volume.",
    compatOverlay: false,
    defaultColor: "#FDE68A",
  },
  {
    name: "BIAS",
    title: "Bias Ratio",
    description:
      "Measures the deviation of current price from its moving average; positive values indicate bullish bias.",
    defaultParams: [6, 12, 24],
    compatOverlay: false,
    defaultColor: "#10B981",
  },
  {
    name: "CCI",
    title: "Commodity Channel Index",
    description:
      "Identifies cyclical trends and overbought/oversold conditions; values above 100 suggest overbought, below -100 oversold.",
    defaultParams: [14],
    compatOverlay: false,
    defaultColor: "#8B5CF6",
  },
];

export function buildDefaultLines(
  count: number,
  baseColor?: string
): IndicatorLineStyle[] {
  const palette = [
    "#10B981",
    "#3B82F6",
    "#F59E0B",
    "#EF4444",
    "#A78BFA",
    "#22D3EE",
    "#F472B6",
    "#FDE047",
  ];
  const out: IndicatorLineStyle[] = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    out.push({
      color: i === 0 && baseColor ? baseColor : palette[i % palette.length],
      size: 1,
      style: "solid",
    });
  }
  return out;
}

export function getDefaultIndicator(name: string): IndicatorConfig {
  const meta = BUILTIN_INDICATORS.find((i) => i.name === name);
  const params = meta?.defaultParams;
  const lines = Array.isArray(params)
    ? buildDefaultLines(params.length, meta?.defaultColor)
    : buildDefaultLines(1, meta?.defaultColor);
  return {
    id: `${name}-${Date.now()}`,
    name,
    overlay: !!meta?.compatOverlay,
    calcParams: params,
    styles: { lines },
  } as IndicatorConfig;
}

export function isSelectedIndicator(
  indicators: IndicatorConfig[],
  name: string
): boolean {
  return indicators.some((i) => i.name === name);
}

export function toggleIndicatorInList(
  list: IndicatorConfig[],
  name: string
): IndicatorConfig[] {
  const exists = list.find((i) => i.name === name);
  if (exists) return list.filter((i) => i.name !== name);
  return list.concat(getDefaultIndicator(name));
}

export function updateIndicatorInList(
  list: IndicatorConfig[],
  name: string,
  updates: Partial<IndicatorConfig>
): IndicatorConfig[] {
  return list.map((i) => (i.name === name ? { ...i, ...updates } : i));
}

export function updateIndicatorLineInList(
  list: IndicatorConfig[],
  name: string,
  lineIndex: number,
  updates: Partial<IndicatorLineStyle>
): IndicatorConfig[] {
  return list.map((ind) => {
    if (ind.name !== name) return ind;
    const count = Array.isArray(ind.calcParams) ? ind.calcParams.length : 1;
    const lines = Array.isArray((ind.styles as any)?.lines)
      ? ((ind.styles as any).lines as IndicatorLineStyle[]).slice()
      : buildDefaultLines(count);
    const idx = Math.max(0, Math.min(lineIndex, count - 1));
    const current = lines[idx] || { color: "#00D4AA", size: 1, style: "solid" };
    lines[idx] = { ...current, ...updates } as IndicatorLineStyle;
    return {
      ...ind,
      styles: { ...(ind.styles as any), lines },
    } as IndicatorConfig;
  });
}

export function addIndicatorParamInList(
  list: IndicatorConfig[],
  name: string,
  value: number
): { list: IndicatorConfig[]; newIndex: number } {
  let newIndex = 0;
  const updated = list.map((ind) => {
    if (ind.name !== name) return ind;
    const params = Array.isArray(ind.calcParams)
      ? (ind.calcParams as number[]).slice()
      : [];
    if (params.includes(value)) return ind;
    params.push(Math.floor(value));
    params.sort((a, b) => a - b);
    newIndex = Math.max(0, params.indexOf(Math.floor(value)));
    const count = params.length;
    const lines = Array.isArray((ind.styles as any)?.lines)
      ? ((ind.styles as any).lines as IndicatorLineStyle[]).slice()
      : buildDefaultLines(count);
    while (lines.length < count) {
      lines.push({ color: "#00D4AA", size: 1, style: "solid" });
    }
    return {
      ...ind,
      calcParams: params,
      styles: { ...(ind.styles as any), lines },
    } as IndicatorConfig;
  });
  return { list: updated, newIndex };
}

export function removeIndicatorParamInList(
  list: IndicatorConfig[],
  name: string,
  value: number
): IndicatorConfig[] {
  return list.map((ind) => {
    if (ind.name !== name) return ind;
    const params = Array.isArray(ind.calcParams)
      ? (ind.calcParams as number[]).slice()
      : [];
    const idx = params.indexOf(value as any);
    if (idx === -1) return ind;
    params.splice(idx, 1);
    const lines = Array.isArray((ind.styles as any)?.lines)
      ? ((ind.styles as any).lines as IndicatorLineStyle[]).slice()
      : [];
    if (idx >= 0 && idx < lines.length) lines.splice(idx, 1);
    return {
      ...ind,
      calcParams: params,
      styles: { ...(ind.styles as any), lines },
    } as IndicatorConfig;
  });
}
