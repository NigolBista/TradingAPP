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
  context?: Record<string, any> & {
    // Strategy complexity preferences
    complexity?: "simple" | "partial" | "advanced";
    riskTolerance?: "conservative" | "moderate" | "aggressive";
    preferredRiskReward?: number;
    autoApplyComplexity?: boolean;
  }; // news, sentiment, events, decalpX, etc
};

export type AIStrategyOutput = {
  strategyChosen: StrategyKey | string;
  side: TradeSide;
  entries?: number[];
  exits?: number[];
  tps?: number[];
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
  const complexity = input.context?.complexity || "advanced";
  const complexityInstruction = getComplexityInstruction(complexity);

  const payload = {
    symbol: input.symbol,
    candleData: input.candleData,
    indicators: input.indicators || {},
    context: input.context || {},
    strategyMode: input.mode || "auto",
    allowedStrategies: allowedKeys,
    strategyComplexity: complexity,
  };

  return `STRATEGY CONTEXT\n${JSON.stringify(payload).substring(
    0,
    180000
  )}\n\n${complexityInstruction}\n\nTASK\n${prompt.userTemplate}`;
}

function getComplexityInstruction(
  complexity: "simple" | "partial" | "advanced"
): string {
  switch (complexity) {
    case "simple":
      return "USER PREFERENCE: SIMPLE strategy - Provide only 1 entry, 1 stop loss, and 1 take profit target. Do NOT include lateEntry, exit, or lateExit fields.";
    case "partial":
      return "USER PREFERENCE: PARTIAL strategy - Provide 1 entry, 1 stop loss, and up to 2 take profit targets. Do NOT include lateEntry, exit, or lateExit fields. Use targets for partial profit taking.";
    case "advanced":
      return "USER PREFERENCE: ADVANCED strategy - Provide full strategy with entry, lateEntry (breakout/breakdown level), stop loss, lateExit (extended stop loss), and up to 3 take profit targets. Late entry should be ABOVE entry for longs, BELOW entry for shorts.";
    default:
      return "USER PREFERENCE: ADVANCED strategy - Provide full strategy with all available levels.";
  }
}

export async function runAIStrategy(
  input: AIStrategyInput
): Promise<AIStrategyOutput | null> {
  const { openaiApiKey } = (Constants.expoConfig?.extra || {}) as any;
  if (!openaiApiKey) {
    console.warn("OpenAI API key not configured. Skipping AI strategy.");
    return null;
  }

  const model = "gpt-5-mini";
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
      console.log("Max Tokens:", 750);
      console.log("Response Format: JSON");
      console.log("=====================================");

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 750,
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
      if (!Array.isArray(parsed.entries) || parsed.entries.length === 0) {
        console.log("❌ MISSING ENTRIES - CONTINUING TO NEXT STRATEGY");
        continue;
      }
      const primaryEntry = parsed.entries?.[0];
      const primaryExit = parsed.exits?.[0];
      const primaryStop = parsed.exits?.[0];
      if (
        typeof primaryEntry !== "number" ||
        !Number.isFinite(primaryEntry) ||
        typeof primaryStop !== "number" ||
        !Number.isFinite(primaryStop)
      ) {
        console.log("❌ INVALID NUMERIC VALUES - CONTINUING TO NEXT STRATEGY");
        console.log(
          "Entry:",
          primaryEntry,
          "Exit:",
          primaryStop,
          "Stop:",
          primaryStop
        );
        continue;
      }
      // Ensure at least one target for partial/advanced. For partial, prefer two.
      if (!parsed.tps || parsed.tps.length === 0) {
        // Derive default targets from entry/stop distances
        try {
          const isLong = (parsed.side || "long") === "long";
          const stopDistance = Math.abs(primaryEntry - primaryStop);
          const t1 = isLong
            ? primaryEntry + stopDistance * 1.5
            : primaryEntry - stopDistance * 1.5;
          const t2 = isLong
            ? primaryEntry + stopDistance * 2.5
            : primaryEntry - stopDistance * 2.5;
          parsed.tps =
            input.context?.complexity === "partial" ? [t1, t2] : [t1];
        } catch {}
      }
      // Default exits to stop if none provided
      if (!parsed.exits || parsed.exits.length === 0) {
        parsed.exits = [];
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
  output: AIStrategyOutput,
  complexity?: "simple" | "partial" | "advanced"
): TradePlanOverlay {
  const basePlan: TradePlanOverlay = {
    side: output.side,
    entries: output.entries,
    exits: output.exits,
    tps: output.tps,
    riskReward: output.riskReward,
    complexity: complexity || "advanced", // Default to advanced if not specified
  };

  // Apply complexity constraints
  if (complexity) {
    return applyComplexityConstraints(basePlan, complexity);
  }

  return basePlan;
}

// Apply complexity constraints to a trade plan
function applyComplexityConstraints(
  plan: TradePlanOverlay,
  complexity: "simple" | "partial" | "advanced"
): TradePlanOverlay {
  const constrainedPlan: TradePlanOverlay = { ...plan, complexity };

  switch (complexity) {
    case "simple": {
      constrainedPlan.entries = plan.entries?.slice(0, 1) || [];
      constrainedPlan.exits = plan.exits?.slice(0, 1) || [];
      constrainedPlan.tps = plan.tps?.slice(0, 1) || [];
      break;
    }
    case "partial": {
      constrainedPlan.entries = plan.entries?.slice(0, 1) || [];
      constrainedPlan.exits = plan.exits?.slice(0, 1) || [];
      constrainedPlan.tps = plan.tps?.slice(0, 2) || [];
      break;
    }
    case "advanced": {
      constrainedPlan.entries = plan.entries?.slice() || [];
      constrainedPlan.exits = plan.exits?.slice() || [];
      constrainedPlan.tps = plan.tps?.slice(0, 3) || [];
      break;
    }
  }

  return constrainedPlan;
}

// Exported helper to re-apply constraints to an existing plan (used by UI on complexity switch)
export function applyComplexityToPlan(
  plan: TradePlanOverlay,
  complexity: "simple" | "partial" | "advanced"
): TradePlanOverlay {
  return applyComplexityConstraints(plan, complexity);
}
