import Constants from "expo-constants";
import OpenAI from "openai";
import {
  executeChartActions,
  screenshotChart,
  ChartAction,
} from "./chartBridge";
import {
  runAIStrategy,
  AIStrategyOutput,
  AIStrategyInput,
} from "./aiStrategyEngine";
import { StrategyKey } from "./strategies";

export interface LLMChartRunOptions {
  symbol: string;
  strategy?: StrategyKey;
  runs?: number;
  sendData?: "screenshot" | "chart" | "both";
  /** Optional custom strategy engine */
  strategyRunner?: (input: AIStrategyInput) => Promise<AIStrategyOutput | null>;
}

/**
 * Main entry point for running the chart analysis loop. The LLM issues
 * tool calls that are mapped to chart actions. After executing the actions
 * a screenshot or chart data can be sent back for iterative analysis.
 */
export async function runLLMChartEngine(
  opts: LLMChartRunOptions
): Promise<AIStrategyOutput | null> {
  const { openaiApiKey } = (Constants.expoConfig?.extra || {}) as any;
  if (!openaiApiKey) {
    console.warn("OpenAI API key not configured. Skipping LLM chart engine.");
    return null;
  }

  const client = new OpenAI({ apiKey: openaiApiKey });
  const runs = opts.runs ?? 1;
  const strategyRunner = opts.strategyRunner ?? runAIStrategy;
  let context: any = {};
  let lastAnalysis: AIStrategyOutput | null = null;

  for (let i = 0; i < runs; i++) {
    const actions = await requestActions(client, opts.symbol, context);
    await executeChartActions(actions);

    if (opts.sendData === "screenshot" || opts.sendData === "both") {
      const shot = await screenshotChart();
      context.screenshot = shot;
    }

    lastAnalysis = await strategyRunner({
      symbol: opts.symbol,
      candleData: {} as any,
      context: { ...context },
      mode: opts.strategy || "auto",
    });
    context.analysis = lastAnalysis;
  }

  return lastAnalysis;
}

async function requestActions(
  client: OpenAI,
  symbol: string,
  context: any
): Promise<ChartAction[]> {
  const messages = [
    {
      role: "system",
      content:
        "You are a trading assistant that controls a charting interface using tool calls.",
    },
    {
      role: "user",
      content: `Plan chart actions for ${symbol}. Context: ${JSON.stringify(
        context
      )}`,
    },
  ];

  const tools = [
    {
      type: "function",
      function: {
        name: "set_timeframe",
        description: "change chart timeframe",
        parameters: {
          type: "object",
          properties: { timeframe: { type: "string" } },
          required: ["timeframe"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_indicator",
        description: "add technical indicator",
        parameters: {
          type: "object",
          properties: {
            indicator: { type: "string" },
            options: { type: "object" },
          },
          required: ["indicator"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "navigate",
        description: "pan chart",
        parameters: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["left", "right"] },
          },
          required: ["direction"],
        },
      },
    },
  ];

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools,
    tool_choice: "auto",
  } as any);

  const toolCalls = (res.choices?.[0]?.message as any)?.tool_calls || [];
  const actions: ChartAction[] = toolCalls.map((tc: any) => {
    const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
    switch (tc.function?.name) {
      case "set_timeframe":
        return { type: "setTimeframe", timeframe: args.timeframe };
      case "add_indicator":
        return { type: "addIndicator", indicator: args.indicator, options: args.options };
      case "navigate":
        return { type: "navigate", direction: args.direction };
      default:
        return { type: "checkNews" };
    }
  });

  return actions;
}
