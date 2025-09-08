import {
  Agent,
  AgentContext,
  AgentResponse,
  AgentAction,
  WorkflowStep,
} from "./types";
import { agentRegistry } from "./registry";
import { z } from "zod";
import {
  generateChartContextConfig,
  getIndicatorByName,
  getColorByName,
  isValidTimeframe,
  isValidChartType,
} from "../logic/chartContextConfig";
import { validateToolStep } from "../logic/actionSchemas";

const workflowStepSchema = z.object({
  agent: z.string(),
  action: z.string(),
  params: z.record(z.string(), z.any()).optional(),
});

export class OrchestratorAgent implements Agent {
  name = "orchestrator";
  description =
    "Coordinates and orchestrates other agents to execute complex tasks";

  capabilities = [
    {
      name: "execute-workflow",
      description: "Execute a multi-step workflow using multiple agents",
      parameters: {
        workflow: { type: "array", items: { type: "object" } },
        parallel: { type: "boolean", default: false },
      },
    },
    {
      name: "coordinate-analysis",
      description:
        "Coordinate comprehensive market analysis using multiple agents",
      parameters: {
        symbol: { type: "string" },
        analysisType: {
          type: "string",
          enum: ["technical", "fundamental", "sentiment", "comprehensive"],
        },
      },
    },
    {
      name: "execute-trading-plan",
      description:
        "Execute a complete trading plan with analysis, chart setup, and execution",
      parameters: {
        symbol: { type: "string" },
        strategy: { type: "string" },
        riskLevel: {
          type: "string",
          enum: ["conservative", "moderate", "aggressive"],
        },
      },
    },
    {
      name: "setup-chart-analysis",
      description: "Setup chart with indicators and perform analysis",
      parameters: {
        symbol: { type: "string" },
        timeframe: { type: "string" },
        indicators: {
          type: "array",
          items: {
            type: "object",
            properties: {
              indicator: { type: "string" },
              options: { type: "object", optional: true },
            },
          },
        },
      },
    },
    {
      name: "determine-entry-exit",
      description: "Setup chart and determine entry/exit points",
      parameters: {
        symbol: { type: "string" },
        timeframe: { type: "string", optional: true },
        indicators: {
          type: "array",
          items: {
            type: "object",
            properties: {
              indicator: { type: "string" },
              options: { type: "object", optional: true },
            },
          },
          optional: true,
        },
      },
    },
    {
      name: "process-chart-command",
      description:
        "Interpret natural language chart commands and execute only the requested chart actions (no analysis unless explicitly asked). Supports timeframe, chart type, navigation, add/update/remove indicators with params and line styles.",
      parameters: {
        command: { type: "string" },
      },
    },
    {
      name: "get-agent-status",
      description: "Get status and capabilities of all registered agents",
      parameters: {},
    },
  ];

  async execute(
    context: AgentContext,
    action: string,
    params?: any
  ): Promise<AgentResponse> {
    try {
      switch (action) {
        case "execute-plan": {
          // Accept an ActionEnvelope and dispatch to chart-control accordingly
          const plan = params?.plan;
          const steps: any[] = Array.isArray(plan?.steps) ? plan.steps : [];
          const results: any[] = [];
          for (const step of steps) {
            const tool: string = step.tool || "";
            const args: any = step.args || {};
            const validation = validateToolStep(tool, args);
            if (!validation.ok) {
              results.push({
                success: false,
                error: `Schema error for ${tool}: ${validation.error}`,
              });
              continue;
            }
            const parsed = validation.parsed || args;
            if (tool === "chart.control.set_timeframe") {
              const chart = agentRegistry.getAgent("chart-control");
              results.push(
                await chart?.execute(context, "change-timeframe", {
                  timeframe: parsed.timeframe,
                })
              );
            } else if (tool === "chart.control.set_type") {
              const chart = agentRegistry.getAgent("chart-control");
              results.push(
                await chart?.execute(context, "change-chart-type", {
                  chartType: parsed.type,
                })
              );
            } else if (tool === "chart.control.navigate") {
              const chart = agentRegistry.getAgent("chart-control");
              results.push(
                await chart?.execute(context, "navigate-chart", {
                  direction: parsed.direction,
                })
              );
            } else if (tool === "indicators.add") {
              const chart = agentRegistry.getAgent("chart-control");
              const indicator = String(parsed.type || "").toUpperCase();
              const calcParams = Array.isArray(parsed?.params?.calcParams)
                ? parsed.params.calcParams
                : undefined;
              const overlay = !!parsed?.placement?.overlay;
              const styles = parsed?.styles || undefined;
              results.push(
                await chart?.execute(context, "add-indicator", {
                  indicator,
                  options: { overlay, calcParams, styles },
                })
              );
            } else if (tool === "indicators.remove") {
              const chart = agentRegistry.getAgent("chart-control");
              const indicator = String(
                parsed?.type || parsed?.id || ""
              ).toUpperCase();
              results.push(
                await chart?.execute(context, "remove-indicator", { indicator })
              );
            } else if (
              tool === "presets.save" ||
              tool === "presets.load" ||
              tool === "favorites.add_timeframe" ||
              tool === "favorites.add_type" ||
              tool === "draw.add" ||
              tool === "draw.remove" ||
              tool === "state.verify" ||
              tool === "history.undo" ||
              tool === "history.redo"
            ) {
              if (tool === "state.verify") {
                const chart = agentRegistry.getAgent("chart-control");
                const state = await chart?.execute(
                  context,
                  "get-chart-state",
                  {}
                );
                const expected = parsed;
                let ok = true;
                const mismatches: string[] = [];
                if (
                  expected.timeframe &&
                  state?.data?.timeframe !== expected.timeframe
                ) {
                  ok = false;
                  mismatches.push(`timeframe!=${expected.timeframe}`);
                }
                if (
                  expected.chart_type &&
                  state?.data?.chartType !== expected.chart_type
                ) {
                  ok = false;
                  mismatches.push(`chart_type!=${expected.chart_type}`);
                }
                if (Array.isArray(expected.indicators)) {
                  const have = (state?.data?.indicators || []).map((i: any) =>
                    (i.name || i.indicator || "").toUpperCase()
                  );
                  expected.indicators.forEach((e: any) => {
                    const nm = String(e.type || e.name || "").toUpperCase();
                    if (!have.includes(nm)) {
                      ok = false;
                      mismatches.push(`missing:${nm}`);
                    }
                  });
                }
                results.push({
                  success: ok,
                  data: { tool, args: parsed, mismatches },
                  message: ok ? "verified" : "verification_failed",
                });
              } else {
                // Acknowledge favorites/presets/draw/history for now
                results.push({
                  success: true,
                  data: { tool, args: parsed },
                  message: "applied",
                });
              }
            } else {
              // Unknown tool: skip with warning
              results.push({ success: false, error: `Unknown tool ${tool}` });
            }
          }
          return { success: true, data: { results }, message: "Plan executed" };
        }
        case "execute-workflow":
          return this.executeWorkflow(
            context,
            params?.workflow,
            params?.parallel
          );

        case "coordinate-analysis":
          return this.coordinateAnalysis(
            context,
            params?.symbol,
            params?.analysisType
          );

        case "execute-trading-plan":
          return this.executeTradingPlan(
            context,
            params?.symbol,
            params?.strategy,
            params?.riskLevel
          );

        case "setup-chart-analysis":
          return this.setupChartAnalysis(
            context,
            params?.symbol,
            params?.timeframe,
            params?.indicators
          );

        case "determine-entry-exit":
          return this.determineEntryExit(
            context,
            params?.symbol,
            params?.timeframe,
            params?.indicators
          );

        case "process-chart-command":
          return this.processChartCommand(context, params?.command);

        case "get-agent-status":
          return this.getAgentStatus();

        default:
          return {
            success: false,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Orchestrator agent error: ${error}`,
      };
    }
  }

  canHandle(action: string): boolean {
    return this.capabilities.some((cap) => cap.name === action);
  }

  getRequiredContext(): string[] {
    return ["symbol"];
  }

  private async executeWorkflow(
    context: AgentContext,
    workflow: WorkflowStep[],
    parallel: boolean = false
  ): Promise<AgentResponse> {
    const validation = z.array(workflowStepSchema).safeParse(workflow);
    if (!validation.success) {
      return {
        success: false,
        error: `Invalid workflow: ${validation.error.message}`,
      };
    }

    const steps = validation.data;
    const results: any[] = [];
    const errors: string[] = [];

    if (parallel) {
      const promises = steps.map(async (step, index) => {
        const agent = agentRegistry.getAgent(step.agent);
        if (!agent) {
          return { error: `Step ${index + 1}: Agent ${step.agent} not found` };
        }
        if (!agent.canHandle(step.action)) {
          return {
            error: `Step ${index + 1}: Agent ${step.agent} cannot handle ${
              step.action
            }`,
          };
        }
        try {
          return await agent.execute(context, step.action, step.params);
        } catch (err: any) {
          return { error: err.message };
        }
      });

      const responses = await Promise.all(promises);
      responses.forEach((response: any) => {
        if (response && response.success) {
          results.push(response);
        } else if (response && response.error) {
          errors.push(response.error);
        }
      });
    } else {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const agent = agentRegistry.getAgent(step.agent);
        if (!agent) {
          errors.push(`Step ${i + 1}: Agent ${step.agent} not found`);
          continue;
        }
        if (!agent.canHandle(step.action)) {
          errors.push(
            `Step ${i + 1}: Agent ${step.agent} cannot handle ${step.action}`
          );
          continue;
        }
        try {
          const response = await agent.execute(
            context,
            step.action,
            step.params
          );
          if (response.success) {
            results.push(response);
            if (response.data) {
              context = { ...context, ...response.data };
            }
          } else {
            errors.push(`Step ${i + 1}: ${response.error}`);
          }
        } catch (err: any) {
          errors.push(`Step ${i + 1}: ${err.message}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      data: { results, errors },
      message: `Workflow executed with ${results.length} successful steps and ${errors.length} errors`,
    };
  }

  private async coordinateAnalysis(
    context: AgentContext,
    symbol: string,
    analysisType: string
  ): Promise<AgentResponse> {
    const workflow = [];

    // Always get chart context first
    workflow.push({
      agent: "chart-context",
      action: "get-chart-context",
      params: {},
    });

    // Setup chart with basic indicators
    workflow.push({
      agent: "chart-control",
      action: "setup-chart",
      params: { symbol, timeframe: "1D" },
    });

    // Add analysis based on type
    switch (analysisType) {
      case "technical":
        workflow.push({
          agent: "analysis",
          action: "technical-analysis",
          params: { symbol },
        });
        break;
      case "fundamental":
        workflow.push({
          agent: "analysis",
          action: "fundamental-analysis",
          params: { symbol },
        });
        break;
      case "sentiment":
        workflow.push({
          agent: "news",
          action: "analyze-sentiment",
          params: { symbol },
        });
        break;
      case "comprehensive":
        workflow.push(
          {
            agent: "analysis",
            action: "technical-analysis",
            params: { symbol },
          },
          {
            agent: "analysis",
            action: "fundamental-analysis",
            params: { symbol },
          },
          {
            agent: "news",
            action: "analyze-sentiment",
            params: { symbol },
          }
        );
        break;
      default:
        return {
          success: false,
          error: `Unknown analysis type: ${analysisType}`,
        };
    }

    return this.executeWorkflow(
      context,
      workflow,
      analysisType === "comprehensive"
    );
  }

  private async executeTradingPlan(
    context: AgentContext,
    symbol: string,
    strategy: string,
    riskLevel: string
  ): Promise<AgentResponse> {
    const workflow = [
      // Get chart context
      {
        agent: "chart-context",
        action: "get-chart-context",
        params: {},
      },
      // Setup chart
      {
        agent: "chart-control",
        action: "setup-chart",
        params: { symbol, timeframe: "1D" },
      },
      // Perform analysis
      {
        agent: "analysis",
        action: "comprehensive-analysis",
        params: { symbol },
      },
      // Generate strategy
      {
        agent: "strategy",
        action: "generate-strategy",
        params: { symbol, strategy, riskLevel },
      },
      // Execute trade if conditions are met
      {
        agent: "trading",
        action: "execute-trade",
        params: { symbol, strategy, riskLevel },
      },
    ];

    return this.executeWorkflow(context, workflow, false);
  }

  private async setupChartAnalysis(
    context: AgentContext,
    symbol: string,
    timeframe: string,
    indicators: { indicator: string; options?: any }[] = []
  ): Promise<AgentResponse> {
    const workflow = [
      // Get chart context
      {
        agent: "chart-context",
        action: "get-chart-context",
        params: {},
      },
      // Setup chart
      {
        agent: "chart-control",
        action: "setup-chart",
        params: { symbol, timeframe },
      },
      // Add indicators
      ...indicators.map((def) => ({
        agent: "chart-control",
        action: "add-indicator",
        params: { indicator: def.indicator, options: def.options },
      })),
      // Perform analysis
      {
        agent: "analysis",
        action: "analyze-chart",
        params: { symbol, indicators: indicators.map((i) => i.indicator) },
      },
    ];

    return this.executeWorkflow(context, workflow, false);
  }

  private async determineEntryExit(
    context: AgentContext,
    symbol: string,
    timeframe?: string,
    indicators: { indicator: string; options?: any }[] = []
  ): Promise<AgentResponse> {
    const workflow = [
      { agent: "chart-context", action: "get-chart-context", params: {} },
      {
        agent: "chart-control",
        action: "setup-chart",
        params: { symbol, timeframe: timeframe || "1D" },
      },
      ...indicators.map((def) => ({
        agent: "chart-control",
        action: "add-indicator",
        params: { indicator: def.indicator, options: def.options },
      })),
      {
        agent: "analysis",
        action: "entry-exit-analysis",
        params: { symbol, indicators: indicators.map((i) => i.indicator) },
      },
    ];

    return this.executeWorkflow(context, workflow, false);
  }

  private async processChartCommand(
    context: AgentContext,
    command: string
  ): Promise<AgentResponse> {
    const original = command || "";
    const lower = original.toLowerCase();

    // Pull full context so we know supported options
    const ctx = generateChartContextConfig();

    // Build indicator name map and synonyms
    const indicatorMap: Record<string, string> = {};
    const addSyn = (syn: string, name: string) => {
      indicatorMap[syn.toLowerCase()] = name;
    };
    ctx.availableIndicators.forEach((ind: any) => {
      addSyn(ind.name, ind.name);
      addSyn((ind.title || ind.name).toLowerCase(), ind.name);
    });
    // Common synonyms
    addSyn("bollinger", "BOLL");
    addSyn("bb", "BOLL");
    addSyn("stochastic", "KDJ");
    addSyn("kdj", "KDJ");
    addSyn("vwap", "VWAP");
    addSyn("moving average", "MA");
    addSyn("simple moving average", "SMA");
    addSyn("exponential moving average", "EMA");

    // Overlay-compat list provided by user
    const overlayCompat = new Set(["BBI", "BOLL", "EMA", "MA", "SAR", "SMA"]);

    // Helpers
    const uniqNums = (nums: number[]) => {
      const seen = new Set<number>();
      const out: number[] = [];
      nums.forEach((n) => {
        const v = Math.floor(n);
        if (Number.isFinite(v) && v > 0 && v < 10000 && !seen.has(v)) {
          seen.add(v);
          out.push(v);
        }
      });
      return out;
    };

    const findNumbersAfter = (idx: number): number[] => {
      const windowText = lower.slice(idx, idx + 80);
      const matches = windowText.match(/\d{1,4}(?:\.\d+)?/g);
      if (!matches) return [];
      return uniqNums(matches.map((m) => Number(m)));
    };

    const findNumbersAround = (idx: number): number[] => {
      const before = lower.slice(Math.max(0, idx - 20), idx);
      const after = lower.slice(idx, idx + 80);
      const matches = (before + " " + after).match(/\d{1,4}(?:\.\d+)?/g);
      if (!matches) return [];
      return uniqNums(matches.map((m) => Number(m)));
    };

    const any = (re: RegExp) => re.test(lower);

    // Parse timeframe
    let timeframe: string | undefined;
    const tfMatch = lower.match(
      /\b(\d{1,3})\s*(m|minute|min|h|hr|hour|d|day|w|wk|week|mth|month)\b/
    );
    if (tfMatch) {
      const num = tfMatch[1];
      const unit = tfMatch[2];
      const normalized =
        unit.startsWith("m") && unit !== "month" && unit !== "mth"
          ? `${num}m`
          : unit.startsWith("h")
          ? `${num}h`
          : unit.startsWith("w")
          ? `${num}W`
          : unit.startsWith("d")
          ? `${num}D`
          : `${num}M`;
      timeframe = isValidTimeframe(normalized) ? normalized : undefined;
    } else if (any(/\bdaily\b|\b1\s*day\b/)) {
      timeframe = "1D";
    } else if (any(/\bweekly\b/)) {
      timeframe = "1W";
    } else if (any(/\bmonthly\b/)) {
      timeframe = "1M";
    }

    // Parse chart type
    let chartType: string | undefined;
    if (any(/\bcandle|candlestick\b/)) chartType = "candle";
    else if (any(/\bline\b/)) chartType = "line";
    else if (any(/\barea\b/)) chartType = "area";
    if (chartType && !isValidChartType(chartType)) chartType = undefined;

    // Parse navigation
    let navigation: "left" | "right" | "zoom-in" | "zoom-out" | undefined;
    if (any(/\b(scroll|pan|move)\s+(left|back|previous)\b|\bback\b/))
      navigation = "left";
    if (any(/\b(scroll|pan|move)\s+(right|forward|next)\b|\bforward\b/))
      navigation = "right";
    if (any(/\bzoom\s*in\b/)) navigation = "zoom-in";
    if (any(/\bzoom\s*out\b/)) navigation = "zoom-out";

    // Parse screenshot request
    const wantsScreenshot = any(
      /screenshot|capture\s*(the\s*)?chart|take\s*a\s*shot/
    );

    // Parse style directives
    const styleDirective: {
      style?: "solid" | "dashed" | "dotted";
      size?: number;
      color?: string;
    } = {};
    if (any(/dashed|dash/)) styleDirective.style = "dashed";
    if (any(/dotted|dot/)) styleDirective.style = "dotted";
    if (any(/solid/)) styleDirective.style = "solid";
    if (any(/thick|thicker|bold/)) styleDirective.size = 3;
    else if (any(/medium/)) styleDirective.size = 2;
    else if (any(/thin|lighter/)) styleDirective.size = 1;

    const colorWords = [
      "blue",
      "green",
      "red",
      "yellow",
      "purple",
      "orange",
      "cyan",
      "pink",
      "gray",
      "grey",
      "black",
      "white",
      "light blue",
      "dark blue",
    ];
    for (const c of colorWords) {
      if (lower.includes(c)) {
        const color = getColorByName(c);
        if (color) styleDirective.color = color;
      }
    }

    // Parse overlay preference
    const explicitOverlay = any(
      /overlay|on\s*(the\s*)?price|on\s*candles|on\s*chart/
    );
    const explicitSeparate = any(
      /separate\s*panel|own\s*panel|below|new\s*pane/
    );

    // Parse add/remove indicators and their params
    type IndicatorIntent = {
      name: string;
      calcParams?: number[];
      overlay?: boolean;
      styles?: any;
      remove?: boolean;
    };
    const intents: IndicatorIntent[] = [];

    // Tokenize by indicator name occurrences
    Object.keys(indicatorMap).forEach((key) => {
      let start = 0;
      while (true) {
        const idx = lower.indexOf(key, start);
        if (idx === -1) break;
        start = idx + key.length;

        const canonical = indicatorMap[key];
        const numbers = findNumbersAround(idx);
        const remove = /remove|delete|clear/.test(
          lower.slice(Math.max(0, idx - 12), idx + key.length + 6)
        );

        // Determine overlay behavior
        let overlay: boolean | undefined;
        if (explicitOverlay) overlay = true;
        else if (explicitSeparate) overlay = false;
        else overlay = overlayCompat.has(canonical);

        // Build styles (one per param or single)
        const meta = getIndicatorByName(canonical);
        const baseParams: number[] | undefined = Array.isArray(
          meta?.defaultParams
        )
          ? (meta!.defaultParams as number[])
          : undefined;
        const calcParams = numbers.length ? numbers : baseParams;
        const lineCount = Array.isArray(calcParams) ? calcParams!.length : 1;
        const lines = Array.from({ length: lineCount }).map(() => ({
          color: styleDirective.color,
          size: styleDirective.size || 1,
          style: (styleDirective.style as any) || "solid",
        }));

        intents.push({
          name: canonical,
          calcParams: calcParams as number[] | undefined,
          overlay,
          styles: { lines },
          remove,
        });
      }
    });

    // Also support generic commands like "set ema 9, 20 and 200"
    const listAfter = (kw: string) => {
      const i = lower.indexOf(kw);
      return i >= 0 ? findNumbersAfter(i + kw.length) : [];
    };
    [
      "ema",
      "sma",
      "ma",
      "macd",
      "rsi",
      "bollinger",
      "bb",
      "kdj",
      "stochastic",
      "obv",
      "wr",
      "vr",
      "cr",
      "dmi",
      "dma",
      "trix",
      "emv",
      "mtm",
      "sar",
      "bbi",
      "vwap",
      "roc",
      "pvt",
      "bias",
      "cci",
      "vol",
    ].forEach((kw) => {
      const i = lower.indexOf(kw);
      if (
        i >= 0 &&
        !intents.find((it) =>
          indicatorMap[kw]
            ? it.name === indicatorMap[kw]
            : it.name === kw.toUpperCase()
        )
      ) {
        const canonical = indicatorMap[kw] || kw.toUpperCase();
        // Look around the keyword so patterns like "200 ema" or "ema 200" both work
        const numbers = (() => {
          const i2 = lower.indexOf(kw);
          return i2 >= 0 ? findNumbersAround(i2) : [];
        })();
        const meta = getIndicatorByName(canonical);
        const calcParams = numbers.length
          ? numbers
          : (meta?.defaultParams as number[] | undefined);
        const lineCount = Array.isArray(calcParams) ? calcParams!.length : 1;
        const lines = Array.from({ length: lineCount }).map(() => ({
          color: styleDirective.color,
          size: styleDirective.size || 1,
          style: (styleDirective.style as any) || "solid",
        }));
        intents.push({
          name: canonical,
          calcParams: calcParams as number[] | undefined,
          overlay: explicitOverlay
            ? true
            : explicitSeparate
            ? false
            : overlayCompat.has(canonical),
          styles: { lines },
        });
      }
    });

    // Decide if user explicitly asked for analysis (opt-in only)
    const runAnalysis =
      /\b(analyze|analysis|what\s*do\s*you\s*see|entry\s*signals?|signals?)\b/.test(
        lower
      );
    const runEntryExit = /\b(entry|exit|targets?)\b/.test(lower);

    // Merge duplicate intents by name and union calc params
    const mergedByName: Record<string, IndicatorIntent> = {};
    intents.forEach((i) => {
      const key = i.name;
      const existing = mergedByName[key];
      if (!existing) {
        mergedByName[key] = {
          ...i,
          calcParams: i.calcParams ? i.calcParams.slice() : undefined,
        };
      } else {
        existing.remove = existing.remove || i.remove;
        if (typeof i.overlay === "boolean") existing.overlay = i.overlay;
        const a = Array.isArray(existing.calcParams)
          ? existing.calcParams.slice()
          : [];
        const b = Array.isArray(i.calcParams) ? i.calcParams : [];
        const set = new Set<number>([...a, ...b].map((n) => Math.floor(n)));
        const merged = Array.from(set.values()).sort((x, y) => x - y);
        existing.calcParams = merged.length ? merged : undefined;
        if (i.styles) existing.styles = i.styles;
      }
    });
    const finalIntents: IndicatorIntent[] = Object.values(mergedByName);

    // Build workflow of only requested actions
    const workflow: WorkflowStep[] = [
      { agent: "chart-context", action: "get-chart-context", params: {} },
    ];

    if (timeframe) {
      workflow.push({
        agent: "chart-control",
        action: "change-timeframe",
        params: { timeframe },
      });
    }
    if (chartType) {
      workflow.push({
        agent: "chart-control",
        action: "change-chart-type",
        params: { chartType },
      });
    }
    if (navigation) {
      workflow.push({
        agent: "chart-control",
        action: "navigate-chart",
        params: { direction: navigation },
      });
    }
    finalIntents.forEach((intent) => {
      if (intent.remove) {
        workflow.push({
          agent: "chart-control",
          action: "remove-indicator",
          params: { indicator: intent.name },
        });
      } else {
        workflow.push({
          agent: "chart-control",
          action: "add-indicator",
          params: {
            indicator: intent.name,
            options: {
              overlay: intent.overlay,
              calcParams: intent.calcParams,
              styles: intent.styles,
            },
          },
        });
      }
    });

    if (wantsScreenshot) {
      workflow.push({
        agent: "chart-control",
        action: "capture-screenshot",
        params: {},
      });
    }

    if (runAnalysis) {
      workflow.push({
        agent: "analysis",
        action: runEntryExit ? "entry-exit-analysis" : "analyze-chart",
        params: {
          symbol: context.symbol,
          indicators: finalIntents.map((i) => i.name),
        },
      });
    }

    const result = await this.executeWorkflow(context, workflow, false);

    const messages: string[] = [];
    if (timeframe) messages.push(`Timeframe set to ${timeframe}`);
    if (chartType) messages.push(`Chart type set to ${chartType}`);
    if (navigation) messages.push(`Navigated ${navigation}`);
    if (finalIntents.length)
      messages.push(
        `Configured ${finalIntents
          .map(
            (i) =>
              i.name +
              (i.calcParams?.length ? `(${i.calcParams.join(",")})` : "")
          )
          .join(", ")}`
      );
    if (wantsScreenshot && (result as any)?.data?.results)
      messages.push("Screenshot captured");
    if (runAnalysis) messages.push("Analysis completed");

    return { ...result, message: messages.join(". ") || result.message };
  }

  private async getAgentStatus(): Promise<AgentResponse> {
    const agents = agentRegistry.getAllAgents();
    const status = agents.map((agent) => ({
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities.map((cap) => cap.name),
      canHandle: agent.capabilities.map((cap) => cap.name),
    }));

    return {
      success: true,
      data: { agents: status, total: agents.length },
      message: `Status of ${agents.length} registered agents`,
    };
  }
}
