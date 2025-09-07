import Constants from "expo-constants";
import OpenAI from "openai";
import { runLLMChartEngine, LLMChartRunOptions } from "./llmChartEngine";
import { AIStrategyOutput } from "./aiStrategyEngine";

/** Options for the agentic trading system. */
export interface AgenticRunOptions extends LLMChartRunOptions {
  /**
   * Number of analysis iterations to perform. Each iteration will critique the
   * previous result and optionally incorporate user feedback before running
   * again. Defaults to 1.
   */
  iterations?: number;
  /** Callback fired with the critique so a human can provide feedback. */
  onUserFeedback?: (critique: string, iteration: number) => Promise<string | void>;
}

/**
 * Run a multi-agent trading loop. The LLM controls the chart through tool
 * calls, the result is critiqued, and optional human feedback is incorporated
 * for deeper analysis.
 */
export async function runAgenticTrading(
  opts: AgenticRunOptions
): Promise<AIStrategyOutput | null> {
  const { openaiApiKey } = (Constants.expoConfig?.extra || {}) as any;
  if (!openaiApiKey) {
    console.warn("OpenAI API key not configured. Skipping agentic trader.");
    return null;
  }

  const client = new OpenAI({ apiKey: openaiApiKey });
  const iterations = opts.iterations ?? 1;
  let feedback: string | undefined;
  let analysis: AIStrategyOutput | null = null;

  for (let i = 0; i < iterations; i++) {
    // Run a single LLM-driven chart analysis cycle
    analysis = await runLLMChartEngine({ ...opts, runs: 1 });

    // Critique the analysis result
    const critique = await critiqueAnalysis(client, analysis, feedback);

    // Allow a human to weigh in before the next iteration
    if (opts.onUserFeedback) {
      const user = await opts.onUserFeedback(critique, i);
      feedback = typeof user === "string" ? user : undefined;
    }
  }

  return analysis;
}

async function critiqueAnalysis(
  client: OpenAI,
  analysis: AIStrategyOutput | null,
  userFeedback?: string
): Promise<string> {
  const messages = [
    {
      role: "system",
      content:
        "You are a critical trading assistant. Review the proposed strategy and point out weaknesses or missing information.",
    },
    {
      role: "user",
      content: `Analysis: ${JSON.stringify(analysis)}. UserFeedback: ${userFeedback || "none"}`,
    },
  ];

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  } as any);

  return res.choices?.[0]?.message?.content?.trim() || "";
}
