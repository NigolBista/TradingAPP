import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ExtendedTimeframe } from "../services/marketProviders";

type TimeframeState = {
  pinned: ExtendedTimeframe[];
  defaultTimeframe: ExtendedTimeframe;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  pin: (tf: ExtendedTimeframe) => Promise<void>;
  unpin: (tf: ExtendedTimeframe) => Promise<void>;
  toggle: (tf: ExtendedTimeframe) => Promise<void>;
  setDefaultTimeframe: (tf: ExtendedTimeframe) => Promise<void>;
};

const STORAGE_KEY = "pinned_timeframes_v1";
const DEFAULT_TIMEFRAME_KEY = "default_timeframe_v1";
const DEFAULT_PINNED: ExtendedTimeframe[] = [
  "1M",
  "5m",
  "15m",
  "1h",
  "1D",
  "1W",
];
const INITIAL_DEFAULT_TIMEFRAME: ExtendedTimeframe = "1D";

export const useTimeframeStore = create<TimeframeState>((set, get) => ({
  pinned: DEFAULT_PINNED,
  defaultTimeframe: INITIAL_DEFAULT_TIMEFRAME,
  isHydrated: false,
  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const [pinnedRaw, defaultRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(DEFAULT_TIMEFRAME_KEY),
      ]);

      let pinned = DEFAULT_PINNED;
      let defaultTimeframe = INITIAL_DEFAULT_TIMEFRAME;

      if (pinnedRaw) {
        pinned = JSON.parse(pinnedRaw) as ExtendedTimeframe[];
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PINNED));
      }

      if (defaultRaw) {
        defaultTimeframe = JSON.parse(defaultRaw) as ExtendedTimeframe;
      } else {
        await AsyncStorage.setItem(
          DEFAULT_TIMEFRAME_KEY,
          JSON.stringify(INITIAL_DEFAULT_TIMEFRAME)
        );
      }

      set({ pinned, defaultTimeframe, isHydrated: true });
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
  setDefaultTimeframe: async (tf) => {
    set({ defaultTimeframe: tf });
    await AsyncStorage.setItem(DEFAULT_TIMEFRAME_KEY, JSON.stringify(tf));
  },
}));
