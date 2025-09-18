// @ts-nocheck
import { z } from "zod";

// Zod schemas for each tool step
const setTimeframe = z.object({ timeframe: z.string().min(1) });
const setType = z.object({ type: z.enum(["candles", "line", "area"]) });
const navigate = z.object({
  direction: z.enum(["left", "right", "zoom-in", "zoom-out"]),
  bars: z.number().int().positive().optional(),
});

const indicatorsAdd = z.object({
  type: z.string().min(1),
  params: z.object({ calcParams: z.array(z.number()).optional() }).optional(),
  placement: z
    .object({
      pane: z.enum(["price", "new"]).default("new"),
      overlay: z.boolean().optional(),
    })
    .optional(),
  id_hint: z.string().optional(),
  styles: z.record(z.any()).optional(),
});

const indicatorsRemove = z
  .object({ type: z.string().optional(), id: z.string().optional() })
  .refine((v) => !!(v.type || v.id), { message: "Provide type or id" });

const favoritesAddTimeframe = z.object({ timeframe: z.string().min(1) });
const favoritesAddType = z.object({
  type: z.enum(["candles", "line", "area"]),
});

const presetSave = z.object({ name: z.string().min(1) });
const presetLoad = z.object({ name: z.string().min(1) });

const drawAdd = z.object({
  tool: z.string().min(1),
  points: z.array(z.any()).default([]),
  style: z.record(z.any()).optional(),
  text: z.string().optional(),
});
const drawRemove = z.object({ id: z.string().min(1) });

const stateVerify = z.object({
  timeframe: z.string().optional(),
  chart_type: z.string().optional(),
  indicators: z.array(z.object({ type: z.string() })).optional(),
});

const historyUndo = z.object({ steps: z.number().int().positive().default(1) });
const historyRedo = z.object({ steps: z.number().int().positive().default(1) });

export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny> = {
  "chart.control.set_timeframe": setTimeframe,
  "chart.control.set_type": setType,
  "chart.control.navigate": navigate,
  "indicators.add": indicatorsAdd,
  "indicators.remove": indicatorsRemove,
  "favorites.add_timeframe": favoritesAddTimeframe,
  "favorites.add_type": favoritesAddType,
  "presets.save": presetSave,
  "presets.load": presetLoad,
  "draw.add": drawAdd,
  "draw.remove": drawRemove,
  "state.verify": stateVerify,
  "history.undo": historyUndo,
  "history.redo": historyRedo,
};

export function validateToolStep(
  tool: string,
  args: any
): { ok: boolean; error?: string; parsed?: any } {
  const schema = TOOL_SCHEMAS[tool];
  if (!schema) return { ok: true, parsed: args };
  const res = schema.safeParse(args);
  if (res.success) return { ok: true, parsed: res.data };
  return {
    ok: false,
    error: res.error.issues.map((i) => i.message).join("; "),
  };
}
