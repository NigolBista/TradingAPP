import {
  BUILTIN_INDICATORS,
  buildDefaultLines,
} from "../screens/ChartFullScreen/indicators";

export type IndicatorProfile = "day_trade" | "swing_trade";

export type NormalizedIndicatorOptions = {
  calcParams?: number[];
  styles?: {
    lines?: Array<{
      color: string;
      size: number;
      style: string;
    }>;
  };
  [key: string]: any;
};

export type IndicatorStackItem = {
  indicator: string;
  options?: NormalizedIndicatorOptions;
};

// Most-used indicator defaults for profiles
const PROFILE_DEFAULTS: Record<IndicatorProfile, IndicatorStackItem[]> = {
  day_trade: [
    { indicator: "EMA", options: { calcParams: [9, 21, 50] } },
    { indicator: "VWAP", options: {} },
    { indicator: "VOL", options: {} },
    { indicator: "RSI", options: { calcParams: [14] } },
    { indicator: "MACD", options: { calcParams: [12, 26, 9] } },
    { indicator: "BOLL", options: { calcParams: [20, 2] } },
  ],
  swing_trade: [
    { indicator: "EMA", options: { calcParams: [20, 50, 200] } },
    { indicator: "SMA", options: { calcParams: [50, 200] } },
    { indicator: "VOL", options: {} },
    { indicator: "RSI", options: { calcParams: [14] } },
    { indicator: "MACD", options: { calcParams: [12, 26, 9] } },
    { indicator: "BOLL", options: { calcParams: [20, 2] } },
  ],
};

function getIndicatorMeta(name: string) {
  return BUILTIN_INDICATORS.find(
    (i) =>
      i.name.toLowerCase() === name.toLowerCase() ||
      i.title.toLowerCase() === name.toLowerCase()
  );
}

export function normalizeIndicatorOptions(
  indicatorName: string,
  options?: NormalizedIndicatorOptions,
  profile?: IndicatorProfile
): NormalizedIndicatorOptions {
  const meta = getIndicatorMeta(indicatorName);
  const normalized: NormalizedIndicatorOptions = { ...(options || {}) };

  // Ensure calcParams
  if (
    !Array.isArray(normalized.calcParams) ||
    normalized.calcParams.length === 0
  ) {
    // Use profile suggestion if available for this indicator
    const profileDefaults = profile
      ? PROFILE_DEFAULTS[profile].find(
          (p) => p.indicator.toLowerCase() === indicatorName.toLowerCase()
        )
      : undefined;
    const params = profileDefaults?.options?.calcParams ?? meta?.defaultParams;
    if (Array.isArray(params) && params.length > 0) {
      normalized.calcParams = params.slice();
    }
  }

  // Ensure styles.lines length matches calcParams length (or 1)
  const lineCount = Array.isArray(normalized.calcParams)
    ? normalized.calcParams.length
    : 1;
  const baseColor = meta?.defaultColor;
  const defaults = buildDefaultLines(lineCount, baseColor);
  const existing = normalized.styles?.lines;

  let lines: Array<{ color: string; size: number; style: string }>;
  if (!existing || !Array.isArray(existing) || existing.length !== lineCount) {
    // Expand to full length and merge any provided overrides
    lines = defaults.map((d, i) => {
      const override = Array.isArray(existing)
        ? (existing as any)[i]
        : undefined;
      return {
        color: (override && override.color) || d.color,
        size: Number.isFinite(override?.size) ? Number(override.size) : 1,
        style: (override && override.style) || "solid",
      };
    });
  } else {
    // Length matches; still normalize fields and apply defaults
    lines = existing.map((l, i) => ({
      color: (l && (l as any).color) || defaults[i].color,
      size: Number.isFinite((l as any).size) ? Number((l as any).size) : 1,
      style: (l && (l as any).style) || "solid",
    }));
  }

  // Enforce unique colors across lines: if a color repeats, use palette fallback
  const seen = new Set<string>();
  lines = lines.map((l, i) => {
    if (seen.has(l.color)) {
      const replacement = defaults[i]?.color || l.color;
      seen.add(replacement);
      return { ...l, color: replacement };
    }
    seen.add(l.color);
    return l;
  });

  normalized.styles = { ...(normalized.styles || {}), lines };

  return normalized;
}

export function getDefaultIndicatorStack(
  profile: IndicatorProfile
): IndicatorStackItem[] {
  // Return deep copy
  return PROFILE_DEFAULTS[profile].map((i) => ({
    indicator: i.indicator,
    options: i.options ? JSON.parse(JSON.stringify(i.options)) : undefined,
  }));
}
