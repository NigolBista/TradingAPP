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
import {
  generateChartContextConfig,
  getColorByName,
  isValidColor,
} from "./chartContextConfig";

function normalizeColor(color: string): string {
  if (!color) return color;

  // First check if it's already a valid hex color
  if (isValidColor(color)) {
    return color;
  }

  // Try to find by name or category
  const foundColor = getColorByName(color);
  if (foundColor) {
    return foundColor;
  }

  // Return original if no match found
  return color;
}

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

  // Get comprehensive context configuration
  const contextConfig = generateChartContextConfig();

  const baseMessages = [
    {
      role: "system",
      content: `You are a trading assistant that controls a charting interface using tool calls.

Available Configuration:
- Chart Types: ${contextConfig.chartTypes
        .map((ct) => `${ct.value} (${ct.label})`)
        .join(", ")}
- Timeframes: ${contextConfig.timeframes
        .map((tf) => `${tf.value} (${tf.label})`)
        .join(", ")}
- Line Styles: ${contextConfig.lineStyles
        .map((ls) => `${ls.value} (${ls.label})`)
        .join(", ")}
- Line Thickness: ${contextConfig.lineThicknessOptions
        .map((lt) => `${lt.value}px (${lt.label})`)
        .join(", ")}
- Available Colors: ${contextConfig.colorPalette
        .map((c) => `${c.value} (${c.name})`)
        .join(", ")}
- Available Indicators: ${contextConfig.availableIndicators
        .map((ind) => `${ind.name} (${ind.title})`)
        .join(", ")}
- Trading Strategies: ${contextConfig.tradingStrategies
        .map((ts) => `${ts.value} (${ts.label})`)
        .join(", ")}
- Strategy Complexity: ${contextConfig.strategyComplexityLevels
        .map((sc) => `${sc.value} (${sc.label})`)
        .join(", ")}

Use the available options when making tool calls. Always use valid values from the configuration above.`,
    },
    ...opts.history,
    {
      role: "user",
      content: `${opts.message}

Available Configuration: ${JSON.stringify(contextConfig, null, 2)}`,
    },
  ];

  const tools = contextConfig.availableTools.map((tool) => ({
    type: "function",
    function: tool,
  }));

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: baseMessages as any,
    tools,
    tool_choice: "auto",
  } as any);

  const toolCalls = (res.choices?.[0]?.message as any)?.tool_calls || [];
  const actions: ChartAction[] = toolCalls.map((tc: any) => {
    const args = tc.function?.arguments
      ? JSON.parse(tc.function.arguments)
      : {};
    switch (tc.function?.name) {
      case "set_timeframe":
        return { type: "setTimeframe", timeframe: args.timeframe };
      case "add_indicator":
        if (args.options?.styles?.lines) {
          args.options.styles.lines = args.options.styles.lines.map(
            (l: any) => ({
              ...l,
              color: normalizeColor(l.color),
            })
          );
        }
        return {
          type: "addIndicator",
          indicator: args.indicator,
          options: args.options,
        };
      case "navigate":
        return { type: "navigate", direction: args.direction };
      case "check_news":
        return { type: "checkNews" } as any;
      case "set_chart_type":
        return { type: "setChartType", chartType: args.chartType } as any;
      case "toggle_display_option":
        return {
          type: "toggleDisplayOption",
          option: args.option,
          enabled: args.enabled,
        } as any;
      default:
        return { type: "noop" } as any;
    }
  });

  if (actions.length) {
    await executeChartActions(actions);
  }

  let screenshot: string | undefined;
  if (
    opts.sendData === "screenshot" ||
    opts.sendData === "both" ||
    !opts.sendData
  ) {
    screenshot = await screenshotChart();
  }

  const analysis = await strategyRunner({
    symbol: opts.symbol,
    candleData: {} as any,
    context: { screenshot },
    mode: opts.strategy || "auto",
  });

  // Add assistant message with tool calls if there were any actions
  const assistantMessage = {
    role: "assistant" as const,
    content: res.choices?.[0]?.message?.content || "",
    tool_calls: toolCalls,
  };

  const followMessages = baseMessages.concat([assistantMessage]);

  // Add tool response messages for each tool call
  if (toolCalls.length > 0) {
    // Add responses for chart control tool calls
    toolCalls.forEach((toolCall: any) => {
      followMessages.push({
        role: "tool" as const,
        tool_call_id: toolCall.id,
        name: toolCall.function?.name || "chart_action",
        content: JSON.stringify({
          success: true,
          action: toolCall.function?.name,
        }),
      } as any);
    });

    // Provide analysis and screenshot context to the model
    followMessages.push({
      role: "user" as const,
      content: JSON.stringify({ analysis, screenshot: !!screenshot }),
    });
  }

  const final = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: followMessages as any,
  } as any);

  const reply = final.choices?.[0]?.message?.content || "";
  return { reply, analysis, screenshot };
}
