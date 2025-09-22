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
  const system = `You extract INTENT as compact JSON. Types: chart_analysis | strategy_recommendation | other.
For chart_analysis, include sequence steps with kind (timeframe|indicator|screenshot|navigate|toggleOption) and args.
Prefer minimal steps and default indicator params unless crucial. Include optional profile: day_trade or swing_trade.`;
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
