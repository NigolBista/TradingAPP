import Constants from "expo-constants";
import OpenAI from "openai";

export type UserIntent =
  | {
      type: "chart_analysis";
      symbol: string;
      sequence: Array<{
        kind: string; // timeframe | indicator | screenshot | ...
        args?: any;
        message?: string;
      }>;
      profile?: "day_trade" | "swing_trade";
      needsStrategy?: boolean;
    }
  | {
      type: "strategy_recommendation";
      symbol?: string;
      profile?: "day_trade" | "swing_trade";
      timeframe?: string;
      suggestedStrategy?: string;
    }
  | {
      type: "other";
      action?: string;
    };

export async function inferIntent(
  userInput: string,
  context: any
): Promise<UserIntent> {
  const { openaiApiKey } = (Constants.expoConfig?.extra || {}) as any;
  if (!openaiApiKey) {
    // Simple fallback heuristic
    const lower = userInput.toLowerCase();
    if (lower.includes("analyze") || lower.includes("chart")) {
      return {
        type: "chart_analysis",
        symbol: context?.symbol || "AAPL",
        sequence: [
          {
            kind: "timeframe",
            args: { timeframe: "1m" },
            message: "Checking 1m timeframe",
          },
          {
            kind: "indicator",
            args: { indicator: "EMA" },
            message: "Applying EMAs",
          },
          { kind: "screenshot", message: "Captured view" },
          {
            kind: "timeframe",
            args: { timeframe: "15m" },
            message: "Switching to 15m",
          },
          { kind: "screenshot", message: "Captured view" },
        ],
        profile: "day_trade",
        needsStrategy: true,
      };
    }
    return { type: "other", action: "unknown" };
  }

  const client = new OpenAI({ apiKey: openaiApiKey });
  const system = `You are a planning agent for a chart-control assistant. Convert the user's request into a precise execution plan (JSON only).
Types: chart_analysis | strategy_recommendation | other.

For chart_analysis, build an ordered "sequence" of steps. Each step object MUST include:
- kind: one of [timeframe, indicator, chartType, navigate, toggleOption, screenshot, delay]
- args: object of parameters for that step
- message: short narration for the on-screen overlay

Step formats:
- timeframe: { timeframe: string } // e.g., "1m", "5m", "15m", "1D"
- indicator: { indicator: string, options?: { calcParams?: number[], overlay?: boolean, styles?: { lines?: { color?: string, size?: number, style?: string }[] } } }
- chartType: { chartType: string }
- navigate: { direction: "left" | "right" }
- toggleOption: { option: string, enabled: boolean | string } // showGrid, tooltipRule("always"|"follow_cross"|"none"), removeIndicator("RSI"|"MACD"|...)
- screenshot: {}
- delay: { ms: number }

Guidelines:
- Include a message per step, e.g., "Checking 1m", "Add EMA(9,20,59)", "Switching to 5m", "Show grid".
- Overlay indicators (EMA, MA, BOLL, SAR) belong on the main pane; sub-indicators (RSI, MACD, KDJ, OBV, VOL) go to sub panes. Do not exceed 3 sub-indicators concurrently.
- Use sensible defaults when params are omitted: RSI(14), MACD(12,26,9), BOLL(20,2).
- Keep the plan minimal but complete and ordered.
- Return profile if implied (day_trade | swing_trade).

Presets:
- Day trading default preset: EMA(9,21,50) + RSI(14) + MACD(12,26,9). Only ONE overlay at a time; do NOT add BOLL together with EMA.
- If the user explicitly requests Bollinger for day trading, use BOLL(20,2) + RSI(14) + MACD(12,26,9) instead of the EMA overlay.
- Never include both EMA and BOLL in the same final layout. Choose one based on the request.

Respond with valid JSON only.`;
  const user = `INPUT: ${userInput}\nCTX: ${JSON.stringify(context).slice(
    0,
    2000
  )}`;
  const res = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" } as any,
    max_completion_tokens: 400,
  });
  const text = res.choices?.[0]?.message?.content?.trim();
  try {
    return JSON.parse(text || "{}");
  } catch {
    return { type: "other", action: "parse_failed" };
  }
}
