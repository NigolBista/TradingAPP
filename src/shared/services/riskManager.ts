export interface PositionSizingParams {
  accountSize: number; // total account equity
  riskPerTradePct: number; // e.g. 1 for 1%
  entry: number;
  stop: number;
}

export interface PositionSizingResult {
  maxRiskAmount: number; // in currency
  riskPerShare: number; // entry - stop (abs)
  positionSize: number; // number of shares
  riskRewardRatioToT1: number;
}

export function calculatePositionSize(
  params: PositionSizingParams,
  firstTarget?: number
): PositionSizingResult {
  const { accountSize, riskPerTradePct, entry, stop } = params;
  const maxRiskAmount = (accountSize * riskPerTradePct) / 100;
  const riskPerShare = Math.max(0.01, Math.abs(entry - stop));
  const positionSize = Math.floor(maxRiskAmount / riskPerShare);
  const t1 = firstTarget ?? entry + riskPerShare * 2;
  const rr = Math.max(0.01, Math.abs(t1 - entry)) / riskPerShare;
  return { maxRiskAmount, riskPerShare, positionSize, riskRewardRatioToT1: rr };
}

export interface TradePlan {
  entry: number;
  stop: number;
  targets: number[];
  positionSize: number;
  notes: string[];
}

export function buildTradePlan(
  entry: number,
  stop: number,
  targets: number[],
  accountSize: number,
  riskPerTradePct: number
): TradePlan {
  const sizing = calculatePositionSize(
    { accountSize, riskPerTradePct, entry, stop },
    targets[0]
  );
  const notes: string[] = [];
  if (sizing.riskRewardRatioToT1 < 1.5) {
    notes.push(
      "Risk/reward to first target is below 1.5:1; consider better entry or tighter stop."
    );
  }
  if (sizing.positionSize <= 0) {
    notes.push(
      "Position size is 0 due to tight risk; increase risk budget or adjust stop."
    );
  }
  return {
    entry,
    stop,
    targets,
    positionSize: sizing.positionSize,
    notes,
  };
}
