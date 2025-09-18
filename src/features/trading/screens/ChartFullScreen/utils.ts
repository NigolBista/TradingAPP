import type { Candle } from "../../shared/services/marketProviders";

export function timeframeSpacingMs(tf: string): number {
  switch (tf) {
    case "1m":
      return 60_000;
    case "2m":
      return 120_000;
    case "3m":
      return 180_000;
    case "5m":
      return 300_000;
    case "10m":
      return 600_000;
    case "15m":
      return 900_000;
    case "30m":
      return 1_800_000;
    case "1h":
      return 3_600_000;
    case "2h":
      return 7_200_000;
    case "4h":
      return 14_400_000;
    case "1D":
      return 86_400_000;
    case "1W":
      return 7 * 86_400_000;
    case "1M":
    case "3M":
    case "1Y":
    case "5Y":
    case "ALL":
      return 30 * 86_400_000;
    default:
      return 60_000;
  }
}

export function formatPrice(n?: number): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "-";
  return `$${n.toFixed(2)}`;
}

export function formatVolume(n?: number): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "-";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return String(n);
}

export type { Candle };


