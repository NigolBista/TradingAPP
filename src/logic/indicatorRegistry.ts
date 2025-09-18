// Runtime indicator registry: defaults, aliases, validation helpers
import { BUILTIN_INDICATORS } from "../screens/ChartFullScreen/indicators";

export type IndicatorParamSpec = {
  type: "int" | "number" | "enum";
  min?: number;
  max?: number;
  values?: string[];
  default?: number | string;
};
export type IndicatorDef = {
  name: string;
  aliases: string[];
  params: Record<string, IndicatorParamSpec>;
  price_overlay: boolean;
  separate_pane: boolean;
};

// Seed from BUILTIN_INDICATORS with simple param specs
const base: Record<string, IndicatorDef> = {};
BUILTIN_INDICATORS.forEach((ind) => {
  const paramSpec: Record<string, IndicatorParamSpec> = {};
  const defaults = Array.isArray(ind.defaultParams) ? ind.defaultParams : [];
  if (defaults.length === 1) {
    paramSpec["length"] = {
      type: "int",
      min: 1,
      max: 10000,
      default: defaults[0],
    };
  } else if (defaults.length > 1) {
    // Map to calcParams[] via helper; registry exposes simple lengthN labels
    defaults.forEach((v, i) => {
      paramSpec[`p${i + 1}`] = { type: "int", min: 1, max: 10000, default: v };
    });
  }
  base[ind.name] = {
    name: ind.name,
    aliases: [ind.title.toLowerCase(), ind.name.toLowerCase()],
    params: paramSpec,
    price_overlay: !!ind.compatOverlay,
    separate_pane: !ind.compatOverlay,
  };
});

// Manual enrichments and common aliases
function addAliases(name: string, aliases: string[]) {
  if (!base[name]) return;
  base[name].aliases = Array.from(
    new Set([
      ...(base[name].aliases || []),
      ...aliases.map((a) => a.toLowerCase()),
    ])
  );
}

addAliases("BOLL", ["bollinger", "bb", "bollinger bands"]);
addAliases("KDJ", ["stochastic", "stoch"]);
addAliases("EMA", ["exp ma", "exponential moving average", "ema"]);
addAliases("SMA", ["simple moving average"]);
addAliases("MA", ["moving average"]);

export function getIndicatorByAlias(alias: string): IndicatorDef | undefined {
  const low = alias.toLowerCase();
  return Object.values(base).find(
    (d) => d.name.toLowerCase() === low || (d.aliases || []).includes(low)
  );
}

export function listIndicators(): IndicatorDef[] {
  return Object.values(base);
}

export function validateParams(
  def: IndicatorDef,
  calcParams?: number[]
): { ok: boolean; errors?: string[] } {
  if (!calcParams || !calcParams.length) return { ok: true };
  const errs: string[] = [];
  calcParams.forEach((v, i) => {
    const spec = def.params[`p${i + 1}`] || def.params["length"];
    if (!spec) return;
    if (
      spec.type === "int" &&
      (!Number.isInteger(v) ||
        (spec.min && v < spec.min) ||
        (spec.max && v > spec.max))
    ) {
      errs.push(`param${i + 1} out of range`);
    }
  });
  return { ok: errs.length === 0, errors: errs.length ? errs : undefined };
}
