import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TradePlanOverlay } from "../../../logic/types";

export interface CachedSignal {
  symbol: string;
  timestamp: number;
  tradePlan?: TradePlanOverlay;
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
}

interface SignalCacheState {
  signals: Record<string, CachedSignal>; // keyed by symbol

  // Cache a signal for a symbol
  cacheSignal: (signal: CachedSignal) => void;

  // Get cached signal for a symbol
  getCachedSignal: (symbol: string) => CachedSignal | null;

  // Check if signal is fresh (less than 5 minutes old)
  isSignalFresh: (symbol: string) => boolean;

  // Clear cache for a symbol
  clearSignal: (symbol: string) => void;

  // Clear all cached signals
  clearAll: () => void;
}

const SIGNAL_FRESHNESS_DURATION = 5 * 60 * 1000; // 5 minutes

export const useSignalCacheStore = create<SignalCacheState>()(
  persist(
    (set, get) => ({
      signals: {},

      cacheSignal: (signal: CachedSignal) => {
        set((state) => ({
          signals: {
            ...state.signals,
            [signal.symbol]: {
              ...signal,
              timestamp: Date.now(),
            },
          },
        }));
      },

      getCachedSignal: (symbol: string) => {
        const signals = get().signals;
        return signals[symbol] || null;
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
          return { signals: newSignals };
        });
      },

      clearAll: () => {
        set({ signals: {} });
      },
    }),
    {
      name: "signal-cache-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ signals: state.signals }),
    }
  )
);
