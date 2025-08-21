import { StrategyContext, TradePlanOverlay } from "./types";

/**
 * Simple day-trade logic: prefer tighter moves and closer late entries.
 * This function is PURE: input-only, no side effects.
 */
export function buildDayTradePlan(ctx: StrategyContext): TradePlanOverlay {
  const { currentPrice, recentCloses, momentumPct = 0 } = ctx;
  const biasLong = momentumPct >= 0;

  // Average absolute bar move for last ~20 points
  const N = Math.max(2, Math.min(20, recentCloses.length - 1));
  let sum = 0;
  for (let i = recentCloses.length - N; i < recentCloses.length; i++) {
    const prev = recentCloses[i - 1];
    const cur = recentCloses[i];
    if (Number.isFinite(prev) && Number.isFinite(cur))
      sum += Math.abs(cur - prev);
  }
  const avgAbsMove = N > 0 ? sum / N : currentPrice * 0.004;

  const minSep = currentPrice * 0.0025; // 0.25%
  const delta = Math.max(avgAbsMove * 1.1, minSep);

  if (biasLong) {
    return {
      side: "long",
      entry: Math.max(0, currentPrice - delta),
      lateEntry: Math.max(0, currentPrice - delta * 1.6),
      exit: currentPrice + delta * 1.8,
      lateExit: currentPrice + delta * 2.2,
      stop: Math.max(0, currentPrice - delta * 2.4),
    };
  }
  return {
    side: "short",
    entry: currentPrice + delta,
    lateEntry: currentPrice + delta * 1.6,
    exit: Math.max(0, currentPrice - delta * 1.8),
    lateExit: Math.max(0, currentPrice - delta * 2.2),
    stop: currentPrice + delta * 2.4,
  };
}
