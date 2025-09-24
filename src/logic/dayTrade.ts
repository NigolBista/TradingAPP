import { StrategyContext, TradePlanOverlay } from "./types";

/**
 * Simple day-trade logic: prefer tighter moves and closer late entries.
 * This function is PURE: input-only, no side effects.
 */
export function buildDayTradePlan(ctx: StrategyContext): TradePlanOverlay {
  const {
    currentPrice,
    recentCloses,
    momentumPct = 0,
    preferredRiskReward,
    riskTolerance,
  } = ctx;
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

  // Map risk tolerance to stop distance multiplier (relative to delta)
  const stopMult =
    riskTolerance === "conservative"
      ? 2.8
      : riskTolerance === "aggressive"
      ? 2.0
      : 2.4;
  const rr =
    typeof preferredRiskReward === "number" && preferredRiskReward > 0
      ? preferredRiskReward
      : 2.0;

  if (biasLong) {
    const primaryEntry = Math.max(0, currentPrice - delta);
    const stopDistance = delta * stopMult;
    const stop = Math.max(0, primaryEntry - stopDistance);
    const targetDistance = stopDistance * rr;
    const exit = primaryEntry + targetDistance;
    const secondaryEntry = Math.max(0, currentPrice - delta * 1.6);
    const extendedStop = exit + targetDistance * 0.2;
    const targets = [
      primaryEntry + stopDistance * 1.0,
      primaryEntry + stopDistance * rr,
    ].filter((v) => Number.isFinite(v));
    return {
      side: "long",
      entries: [primaryEntry, secondaryEntry].filter((v) => Number.isFinite(v)),
      exits: [stop, extendedStop].filter((v) => Number.isFinite(v)),
      tps: targets,
      riskReward: rr,
    };
  }
  const primaryEntry = currentPrice + delta;
  const stopDistance = delta * stopMult;
  const stop = primaryEntry + stopDistance;
  const targetDistance = stopDistance * rr;
  const exit = Math.max(0, primaryEntry - targetDistance);
  const secondaryEntry = currentPrice + delta * 1.6;
  const extendedStop = Math.max(0, exit - targetDistance * 0.2);
  const targets = [
    primaryEntry - stopDistance * 1.0,
    primaryEntry - stopDistance * rr,
  ].filter((v) => Number.isFinite(v));
  return {
    side: "short",
    entries: [primaryEntry, secondaryEntry].filter((v) => Number.isFinite(v)),
    exits: [stop, extendedStop].filter((v) => Number.isFinite(v)),
    tps: targets,
    riskReward: rr,
  };
}
