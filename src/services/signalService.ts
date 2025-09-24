import { sendSignalPushNotification } from "./notifications";

export type OutgoingSignal = {
  symbol: string;
  groupId: string;
  timeframe: string;
  entries: number[];
  exits: number[];
  tps: number[];
  createdAt: number;
};

// Stub: send signal to group subscribers (to be replaced with Supabase/Push)
export async function sendSignal(
  signal: OutgoingSignal
): Promise<{ ok: boolean }> {
  try {
    console.log("[signalService] sendSignal", signal);
    notifySubscribers({ ...signal });
    return { ok: true };
  } catch (e) {
    return { ok: false };
  }
}

export type SignalPayload = OutgoingSignal & {
  groupName?: string;
  ownerName?: string;
};

type SignalListener = (signal: SignalPayload) => void;
type SignalListeners = SignalListener[];

let listeners: SignalListeners = [];

export function subscribeToSignals(listener: SignalListener) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function notifySubscribers(signal: SignalPayload) {
  [...listeners].forEach((listener) => {
    try {
      listener(signal);
    } catch (e) {
      console.warn("[signalService] listener error", e);
    }
  });
  try {
    void sendSignalPushNotification(signal);
  } catch (error) {
    console.warn("[signalService] push notify error", error);
  }
}
