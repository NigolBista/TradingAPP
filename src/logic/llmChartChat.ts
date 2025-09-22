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
import { normalizeIndicatorOptions } from "./indicatorDefaults";

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

  // Fast-path: if the user clearly declined ("no", "no thanks", etc.),
  // acknowledge and end without further model calls or screenshots.
  const userText = (opts.message || "").trim();
  const isClearDecline =
    /^(no( thanks)?|nope|nah|not now|that's all|that is all|i'm good|im good|nothing else|cancel|stop)[.!\s]*$/i.test(
      userText
    );
  if (isClearDecline) {
    return {
      reply:
        "All set. I won't run analysis or make further changes. Ask anytime.",
      analysis: null,
    };
  }

  const client = new OpenAI({ apiKey: openaiApiKey });
  const strategyRunner = opts.strategyRunner ?? runAIStrategy;

  // Get comprehensive context configuration
  const contextConfig = generateChartContextConfig();

  const baseMessages = [
    {
      role: "system",
      content: `You are a trading assistant that controls a charting interface using tool calls.

IMPORTANT BEHAVIOR:
- When users ask to add indicators, change timeframes, modify chart settings, or make any chart modifications, you MUST use the appropriate tool calls to perform these actions.
- Only use the run_analysis tool when the user explicitly asks for analysis, insights, or trading recommendations.
- For chart modifications, use tools like add_indicator, set_timeframe, set_chart_type, etc.
- Always respond with tool calls when users request chart changes - don't just explain what you would do.
- Keep replies short and final. Do NOT ask follow-up questions like "Would you like to add indicators or run an analysis?" End with a concise confirmation.
- If the user declines or says "no", acknowledge politely and DO NOT suggest anything else or ask again.
- When styling indicators, default line thickness is 1 (thinnest). If multiple lines are added without colors, assign distinct colors.

EXAMPLES:
- User: "Add EMA indicator" → Call add_indicator tool with indicator: "EMA"
- User: "Change to 1D timeframe" → Call set_timeframe tool with timeframe: "1D"
- User: "Analyze this chart" → Call run_analysis tool
- User: "What do you think about this stock?" → Call run_analysis tool

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

Please use the appropriate tool calls to perform any requested chart modifications.`,
    },
  ];

  const tools = contextConfig.availableTools.map((tool) => ({
    type: "function",
    function: tool,
  }));

  const res = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages: baseMessages as any,
    tools,
    tool_choice: "auto",
  } as any);

  const toolCalls = (res.choices?.[0]?.message as any)?.tool_calls || [];
  console.log("LLM Response tool calls:", toolCalls);
  console.log("LLM Response content:", res.choices?.[0]?.message?.content);

  const actions: ChartAction[] = toolCalls.map((tc: any) => {
    const args = tc.function?.arguments
      ? JSON.parse(tc.function.arguments)
      : {};
    switch (tc.function?.name) {
      case "set_timeframe":
        return { type: "setTimeframe", timeframe: args.timeframe };
      case "add_indicator":
        return {
          type: "addIndicator",
          indicator: args.indicator,
          options: normalizeIndicatorOptions(args.indicator, args.options),
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
      case "run_analysis":
        return { type: "runAnalysis", strategy: args.strategy } as any;
      default:
        return { type: "noop" } as any;
    }
  });

  console.log("Generated actions:", actions);

  if (actions.length) {
    console.log("Executing chart actions:", actions);
    await executeChartActions(actions);
  } else {
    console.log("No actions to execute");
  }

  let screenshot: string | undefined;
  if (opts.sendData === "screenshot" || opts.sendData === "both") {
    screenshot = await screenshotChart();
  }

  // Only run analysis if run_analysis tool was called
  const hasAnalysisRequest = toolCalls.some(
    (tc: any) => tc.function?.name === "run_analysis"
  );
  let analysis: AIStrategyOutput | null = null;

  if (hasAnalysisRequest) {
    analysis = await strategyRunner({
      symbol: opts.symbol,
      candleData: {} as any,
      context: { screenshot },
      mode: opts.strategy || "auto",
    });
  }

  // Use the initial reply content directly to avoid an extra round-trip.
  const reply = res.choices?.[0]?.message?.content || "";
  return { reply, analysis, screenshot };
}
