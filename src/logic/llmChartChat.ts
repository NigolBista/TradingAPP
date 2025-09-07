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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRunOptions {
  symbol: string;
  message: string;
  history: ChatMessage[];
  strategy?: StrategyKey;
  runs?: number;
  sendData?: "screenshot" | "chart" | "both";
  /** Optional custom strategy engine */
  strategyRunner?: (input: AIStrategyInput) => Promise<AIStrategyOutput | null>;
}

export interface ChatRunResult {
  reply: string;
  analysis: AIStrategyOutput | null;
  screenshot?: string;
}

/**
 * Handle a single user message in the chart chat. The model may issue tool
 * calls to control the chart before responding.
 */
export async function sendChartChatMessage(
  opts: ChatRunOptions
): Promise<ChatRunResult> {
  const { openaiApiKey } = (Constants.expoConfig?.extra || {}) as any;
  if (!openaiApiKey) {
    console.warn("OpenAI API key not configured. Skipping LLM chat.");
    return { reply: "", analysis: null };
  }

  const client = new OpenAI({ apiKey: openaiApiKey });
  const strategyRunner = opts.strategyRunner ?? runAIStrategy;

  const baseMessages = [
    {
      role: "system",
      content:
        "You are a trading assistant that controls a charting interface using tool calls.",
    },
    ...opts.history,
    { role: "user", content: opts.message },
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
    {
      type: "function",
      function: {
        name: "check_news",
        description: "check latest news",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
  ];

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: baseMessages as any,
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
        return {
          type: "addIndicator",
          indicator: args.indicator,
          options: args.options,
        };
      case "navigate":
        return { type: "navigate", direction: args.direction };
      case "check_news":
        return { type: "checkNews" } as any;
      default:
        return { type: "noop" } as any;
    }
  });

  if (actions.length) {
    await executeChartActions(actions);
  }

  let screenshot: string | undefined;
  if (opts.sendData === "screenshot" || opts.sendData === "both" || !opts.sendData) {
    screenshot = await screenshotChart();
  }

  const analysis = await strategyRunner({
    symbol: opts.symbol,
    candleData: {} as any,
    context: { screenshot },
    mode: opts.strategy || "auto",
  });

  const followMessages = baseMessages.concat([
    {
      role: "tool",
      name: "chart_update",
      content: JSON.stringify({ analysis, screenshot: !!screenshot }),
    } as any,
  ]);

  const final = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: followMessages as any,
  } as any);

  const reply = final.choices?.[0]?.message?.content || "";
  return { reply, analysis, screenshot };
}
