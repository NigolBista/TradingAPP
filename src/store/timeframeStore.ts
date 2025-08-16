import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ExtendedTimeframe } from "../services/marketProviders";

type TimeframeState = {
  pinned: ExtendedTimeframe[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  pin: (tf: ExtendedTimeframe) => Promise<void>;
  unpin: (tf: ExtendedTimeframe) => Promise<void>;
  toggle: (tf: ExtendedTimeframe) => Promise<void>;
};

const STORAGE_KEY = "pinned_timeframes_v1";
const DEFAULT_PINNED: ExtendedTimeframe[] = [
  "1m",
  "5m",
  "15m",
  "1h",
  "1D",
  "1W",
];

export const useTimeframeStore = create<TimeframeState>((set, get) => ({
  pinned: DEFAULT_PINNED,
  isHydrated: false,
  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as ExtendedTimeframe[];
        set({ pinned: arr, isHydrated: true });
      } else {
        set({ pinned: DEFAULT_PINNED, isHydrated: true });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PINNED));
      }
    } catch {
      set({ isHydrated: true });
    }
  },
  pin: async (tf) => {
    const current = get().pinned;
    if (current.includes(tf)) return;
    const next = [...current, tf];
    set({ pinned: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
  unpin: async (tf) => {
    const current = get().pinned;
    const next = current.filter((t) => t !== tf);
    set({ pinned: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
  toggle: async (tf) => {
    const { pinned } = get();
    if (pinned.includes(tf)) {
      await get().unpin(tf);
    } else {
      await get().pin(tf);
    }
  },
}));
