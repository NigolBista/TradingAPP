import type { UseMarketStatusState } from "../hooks/useMarketStatus";

export type MarketSessionPhase =
  | "pre-market"
  | "regular"
  | "after-hours"
  | "closed";

const MINUTE_MS = 60 * 1000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getApproxServerTimestamp(status?: UseMarketStatusState | null):
  | number
  | null {
  if (!status) return null;

  if (isFiniteNumber(status.serverTimeMs)) {
    return status.serverTimeMs;
  }

  const fromDate = status.serverNow?.getTime();
  if (isFiniteNumber(fromDate)) {
    return fromDate;
  }

  if (isFiniteNumber(status.serverOffsetMs)) {
    return Date.now() + status.serverOffsetMs;
  }

  return null;
}

function getEtDate(timestampMs: number, etOffsetMinutes: number): Date {
  // etOffsetMinutes already represents (ET - UTC) in minutes.
  // Shift the timestamp so that calling getUTC* reflects ET fields.
  const shifted = timestampMs + etOffsetMinutes * MINUTE_MS;
  return new Date(shifted);
}

export function deriveSessionPhase(
  status?: UseMarketStatusState | null
): MarketSessionPhase {
  if (!status) return "closed";

  if (
    status.sessionLabel === "regular" ||
    status.sessionLabel === "after-hours" ||
    status.sessionLabel === "pre-market"
  ) {
    return status.sessionLabel;
  }

  const approximateMs = getApproxServerTimestamp(status);
  if (!isFiniteNumber(approximateMs)) {
    return "closed";
  }

  const offsetMinutes = isFiniteNumber(status.etOffsetMinutes)
    ? status.etOffsetMinutes
    : -300; // Default Eastern offset (EST)

  const etDate = getEtDate(approximateMs, offsetMinutes);
  const weekday = etDate.getUTCDay();
  const isWeekday = weekday !== 0 && weekday !== 6;
  if (!isWeekday) return "closed";

  const minutes = etDate.getUTCHours() * 60 + etDate.getUTCMinutes();

  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) {
    return "pre-market";
  }
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) {
    return "regular";
  }
  if (minutes >= 16 * 60 && minutes < 20 * 60) {
    return "after-hours";
  }

  return "closed";
}

export function isExtendedSession(phase: MarketSessionPhase): boolean {
  return phase === "pre-market" || phase === "after-hours";
}

