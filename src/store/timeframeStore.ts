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
  toggle: (tf: ExtendedTimeframe) => Promise<boolean>;
  setDefaultTimeframe: (tf: ExtendedTimeframe) => Promise<void>;
};

const STORAGE_KEY = "pinned_timeframes_v1";
const DEFAULT_TIMEFRAME_KEY = "default_timeframe_v1";
const MAX_PINNED = 10;
const DEFAULT_PINNED: ExtendedTimeframe[] = [
  "1m",
  "5m",
  "15m",
  "1h",
  "1D",
  "1W",
];
const INITIAL_DEFAULT_TIMEFRAME: ExtendedTimeframe = "1D";

// Order timeframes from smallest to largest
const TIMEFRAME_ORDER: ExtendedTimeframe[] = [
  "1m",
  "2m",
  "3m",
  "5m",
  "10m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "1D",
  "1W",
  "1M",
  "3M",
  "1Y",
  "5Y",
  "ALL",
];

function sortTimeframes(timeframes: ExtendedTimeframe[]): ExtendedTimeframe[] {
  return timeframes.sort((a, b) => {
    const aIndex = TIMEFRAME_ORDER.indexOf(a);
    const bIndex = TIMEFRAME_ORDER.indexOf(b);
    return aIndex - bIndex;
  });
}

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

      let pinned: ExtendedTimeframe[] = DEFAULT_PINNED;
      let defaultTimeframe: ExtendedTimeframe = INITIAL_DEFAULT_TIMEFRAME;

      if (pinnedRaw) {
        pinned = sortTimeframes(JSON.parse(pinnedRaw) as ExtendedTimeframe[]);
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
    if (current.length >= MAX_PINNED) return;
    const next = sortTimeframes([...current, tf]);
    set({ pinned: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
  unpin: async (tf) => {
    const current = get().pinned;
    const next = sortTimeframes(current.filter((t) => t !== tf));
    set({ pinned: next });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
  toggle: async (tf) => {
    const { pinned } = get();
    if (pinned.includes(tf)) {
      await get().unpin(tf);
      return true;
    } else {
      if (pinned.length >= MAX_PINNED) return false;
      await get().pin(tf);
      return true;
    }
  },
  setDefaultTimeframe: async (tf) => {
    set({ defaultTimeframe: tf });
    await AsyncStorage.setItem(DEFAULT_TIMEFRAME_KEY, JSON.stringify(tf));
  },
}));
