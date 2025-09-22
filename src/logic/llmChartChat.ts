import Constants from "expo-constants";
import OpenAI from "openai";
import {
  executeChartActions,
  screenshotChart,
  ChartAction,
  getChartBridge,
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
import { runChartSequence, type SequenceStep } from "./chartSequenceEngine";
import { requestOpenChat } from "../services/overlayBus";

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
  /** If true, skip narration and delays for faster execution (default: true) */
  fast?: boolean;
  /** Explicitly allow analysis even if heuristics don't detect it */
  allowAnalysis?: boolean;
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
  const fast = opts.fast !== false; // default fast = true

  // Get comprehensive context configuration
  const contextConfig = generateChartContextConfig();

  // Determine if user explicitly asked for analysis
  const analysisRegex =
    /\b(analy(s|z)e|analysis|insight|signal|entry|exit|trade plan|recommend|opinion|what do you think|setup for (trade|entry|exit))\b/i;
  const wantsAnalysis = analysisRegex.test(userText);
  const allowAnalysis = opts.allowAnalysis || wantsAnalysis;

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

  const tools = contextConfig.availableTools
    // Hide run_analysis tool unless explicitly requested to avoid extra LLM calls
    .filter((tool) => tool.name !== "run_analysis" || allowAnalysis)
    .map((tool) => ({
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
      case "set_tooltip_rule":
        return {
          type: "toggleDisplayOption",
          option: "tooltipRule",
          enabled: args.rule,
        } as any;
      case "add_indicator":
        return {
          type: "addIndicator",
          indicator: args.indicator,
          options: normalizeIndicatorOptions(args.indicator, args.options),
        };
      case "remove_indicator":
        return {
          type: "toggleDisplayOption",
          option: "removeIndicator",
          enabled: args.indicator,
        } as any;
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

  // Translate actions into sequence steps for narrated playback when there are multiple steps
  const steps: SequenceStep[] = [];
  for (const a of actions) {
    switch (a.type) {
      case "setTimeframe": {
        const tf = (a as any).timeframe;
        // Pre-step narration
        steps.push({
          kind: "timeframe",
          timeframe: tf,
          message: `Checking ${tf}`,
        } as any);
        // Brief confirmation after switch
        steps.push({ kind: "delay", ms: 700, message: `Now on ${tf}` } as any);
        break;
      }
      case "setChartType":
        steps.push({
          kind: "chartType",
          chartType: (a as any).chartType,
          message: `Chart → ${(a as any).chartType}`,
        } as any);
        break;
      case "navigate":
        steps.push({
          kind: "navigate",
          direction: (a as any).direction,
          message: `Navigate ${(a as any).direction}`,
        } as any);
        break;
      case "addIndicator":
        steps.push({
          kind: "indicator",
          indicator: (a as any).indicator,
          options: (a as any).options,
          message: `Add ${(a as any).indicator}`,
        } as any);
        break;
      case "toggleDisplayOption": {
        const opt = (a as any).option;
        const en = (a as any).enabled;
        steps.push({
          kind: "toggleOption",
          option: opt,
          enabled: en,
          message:
            opt === "showGrid"
              ? en
                ? "Show grid"
                : "Hide grid"
              : opt === "tooltipRule"
              ? `Labels: ${String(en)}`
              : opt === "removeIndicator"
              ? `Remove ${String(en)}`
              : undefined,
        } as any);
        break;
      }
      default:
        break;
    }
  }

  if (steps.length) {
    // Optional: only open overlay UI if not in fast mode
    if (!fast) {
      try {
        requestOpenChat();
      } catch {}
    }

    // Wait briefly for chart bridge to be ready
    async function waitForChartReady(timeoutMs = 1000) {
      const start = Date.now();
      while (!getChartBridge()) {
        if (Date.now() - start > timeoutMs) break;
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    await waitForChartReady(fast ? 300 : 1000);

    await runChartSequence(steps, {
      narrate: fast ? false : true,
      cancellable: false,
      perStepDelayMs: fast
        ? 0
        : (i, step) =>
            step.kind === "timeframe" ? 900 : step.kind === "delay" ? 600 : 300,
    });
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

  // Build a concise fallback summary if the LLM returned no text
  function summarizeAction(a: ChartAction): string | null {
    switch (a.type) {
      case "setTimeframe":
        return `Timeframe set to ${a.timeframe}`;
      case "setChartType":
        return `Chart type set to ${a.chartType}`;
      case "navigate":
        return `Panned ${a.direction}`;
      case "addIndicator": {
        const params = Array.isArray((a.options as any)?.calcParams)
          ? (a.options as any).calcParams.join(",")
          : undefined;
        return `Added ${a.indicator}${params ? `(${params})` : ""}`;
      }
      case "toggleDisplayOption": {
        const opt = (a as any).option;
        const en = (a as any).enabled;
        if (opt === "showGrid") return en ? "Grid shown" : "Grid hidden";
        if (opt === "ma") return en ? "MA shown" : "MA hidden";
        if (opt === "volume") return en ? "Volume shown" : "Volume hidden";
        if (opt === "sessions")
          return en ? "Sessions shown" : "Sessions hidden";
        if (opt === "tooltipRule") {
          const rule = String(en);
          if (rule === "always") return "Labels always shown";
          if (rule === "follow_cross") return "Labels follow crosshair";
          if (rule === "none") return "Labels hidden";
          return `Labels: ${rule}`;
        }
        if (opt === "removeIndicator") return `Removed ${String(en)}`;
        return null;
      }
      case "checkNews":
        return "Checked latest news";
      case "runAnalysis":
        return "Analysis requested";
      default:
        return null;
    }
  }

  const parts = actions
    .map((a) => summarizeAction(a))
    .filter((s): s is string => !!s);
  if (hasAnalysisRequest) parts.push("Analysis completed");
  const summary = parts.join(". ") + (parts.length ? "." : "");

  // Use the initial reply content if present; otherwise fall back to our summary
  const llmText = (res.choices?.[0]?.message?.content || "").trim();
  const reply = llmText || summary || "Done.";
  return { reply, analysis, screenshot };
}
