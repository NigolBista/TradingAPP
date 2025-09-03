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
      const desiredComplexity = (input.context?.complexity || "advanced") as
        | "simple"
        | "partial"
        | "advanced";
      const requireExit = desiredComplexity === "advanced";
      if (
        !Number.isFinite(parsed.entry) ||
        !Number.isFinite(parsed.stop) ||
        (requireExit && !Number.isFinite(parsed.exit))
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
      // Ensure at least one target for partial/advanced. For partial, prefer two.
      if (!parsed.targets || parsed.targets.length === 0) {
        // Derive default targets from entry/stop distances
        try {
          const isLong = (parsed.side || "long") === "long";
          const stopDistance = Math.abs(parsed.entry - parsed.stop);
          const t1 = isLong
            ? parsed.entry + stopDistance * 1.5
            : parsed.entry - stopDistance * 1.5;
          const t2 = isLong
            ? parsed.entry + stopDistance * 2.5
            : parsed.entry - stopDistance * 2.5;
          parsed.targets = desiredComplexity === "partial" ? [t1, t2] : [t1];
        } catch {}
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
    entry: output.entry,
    lateEntry: output.lateEntry,
    exit: output.exit,
    lateExit: output.lateExit,
    stop: output.stop,
    targets: output.targets,
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
      // Simple: Only entry, stop, and first target
      constrainedPlan.lateEntry = undefined;
      constrainedPlan.exit = undefined;
      constrainedPlan.lateExit = undefined;
      constrainedPlan.targets = plan.targets?.slice(0, 1) || [];
      break;
    }
    case "partial": {
      // Partial: Entry, stop, and up to 2 targets (no separate exit levels)
      constrainedPlan.lateEntry = undefined;
      constrainedPlan.exit = undefined;
      constrainedPlan.lateExit = undefined;
      constrainedPlan.targets = plan.targets?.slice(0, 2) || [];
      break;
    }
    case "advanced": {
      // Advanced: Entry + Late Entry (breakout/breakdown), Stop + Extended Stop, up to 3 targets
      constrainedPlan.targets = plan.targets?.slice(0, 3) || [];

      const { entry, stop } = constrainedPlan;
      if (entry != null && stop != null) {
        const isLong = (constrainedPlan.side || "long") === "long";
        const stopDistance = Math.abs(entry - stop);

        // Ensure lateEntry direction is correct: ABOVE entry for long, BELOW for short
        const desiredLateEntry = isLong
          ? entry + stopDistance * 0.3
          : entry - stopDistance * 0.3;
        if (
          constrainedPlan.lateEntry == null ||
          (isLong && constrainedPlan.lateEntry <= entry) ||
          (!isLong && constrainedPlan.lateEntry >= entry)
        ) {
          constrainedPlan.lateEntry = desiredLateEntry;
        }

        // Remove explicit exit levels in advanced; compute extended stop instead
        constrainedPlan.exit = undefined;
        const extendedMultiplier = 1.3;
        const extendedStopDistance = stopDistance * extendedMultiplier;
        constrainedPlan.lateExit = isLong
          ? entry - extendedStopDistance
          : entry + extendedStopDistance;
      } else {
        // If entry/stop missing, still remove exit to avoid confusing lines
        constrainedPlan.exit = undefined;
      }
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
