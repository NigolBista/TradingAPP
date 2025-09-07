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
import { generateChartContextConfig } from "./chartContextConfig";

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
  // Get comprehensive context configuration
  const contextConfig = generateChartContextConfig();

  const messages = [
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
    {
      role: "user",
      content: `Plan chart actions for ${symbol}. 

Current Context: ${JSON.stringify(context, null, 2)}

Available Configuration: ${JSON.stringify(contextConfig, null, 2)}`,
    },
  ];

  const tools = contextConfig.availableTools.map((tool) => ({
    type: "function",
    function: tool,
  }));

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
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
        return {
          type: "addIndicator",
          indicator: args.indicator,
          options: args.options,
        };
      case "navigate":
        return { type: "navigate", direction: args.direction };
      case "check_news":
        return { type: "checkNews" };
      case "set_chart_type":
        return { type: "setChartType", chartType: args.chartType } as any;
      case "toggle_display_option":
        return {
          type: "toggleDisplayOption",
          option: args.option,
          enabled: args.enabled,
        } as any;
      default:
        return { type: "checkNews" };
    }
  });

  return actions;
}
