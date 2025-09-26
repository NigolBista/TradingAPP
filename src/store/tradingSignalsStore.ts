import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SignalSummary } from "../services/signalEngine";

const STORAGE_KEY = "trading-signals-store";

export interface StoredSignalScan {
  filterId: string;
  timestamp: number;
  signals: SignalSummary[];
  remainingRuns: number | null;
  usedRuns: number;
}

interface TradingSignalsState {
  lastSelectedFilter: string;
  scans: Record<string, StoredSignalScan>;
  setLastSelectedFilter: (filterId: string) => void;
  saveScan: (filterId: string, scan: StoredSignalScan) => void;
  getScan: (filterId: string) => StoredSignalScan | null;
  clearScans: () => void;
}

const DEFAULT_FILTER = "all";

export const useTradingSignalsStore = create<TradingSignalsState>()(
  persist(
    (set, get) => ({
      lastSelectedFilter: DEFAULT_FILTER,
      scans: {},

      setLastSelectedFilter: (filterId) =>
        set({ lastSelectedFilter: filterId || DEFAULT_FILTER }),

      saveScan: (filterId, scan) =>
        set((state) => ({
          scans: {
            ...state.scans,
            [filterId]: {
              ...scan,
              filterId,
            },
          },
        })),

      getScan: (filterId) => {
        const entry = get().scans[filterId];
        return entry ?? null;
      },

      clearScans: () => set({ scans: {} }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lastSelectedFilter: state.lastSelectedFilter,
        scans: state.scans,
      }),
    }
  )
);
