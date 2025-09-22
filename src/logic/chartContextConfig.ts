import {
  BUILTIN_INDICATORS,
  buildDefaultLines,
} from "../screens/ChartFullScreen/indicators";
import { STRATEGY_COMPLEXITY_CONFIGS } from "./strategyComplexity";
import { COLORS } from "../constants/colors";

// Available chart types
export const CHART_TYPES = [
  {
    value: "candle",
    label: "Candlestick",
    description: "Traditional OHLC candlestick chart",
  },
  {
    value: "line",
    label: "Line",
    description: "Simple line chart showing closing prices",
  },
  { value: "area", label: "Area", description: "Filled area chart" },
  { value: "bar", label: "Bar", description: "OHLC bar chart" },
  {
    value: "candle_solid",
    label: "Solid candle",
    description: "Filled body candles",
  },
  {
    value: "candle_stroke",
    label: "Hollow candle",
    description: "Hollow body candles",
  },
  {
    value: "candle_up_stroke",
    label: "Up candle",
    description: "Up candles stroked",
  },
  {
    value: "candle_down_stroke",
    label: "Down candle",
    description: "Down candles stroked",
  },
  { value: "ohlc", label: "OHLC", description: "Open-High-Low-Close bars" },
] as const;

// Available timeframes
export const TIMEFRAMES = [
  { value: "1m", label: "1 Minute", description: "1-minute intervals" },
  { value: "5m", label: "5 Minutes", description: "5-minute intervals" },
  { value: "15m", label: "15 Minutes", description: "15-minute intervals" },
  { value: "30m", label: "30 Minutes", description: "30-minute intervals" },
  { value: "1h", label: "1 Hour", description: "1-hour intervals" },
  { value: "4h", label: "4 Hours", description: "4-hour intervals" },
  { value: "1D", label: "1 Day", description: "Daily intervals" },
  { value: "1W", label: "1 Week", description: "Weekly intervals" },
  { value: "1M", label: "1 Month", description: "Monthly intervals" },
] as const;

// Available line styles
export const LINE_STYLES = [
  { value: "solid", label: "Solid", description: "Continuous line" },
  { value: "dashed", label: "Dashed", description: "Dashed line pattern" },
  { value: "dotted", label: "Dotted", description: "Dotted line pattern" },
] as const;

// Available line thickness options
export const LINE_THICKNESS_OPTIONS = [
  { value: 1, label: "Thin", description: "1px line thickness" },
  { value: 2, label: "Medium", description: "2px line thickness" },
  { value: 3, label: "Thick", description: "3px line thickness" },
  { value: 4, label: "Extra Thick", description: "4px line thickness" },
] as const;

// Tooltip label visibility rules
export const TOOLTIP_RULES = [
  {
    value: "always",
    label: "Always Show",
    description: "Always visible labels",
  },
  {
    value: "follow_cross",
    label: "Follow Crosshair",
    description: "Show labels when crosshair is active",
  },
  { value: "none", label: "Hidden", description: "Hide labels altogether" },
] as const;

// Available color palette from LineStyleModal
export const COLOR_PALETTE = [
  // Row 1: Dark to medium grays and blues
  { value: "#111827", name: "Dark Gray", category: "grays" },
  { value: "#1F2937", name: "Darker Gray", category: "grays" },
  { value: "#374151", name: "Medium Dark Gray", category: "grays" },
  { value: "#4B5563", name: "Medium Gray", category: "grays" },
  { value: "#1E3A8A", name: "Dark Blue", category: "blues" },
  { value: "#3B82F6", name: "Blue", category: "blues" },
  { value: "#2563EB", name: "Medium Blue", category: "blues" },
  { value: "#1D4ED8", name: "Darker Blue", category: "blues" },

  // Row 2: Light blues and purples
  { value: "#60A5FA", name: "Light Blue", category: "blues" },
  { value: "#93C5FD", name: "Lighter Blue", category: "blues" },
  { value: "#A78BFA", name: "Purple", category: "purples" },
  { value: "#8B5CF6", name: "Medium Purple", category: "purples" },
  { value: "#7C3AED", name: "Darker Purple", category: "purples" },
  { value: "#6D28D9", name: "Dark Purple", category: "purples" },
  { value: "#5B21B6", name: "Very Dark Purple", category: "purples" },
  { value: "#4C1D95", name: "Darkest Purple", category: "purples" },

  // Row 3: Pinks, reds, and oranges
  { value: "#F472B6", name: "Pink", category: "pinks" },
  { value: "#EC4899", name: "Medium Pink", category: "pinks" },
  { value: "#F87171", name: "Light Red", category: "reds" },
  { value: "#EF4444", name: "Red", category: "reds" },
  { value: "#DC2626", name: "Dark Red", category: "reds" },
  { value: "#F59E0B", name: "Orange", category: "oranges" },
  { value: "#D97706", name: "Dark Orange", category: "oranges" },
  { value: "#B45309", name: "Darker Orange", category: "oranges" },

  // Row 4: Yellows and greens
  { value: "#FBBF24", name: "Light Orange/Yellow", category: "yellows" },
  { value: "#FDE047", name: "Yellow", category: "yellows" },
  { value: "#FACC15", name: "Bright Yellow", category: "yellows" },
  { value: "#EAB308", name: "Medium Yellow", category: "yellows" },
  { value: "#34D399", name: "Light Green", category: "greens" },
  { value: "#22D3EE", name: "Cyan", category: "cyans" },
  { value: "#10B981", name: "Green", category: "greens" },
  { value: "#059669", name: "Dark Green", category: "greens" },
] as const;

// Available trading strategies
export const TRADING_STRATEGIES = [
  {
    value: "day_trade",
    label: "Day Trading",
    description: "Short-term intraday trading",
  },
  {
    value: "swing_trade",
    label: "Swing Trading",
    description: "Multi-day position trades",
  },
  {
    value: "trend_follow",
    label: "Trend Following",
    description: "Riding established trends",
  },
  {
    value: "mean_reversion",
    label: "Mean Reversion",
    description: "Trading back to average prices",
  },
  {
    value: "breakout",
    label: "Breakout",
    description: "Momentum breakout patterns",
  },
] as const;

// Available strategy complexity levels
export const STRATEGY_COMPLEXITY_LEVELS = Object.entries(
  STRATEGY_COMPLEXITY_CONFIGS
).map(([key, config]) => ({
  value: key,
  label: config.description,
  description: `Complexity level: ${key}`,
  features: config.features,
}));

// Available risk tolerance levels
export const RISK_TOLERANCE_LEVELS = [
  {
    value: "conservative",
    label: "Conservative",
    description: "Lower risk, smaller position sizes",
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Balanced risk approach",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    description: "Higher risk, larger position sizes",
  },
] as const;

// Available context modes
export const CONTEXT_MODES = [
  {
    value: "price_action",
    label: "Price Action",
    description: "Focus on price movements and patterns",
  },
  {
    value: "news_sentiment",
    label: "News & Sentiment",
    description: "Include news and market sentiment analysis",
  },
] as const;

// Available trade paces
export const TRADE_PACES = [
  {
    value: "auto",
    label: "Auto",
    description: "Automatically determine trade pace",
  },
  { value: "day", label: "Day", description: "Day trading pace" },
  { value: "scalp", label: "Scalp", description: "Very short-term scalping" },
  { value: "swing", label: "Swing", description: "Swing trading pace" },
] as const;

// Available chart navigation options
export const NAVIGATION_OPTIONS = [
  {
    value: "left",
    label: "Pan Left",
    description: "Move chart view to the left",
  },
  {
    value: "right",
    label: "Pan Right",
    description: "Move chart view to the right",
  },
] as const;

// Available chart display options
export const CHART_DISPLAY_OPTIONS = [
  {
    value: "showVolume",
    label: "Show Volume",
    description: "Display volume bars",
  },
  {
    value: "showGrid",
    label: "Show Grid",
    description: "Display price and time grid lines",
  },
  {
    value: "showPriceAxisLine",
    label: "Show Price Axis Line",
    description: "Display price axis line",
  },
  {
    value: "showTimeAxisLine",
    label: "Show Time Axis Line",
    description: "Display time axis line",
  },
  {
    value: "showPriceAxisText",
    label: "Show Price Axis Text",
    description: "Display price axis labels",
  },
  {
    value: "showTimeAxisText",
    label: "Show Time Axis Text",
    description: "Display time axis labels",
  },
  {
    value: "showLastPriceLabel",
    label: "Show Last Price Label",
    description: "Display current price label",
  },
  {
    value: "showSessions",
    label: "Show Trading Sessions",
    description: "Display market session indicators",
  },
] as const;

// Generate comprehensive context configuration
export function generateChartContextConfig() {
  return {
    // Chart configuration options
    chartTypes: CHART_TYPES,
    timeframes: TIMEFRAMES,
    lineStyles: LINE_STYLES,
    lineThicknessOptions: LINE_THICKNESS_OPTIONS,
    colorPalette: COLOR_PALETTE,
    chartDisplayOptions: CHART_DISPLAY_OPTIONS,
    navigationOptions: NAVIGATION_OPTIONS,
    tooltipRules: TOOLTIP_RULES,

    // Trading configuration options
    tradingStrategies: TRADING_STRATEGIES,
    strategyComplexityLevels: STRATEGY_COMPLEXITY_LEVELS,
    riskToleranceLevels: RISK_TOLERANCE_LEVELS,
    contextModes: CONTEXT_MODES,
    tradePaces: TRADE_PACES,

    // Technical indicators
    availableIndicators: BUILTIN_INDICATORS.map((indicator) => ({
      name: indicator.name,
      title: indicator.title,
      description: indicator.description,
      defaultParams: indicator.defaultParams,
      compatOverlay: indicator.compatOverlay,
      overlay: indicator.compatOverlay,
      defaultColor: indicator.defaultColor,
    })),

    // App constants
    appConstants: {
      colors: COLORS,
      defaultLineStyles: buildDefaultLines(1),
    },

    // Available tool functions for LLM
    availableTools: [
      {
        name: "set_timeframe",
        description: "Change chart timeframe",
        parameters: {
          type: "object",
          properties: {
            timeframe: {
              type: "string",
              enum: TIMEFRAMES.map((tf) => tf.value),
              description: "The timeframe to set for the chart",
            },
          },
          required: ["timeframe"],
        },
      },
      {
        name: "set_tooltip_rule",
        description:
          "Set tooltip label display rule for main and sub indicators",
        parameters: {
          type: "object",
          properties: {
            rule: {
              type: "string",
              enum: TOOLTIP_RULES.map((r) => r.value),
              description: "Tooltip/label visibility rule",
            },
          },
          required: ["rule"],
        },
      },
      {
        name: "add_indicator",
        description: "Add technical indicator to chart",
        parameters: {
          type: "object",
          properties: {
            indicator: {
              type: "string",
              enum: BUILTIN_INDICATORS.map((ind) => ind.name),
              description: "The indicator to add",
            },
            options: {
              type: "object",
              description: "Indicator configuration options",
              properties: {
                styles: {
                  type: "object",
                  properties: {
                    lines: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          color: {
                            type: "string",
                            enum: COLOR_PALETTE.map((c) => c.value),
                            description: "Line color from available palette",
                          },
                          size: {
                            type: "number",
                            enum: LINE_THICKNESS_OPTIONS.map((t) => t.value),
                            description: "Line thickness",
                          },
                          style: {
                            type: "string",
                            enum: LINE_STYLES.map((s) => s.value),
                            description: "Line style",
                          },
                        },
                      },
                    },
                  },
                },
                calcParams: {
                  type: "array",
                  items: { type: "number" },
                  description: "Indicator calculation parameters",
                },
              },
            },
          },
          required: ["indicator"],
        },
      },
      {
        name: "remove_indicator",
        description: "Remove a technical indicator from the chart",
        parameters: {
          type: "object",
          properties: {
            indicator: {
              type: "string",
              enum: BUILTIN_INDICATORS.map((ind) => ind.name),
              description: "The indicator to remove",
            },
          },
          required: ["indicator"],
        },
      },
      {
        name: "navigate",
        description: "Pan chart view",
        parameters: {
          type: "object",
          properties: {
            direction: {
              type: "string",
              enum: NAVIGATION_OPTIONS.map((n) => n.value),
              description: "Direction to pan the chart",
            },
          },
          required: ["direction"],
        },
      },
      {
        name: "check_news",
        description: "Check latest news for the symbol",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "set_chart_type",
        description: "Change chart display type",
        parameters: {
          type: "object",
          properties: {
            chartType: {
              type: "string",
              enum: CHART_TYPES.map((ct) => ct.value),
              description: "The chart type to display",
            },
          },
          required: ["chartType"],
        },
      },
      {
        name: "toggle_display_option",
        description: "Toggle chart display options",
        parameters: {
          type: "object",
          properties: {
            option: {
              type: "string",
              enum: CHART_DISPLAY_OPTIONS.map((opt) => opt.value),
              description: "The display option to toggle",
            },
            enabled: {
              type: "boolean",
              description: "Whether to enable or disable the option",
            },
          },
          required: ["option", "enabled"],
        },
      },
      {
        name: "run_analysis",
        description: "Run AI analysis on the current chart state",
        parameters: {
          type: "object",
          properties: {
            strategy: {
              type: "string",
              enum: TRADING_STRATEGIES.map((ts) => ts.value),
              description: "The trading strategy to use for analysis",
            },
          },
          required: [],
        },
      },
    ],
  };
}

// Helper function to get color by name or category
export function getColorByName(name: string): string | undefined {
  return COLOR_PALETTE.find(
    (color) =>
      color.name.toLowerCase().includes(name.toLowerCase()) ||
      color.category.toLowerCase().includes(name.toLowerCase())
  )?.value;
}

// Helper function to get indicator by name
export function getIndicatorByName(name: string) {
  return BUILTIN_INDICATORS.find(
    (indicator) =>
      indicator.name.toLowerCase() === name.toLowerCase() ||
      indicator.title.toLowerCase().includes(name.toLowerCase())
  );
}

// Helper function to validate color
export function isValidColor(color: string): boolean {
  return COLOR_PALETTE.some((c) => c.value === color);
}

// Helper function to validate timeframe
export function isValidTimeframe(timeframe: string): boolean {
  return TIMEFRAMES.some((tf) => tf.value === timeframe);
}

// Helper function to validate chart type
export function isValidChartType(chartType: string): boolean {
  return CHART_TYPES.some((ct) => ct.value === chartType);
}
