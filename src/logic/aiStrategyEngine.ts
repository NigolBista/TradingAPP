import Constants from "expo-constants";
import OpenAI from "openai";
import { TradePlanOverlay, TradeSide } from "./types";
import {
  STRATEGY_PROMPTS,
  StrategyKey,
  StrategyPrompt,
  getAllStrategyKeys,
} from "./strategies";

export type AIStrategyInput = {
  symbol: string;
  mode?: "auto" | StrategyKey;
  candleData: {
    // full API payload per timeframe
    [timeframe: string]: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number;
    }>;
  };
  indicators?: Record<string, any>;
  context?: Record<string, any>; // news, sentiment, events, decalpX, etc
};

export type AIStrategyOutput = {
  strategyChosen: StrategyKey | string;
  side: TradeSide;
  entry: number;
  lateEntry?: number;
  exit: number;
  lateExit?: number;
  stop: number;
  targets?: number[];
  confidence: number;
  riskReward?: number;
  why: string[];
  tradePlanNotes?: string[];
};

function buildUserContent(
  prompt: StrategyPrompt,
  input: AIStrategyInput
): string {
  const allowedKeys = getAllStrategyKeys().join(" | ");
  const payload = {
    symbol: input.symbol,
    candleData: input.candleData,
    indicators: input.indicators || {},
    context: input.context || {},
    strategyMode: input.mode || "auto",
    allowedStrategies: allowedKeys,
  };
  return `STRATEGY CONTEXT\n${JSON.stringify(payload).substring(
    0,
    180000
  )}\n\nTASK\n${prompt.userTemplate}`;
}

export async function runAIStrategy(
  input: AIStrategyInput
): Promise<AIStrategyOutput | null> {
  const { openaiApiKey } = (Constants.expoConfig?.extra || {}) as any;
  if (!openaiApiKey) {
    console.warn("OpenAI API key not configured. Skipping AI strategy.");
    return null;
  }

  const model = "gpt-4o-mini";
  const client = new OpenAI({ apiKey: openaiApiKey });

  let chosenKey: StrategyKey = "day_trade";
  if (input.mode && input.mode !== "auto") {
    chosenKey = input.mode as StrategyKey;
  }

  const allKeys = getAllStrategyKeys();
  const basePrompt =
    STRATEGY_PROMPTS[chosenKey] || STRATEGY_PROMPTS["day_trade"];
  const promptsToTry: StrategyPrompt[] =
    input.mode === "auto"
      ? allKeys.map((k) => STRATEGY_PROMPTS[k])
      : [basePrompt];

  for (const p of promptsToTry) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: p.system },
          { role: "user", content: buildUserContent(p, input) },
        ],
        temperature: 0.2,
        max_tokens: 750,
        response_format: { type: "json_object" } as any,
      });
      const text = response.choices?.[0]?.message?.content?.trim();
      if (!text) continue;
      let parsed: AIStrategyOutput | null = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // try to extract JSON object heuristically
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            parsed = JSON.parse(m[0]);
          } catch {}
        }
      }
      if (!parsed) continue;
      if (
        !Number.isFinite(parsed.entry) ||
        !Number.isFinite(parsed.exit) ||
        !Number.isFinite(parsed.stop)
      ) {
        continue;
      }
      return parsed;
    } catch (err) {
      console.warn("AI strategy call failed for", p.key, err);
    }
  }
  return null;
}

export function aiOutputToTradePlan(
  output: AIStrategyOutput
): TradePlanOverlay {
  return {
    side: output.side,
    entry: output.entry,
    lateEntry: output.lateEntry,
    exit: output.exit,
    lateExit: output.lateExit,
    stop: output.stop,
    targets: output.targets,
  };
}
