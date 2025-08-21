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
      const systemContent = p.system;
      const userContent = buildUserContent(p, input);

      // Console log the entire prompt being sent
      console.log("🤖 AI STRATEGY ANALYSIS PROMPT");
      console.log("=====================================");
      console.log("📊 Symbol:", input.symbol);
      console.log("🎯 Mode:", input.mode || "auto");
      console.log("🔧 Strategy:", p.key || "unknown");
      console.log("=====================================");
      console.log("💬 SYSTEM PROMPT:");
      console.log(systemContent);
      console.log("=====================================");
      console.log("👤 USER PROMPT:");
      console.log(userContent);
      console.log("=====================================");
      console.log("⚙️  MODEL CONFIG:");
      console.log("Model:", model);
      console.log("Temperature:", 0.2);
      console.log("Max Tokens:", 750);
      console.log("Response Format: JSON");
      console.log("=====================================");

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 750,
        response_format: { type: "json_object" } as any,
      });
      const text = response.choices?.[0]?.message?.content?.trim();

      // Log the response
      console.log("🤖 AI RESPONSE:");
      console.log("Raw Response:", text);
      console.log("=====================================");

      if (!text) continue;
      let parsed: AIStrategyOutput | null = null;
      try {
        parsed = JSON.parse(text);
        console.log("✅ PARSED RESPONSE:");
        console.log(JSON.stringify(parsed, null, 2));
        console.log("=====================================");
      } catch (parseError) {
        console.log("❌ JSON PARSE ERROR:", parseError);
        // try to extract JSON object heuristically
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            parsed = JSON.parse(m[0]);
            console.log("✅ HEURISTIC PARSE SUCCESS:");
            console.log(JSON.stringify(parsed, null, 2));
          } catch (heuristicError) {
            console.log("❌ HEURISTIC PARSE FAILED:", heuristicError);
          }
        }
      }
      if (!parsed) {
        console.log("❌ NO VALID PARSED RESULT - CONTINUING TO NEXT STRATEGY");
        continue;
      }
      if (
        !Number.isFinite(parsed.entry) ||
        !Number.isFinite(parsed.exit) ||
        !Number.isFinite(parsed.stop)
      ) {
        console.log("❌ INVALID NUMERIC VALUES - CONTINUING TO NEXT STRATEGY");
        console.log(
          "Entry:",
          parsed.entry,
          "Exit:",
          parsed.exit,
          "Stop:",
          parsed.stop
        );
        continue;
      }
      console.log("🎉 FINAL SUCCESSFUL RESULT:");
      console.log(JSON.stringify(parsed, null, 2));
      console.log("=====================================");
      return parsed;
    } catch (err) {
      console.log("❌ AI STRATEGY CALL FAILED for", p.key || "unknown");
      console.error("Error details:", err);
    }
  }
  console.log("❌ ALL STRATEGIES FAILED - RETURNING NULL");
  console.log("=====================================");
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
