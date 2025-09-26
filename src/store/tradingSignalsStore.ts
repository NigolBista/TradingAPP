import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SignalSummary } from "../services/signalEngine";

const STORAGE_KEY = "trading-signals-store";

export interface StoredSignalScan {
  filterId: string;
  groupId?: string;
  timestamp: number;
  signals: SignalSummary[];
  remainingRuns: number | null;
  usedRuns: number;
}

interface TradingSignalsState {
  lastSelectedFilter: string;
  scans: Record<string, StoredSignalScan>;
  setLastSelectedFilter: (filterId: string) => void;
  saveScan: (key: string, scan: StoredSignalScan) => void;
  getScan: (key: string) => StoredSignalScan | null;
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

      saveScan: (key, scan) =>
        set((state) => ({
          scans: {
            ...state.scans,
            [key]: {
              ...scan,
              filterId: scan.filterId,
            },
          },
        })),

      getScan: (key) => {
        const entry = get().scans[key];
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
