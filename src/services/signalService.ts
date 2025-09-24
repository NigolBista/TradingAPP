import { sendSignalPushNotification } from "./notifications";
import { supabase } from "../lib/supabase";

export type OutgoingSignal = {
  symbol: string;
  groupId: string;
  timeframe: string;
  entries: number[];
  exits: number[];
  tps: number[];
  createdAt: number;
  side?: "buy" | "sell";
  confidence?: number | null;
  rationale?: string | null;
  groupName?: string;
  providerName?: string;
};

export async function sendSignal(
  signal: OutgoingSignal
): Promise<{ ok: boolean }> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const providerUserId = session?.user?.id ?? null;
    const providerName =
      signal.providerName ??
      session?.user?.user_metadata?.full_name ??
      session?.user?.email ??
      null;

    const payload = {
      providerUserId,
      providerName,
      groupId: signal.groupId,
      groupName: signal.groupName ?? null,
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      entries: signal.entries,
      exits: signal.exits,
      tps: signal.tps,
      side: signal.side,
      confidence: signal.confidence ?? null,
      rationale: signal.rationale ?? null,
    };

    if (!payload.providerUserId) {
      throw new Error("Missing provider user id");
    }

    const { data, error } = await supabase.functions.invoke("publish-signal", {
      body: payload,
    });

    if (error) {
      throw error;
    }

    notifySubscribers({
      symbol: signal.symbol,
      groupId: signal.groupId,
      timeframe: signal.timeframe,
      entries: signal.entries,
      exits: signal.exits,
      tps: signal.tps,
      createdAt: signal.createdAt,
      groupName: signal.groupName,
      ownerName: payload.providerName ?? undefined,
      side: signal.side,
      confidence: signal.confidence,
      rationale: signal.rationale,
    });

    return { ok: Boolean((data as any)?.ok) };
  } catch (e) {
    console.warn("[signalService] sendSignal failed", e);
    try {
      notifySubscribers({
        symbol: signal.symbol,
        groupId: signal.groupId,
        timeframe: signal.timeframe,
        entries: signal.entries,
        exits: signal.exits,
        tps: signal.tps,
        createdAt: signal.createdAt,
        groupName: signal.groupName,
        ownerName: signal.providerName,
        side: signal.side,
        confidence: signal.confidence,
        rationale: signal.rationale,
      });
    } catch (err) {
      console.warn("[signalService] fallback notify failed", err);
    }
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
