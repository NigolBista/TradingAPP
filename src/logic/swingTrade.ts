import { StrategyContext, TradePlanOverlay } from "./types";

/**
 * Swing-trade logic: allow wider distances and more generous targets/stops.
 * This function is PURE: input-only, no side effects.
 */
export function buildSwingTradePlan(ctx: StrategyContext): TradePlanOverlay {
  const { currentPrice, recentCloses, momentumPct = 0 } = ctx;
  const biasLong = momentumPct >= 0;

  const N = Math.max(2, Math.min(50, recentCloses.length - 1));
  let sum = 0;
  for (let i = recentCloses.length - N; i < recentCloses.length; i++) {
    const prev = recentCloses[i - 1];
    const cur = recentCloses[i];
    if (Number.isFinite(prev) && Number.isFinite(cur))
      sum += Math.abs(cur - prev);
  }
  const avgAbsMove = N > 0 ? sum / N : currentPrice * 0.006;

  const minSep = currentPrice * 0.006; // 0.6%
  const delta = Math.max(avgAbsMove * 1.6, minSep);

  if (biasLong) {
    return {
      side: "long",
      entry: Math.max(0, currentPrice - delta),
      lateEntry: Math.max(0, currentPrice - delta * 1.8),
      exit: currentPrice + delta * 2.2,
      lateExit: currentPrice + delta * 3.0,
      stop: Math.max(0, currentPrice - delta * 2.8),
    };
  }
  return {
    side: "short",
    entry: currentPrice + delta,
    lateEntry: currentPrice + delta * 1.8,
    exit: Math.max(0, currentPrice - delta * 2.2),
    lateExit: Math.max(0, currentPrice - delta * 3.0),
    stop: currentPrice + delta * 2.8,
  };
}
