import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TradePlanOverlay } from "../logic/types";

export interface CachedSignal {
  symbol: string;
  timestamp: number;
  tradePlan?: TradePlanOverlay & {
    entry?: number;
    stop?: number;
  };
  aiMeta?: {
    strategyChosen?: string;
    side?: "long" | "short";
    confidence?: number;
    why?: string[];
    notes?: string[];
    targets?: number[];
    riskReward?: number;
  };
  analysisContext?: {
    mode: string;
    tradePace: string;
    desiredRR: number;
    contextMode: string;
    isAutoAnalysis: boolean;
    contextLookback?: { mode: "auto" | "fixed"; ms?: number };
  };
  // Raw analysis data for reuse
  rawAnalysisOutput?: any;
  notificationMeta?: {
    groupId?: string;
    groupName?: string | null;
    providerUserId?: string | null;
    providerName?: string | null;
    side?: "buy" | "sell" | null;
    confidence?: number | null;
    rationale?: string | null;
    timeframe?: string | null;
    notifiedAt?: number;
  };
}

export type SignalStatus = "open" | "closed";
export type SignalRecord = CachedSignal & { status?: SignalStatus };

interface SignalCacheState {
  signals: Record<string, SignalRecord>; // keyed by symbol
  signalHistory: SignalRecord[];

  cacheSignal: (
    signal: Omit<CachedSignal, "timestamp"> & { timestamp?: number },
    status?: SignalStatus
  ) => void;
  getCachedSignal: (symbol: string) => SignalRecord | null;
  getSignalsByStatus: (status: SignalStatus) => SignalRecord[];
  isSignalFresh: (symbol: string) => boolean;
  clearSignal: (symbol: string) => void;
  clearAll: () => void;
}

const SIGNAL_FRESHNESS_DURATION = 5 * 60 * 1000; // 5 minutes

export const useSignalCacheStore = create<SignalCacheState>()(
  persist(
    (set, get) => ({
      signals: {},
      signalHistory: [],

      cacheSignal: (
        signal: Omit<CachedSignal, "timestamp"> & { timestamp?: number },
        status: SignalStatus = "open"
      ) => {
        const record: SignalRecord = {
          ...signal,
          status,
          timestamp: signal.timestamp ?? Date.now(),
        };

        set((state) => {
          const nextSignals = {
            ...state.signals,
            [signal.symbol]: record,
          };

          const existingIndex = state.signalHistory.findIndex(
            (item) => item.symbol === signal.symbol
          );
          const nextHistory = [...state.signalHistory];
          if (existingIndex !== -1) {
            nextHistory.splice(existingIndex, 1, record);
          } else {
            nextHistory.unshift(record);
          }

          return {
            signals: nextSignals,
            signalHistory: nextHistory.slice(0, 100),
          };
        });
      },

      getCachedSignal: (symbol: string) => {
        const signals = get().signals;
        return signals[symbol] || null;
      },

      getSignalsByStatus: (status) => {
        const { signalHistory } = get();
        return signalHistory.filter((record) => record.status === status);
      },

      isSignalFresh: (symbol: string) => {
        const signal = get().getCachedSignal(symbol);
        if (!signal) return false;

        const now = Date.now();
        return now - signal.timestamp < SIGNAL_FRESHNESS_DURATION;
      },

      clearSignal: (symbol: string) => {
        set((state) => {
          const newSignals = { ...state.signals };
          delete newSignals[symbol];
          const nextHistory = state.signalHistory.filter(
            (item) => item.symbol !== symbol
          );
          return { signals: newSignals, signalHistory: nextHistory };
        });
      },

      clearAll: () => {
        set({ signals: {}, signalHistory: [] });
      },
    }),
    {
      name: "signal-cache-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        signals: state.signals,
        signalHistory: state.signalHistory,
      }),
    }
  )
);
