export type OutgoingSignal = {
  symbol: string;
  groupId: string;
  timeframe: string;
  entry?: number;
  lateEntry?: number;
  exit?: number;
  lateExit?: number;
  targets?: number[];
  createdAt: number;
};

// Stub: send signal to group subscribers (to be replaced with Supabase/Push)
export async function sendSignal(
  signal: OutgoingSignal
): Promise<{ ok: boolean }> {
  try {
    console.log("[signalService] sendSignal", signal);
    return { ok: true };
  } catch (e) {
    return { ok: false };
  }
}
