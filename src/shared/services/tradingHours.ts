export function getNewYorkTimeParts(now: Date = new Date()): {
  isWeekend: boolean;
  minutes: number; // minutes since midnight NY time
} {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = fmt.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value || "";
    const hourStr = parts.find((p) => p.type === "hour")?.value || "0";
    const minuteStr = parts.find((p) => p.type === "minute")?.value || "0";
    const hour = Math.max(0, Math.min(23, parseInt(hourStr, 10) || 0));
    const minute = Math.max(0, Math.min(59, parseInt(minuteStr, 10) || 0));

    const isWeekend = /Sat|Sun/i.test(weekday);
    return { isWeekend, minutes: hour * 60 + minute };
  } catch {
    // Fallback: assume device timezone is ET (best-effort)
    const local = new Date(now);
    const minutes = local.getHours() * 60 + local.getMinutes();
    const day = local.getDay(); // 0=Sun..6=Sat
    const isWeekend = day === 0 || day === 6;
    return { isWeekend, minutes };
  }
}

// Regular US market hours: 9:30 - 16:00 ET, Mon-Fri (holidays not accounted)
export function isUSRegularMarketOpen(now: Date = new Date()): boolean {
  const { isWeekend, minutes } = getNewYorkTimeParts(now);
  if (isWeekend) return false;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

// After-hours session: 16:00 - 20:00 ET (Mon-Fri)
export function isUSAfterHoursNow(now: Date = new Date()): boolean {
  const { isWeekend, minutes } = getNewYorkTimeParts(now);
  if (isWeekend) return false;
  return minutes >= 16 * 60 && minutes < 20 * 60;
}

// Pre-market session: 04:00 - 09:30 ET (Mon-Fri)
export function isUSPreMarketNow(now: Date = new Date()): boolean {
  const { isWeekend, minutes } = getNewYorkTimeParts(now);
  if (isWeekend) return false;
  return minutes >= 4 * 60 && minutes < 9 * 60 + 30;
}

export function isUSMarketOpen(now: Date = new Date()): boolean {
  return isUSRegularMarketOpen(now);
}
