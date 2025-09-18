import {
  Agent,
  AgentContext,
  AgentResponse,
  AgentCapability,
  ActionEnvelope,
} from "./types";
import { z } from "zod";
import {
  generateChartContextConfig,
  getIndicatorByName,
} from "../logic/chartContextConfig";

const planSchema = z.object({
  version: z.string().default("1.0"),
  session_id: z.string().optional(),
  plan_id: z.string().optional(),
  steps: z
    .array(
      z.object({
        tool: z.string(),
        args: z.record(z.string(), z.any()),
      })
    )
    .default([]),
});

export class RouterAgent implements Agent {
  name = "router";
  description =
    "Classifies user intents and emits a minimal action plan for the chart.";

  capabilities: AgentCapability[] = [
    {
      name: "route",
      description: "Parse user text into a compact ActionEnvelope plan",
      parameters: {
        text: { type: "string" },
      },
    },
  ];

  canHandle(action: string): boolean {
    return action === "route";
  }

  getRequiredContext(): string[] {
    return ["symbol"];
  }

  async execute(
    context: AgentContext,
    action: string,
    params?: any
  ): Promise<AgentResponse> {
    if (action !== "route") {
      return { success: false, error: `Unknown action: ${action}` };
    }
    const text: string = String(params?.text || "").toLowerCase();
    const ctx = generateChartContextConfig();
    const steps: ActionEnvelope["steps"] = [];

    // Timeframe
    const tfMatch = text.match(
      /\b(\d{1,3})\s*(m|minute|min|h|hr|hour|d|day|w|wk|week|mth|month)\b/
    );
    if (tfMatch) {
      const n = tfMatch[1];
      const u = tfMatch[2];
      const normalized =
        u.startsWith("m") && u !== "month" && u !== "mth"
          ? `${n}m`
          : u.startsWith("h")
          ? `${n}h`
          : u.startsWith("w")
          ? `${n}W`
          : u.startsWith("d")
          ? `${n}D`
          : `${n}M`;
      steps.push({
        tool: "chart.control.set_timeframe",
        args: { timeframe: normalized },
      });
    }

    // Chart type
    if (/(candle|candlestick)/.test(text))
      steps.push({ tool: "chart.control.set_type", args: { type: "candles" } });
    else if (/\bline\b/.test(text))
      steps.push({ tool: "chart.control.set_type", args: { type: "line" } });
    else if (/\barea\b/.test(text))
      steps.push({ tool: "chart.control.set_type", args: { type: "area" } });

    // Indicators
    const aliasToName: Record<string, string> = {};
    ctx.availableIndicators.forEach((ind: any) => {
      aliasToName[ind.name.toLowerCase()] = ind.name;
    });
    aliasToName["bollinger"] = "BOLL";
    aliasToName["bb"] = "BOLL";
    aliasToName["stochastic"] = "KDJ";
    aliasToName["ema"] = "EMA";
    aliasToName["sma"] = "SMA";
    aliasToName["ma"] = "MA";

    const addIndicator = (
      canonical: string,
      numbers: number[],
      overlay?: boolean
    ) => {
      const meta = getIndicatorByName(canonical);
      const calcParams = numbers.length
        ? numbers
        : (meta?.defaultParams as number[] | undefined);
      steps.push({
        tool: "indicators.add",
        args: {
          type: canonical,
          params: { calcParams },
          placement: { pane: overlay ? "price" : "new", overlay: !!overlay },
          id_hint: `${canonical.toLowerCase()}_${(calcParams || []).join("_")}`,
        },
      });
    };

    const findNums = (aroundIndex: number) => {
      const s = text.slice(Math.max(0, aroundIndex - 24), aroundIndex + 64);
      const m = s.match(/\d{1,4}(?:\.\d+)?/g) || [];
      return Array.from(new Set(m.map((x) => Math.floor(Number(x))))).filter(
        (x) => Number.isFinite(x) && x > 0
      );
    };

    Object.keys(aliasToName).forEach((alias) => {
      let pos = 0;
      while (true) {
        const idx = text.indexOf(alias, pos);
        if (idx === -1) break;
        pos = idx + alias.length;
        const canonical = aliasToName[alias];
        const nums = findNums(idx);
        const overlay = /overlay|on\s*(price|candle|chart)/.test(text);
        addIndicator(canonical, nums, overlay);
      }
    });

    // Navigation
    if (/\bpan\s+left\b|\bmove\s+left\b|\bback\b/.test(text)) {
      steps.push({
        tool: "chart.control.navigate",
        args: { direction: "left" },
      });
    } else if (/\bpan\s+right\b|\bmove\s+right\b|\bforward\b/.test(text)) {
      steps.push({
        tool: "chart.control.navigate",
        args: { direction: "right" },
      });
    }
    if (/\bzoom\s*in\b/.test(text))
      steps.push({
        tool: "chart.control.navigate",
        args: { direction: "zoom-in" },
      });
    if (/\bzoom\s*out\b/.test(text))
      steps.push({
        tool: "chart.control.navigate",
        args: { direction: "zoom-out" },
      });

    // Presets
    const savePresetMatch = text.match(
      /save\s+(layout|preset)\s+as\s+([a-z0-9_\- ]{2,40})/
    );
    if (savePresetMatch)
      steps.push({
        tool: "presets.save",
        args: { name: savePresetMatch[2].trim() },
      });
    const loadPresetMatch = text.match(
      /(load|apply)\s+(layout|preset)\s+([a-z0-9_\- ]{2,40})/
    );
    if (loadPresetMatch)
      steps.push({
        tool: "presets.load",
        args: { name: loadPresetMatch[3].trim() },
      });

    // Favorites
    const favTf = text.match(
      /add\s+(\d{1,3}\s*(m|min|h|d|w|mth))\s+to\s+favorites/
    );
    if (favTf)
      steps.push({
        tool: "favorites.add_timeframe",
        args: { timeframe: favTf[1].replace(/\s+/g, "") },
      });
    if (/add\s+candles\s+to\s+favorites/.test(text))
      steps.push({ tool: "favorites.add_type", args: { type: "candles" } });
    if (/add\s+line\s+to\s+favorites/.test(text))
      steps.push({ tool: "favorites.add_type", args: { type: "line" } });
    if (/add\s+area\s+to\s+favorites/.test(text))
      steps.push({ tool: "favorites.add_type", args: { type: "area" } });

    // Drawings (simple)
    const trendMatch = text.match(/add\s+(a\s+)?trend(line)?/);
    if (trendMatch)
      steps.push({
        tool: "draw.add",
        args: { tool: "trendline", points: [], style: {} },
      });
    const labelMatch = text.match(/label\s+at\s+(\d+(?:\.\d+)?)/);
    if (labelMatch)
      steps.push({
        tool: "draw.add",
        args: {
          tool: "label",
          points: [{ value: Number(labelMatch[1]) }],
          text: "Label",
        },
      });

    const plan = planSchema.parse({
      version: "1.0",
      session_id: context.sessionId,
      steps,
    });
    return { success: true, data: plan, message: "Plan created" };
  }
}
