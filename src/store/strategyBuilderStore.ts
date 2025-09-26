import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid/non-secure";
import {
  IndicatorConfigSpec,
  StrategyConfig,
  StrategyTimeframe,
  TradeMode,
} from "../types/strategy";

export const DAY_TIMEFRAMES = ["5m", "15m"] as const;
export const SWING_TIMEFRAMES = ["30m", "1h", "4h"] as const;

export type GroupWatchlist = {
  id: string;
  name: string;
  symbols: string[];
  updatedAt: number;
};

const STORAGE_KEY = "group-strategy-store";

export function buildDefaultIndicators(mode: TradeMode): IndicatorConfigSpec[] {
  return [
    {
      type: "ema",
      label: "Fast EMA",
      params: { window: mode === "day" ? 9 : 12 },
    },
    {
      type: "ema",
      label: "Slow EMA",
      params: { window: mode === "day" ? 21 : 26 },
    },
    {
      type: "rsi",
      label: "RSI",
      params: { window: 14 },
    },
    {
      type: "macd",
      label: "MACD",
      params: { short_window: 12, long_window: 26, signal_window: 9 },
    },
    {
      type: "sma",
      label: "SMA",
      params: { window: mode === "day" ? 20 : 50 },
    },
  ];
}

function buildDefaultTimeframes(mode: TradeMode): StrategyConfig["timeframes"] {
  const frames =
    mode === "day"
      ? (DAY_TIMEFRAMES as readonly StrategyTimeframe[])
      : (SWING_TIMEFRAMES as readonly StrategyTimeframe[]);
  return frames.map((timeframe) => ({
    timeframe,
    indicators: buildDefaultIndicators(mode).map((indicator) => ({
      ...indicator,
      params: { ...indicator.params },
    })),
  }));
}

function createDefaultStrategy(
  groupId: string,
  mode: TradeMode,
  groupName?: string
): StrategyConfig {
  const now = Date.now();
  const name = groupName
    ? `${groupName} ${mode === "day" ? "Day" : "Swing"} Strategy`
    : mode === "day"
    ? "Day Trade Strategy"
    : "Swing Trade Strategy";
  return {
    id: groupId,
    name,
    description:
      mode === "day"
        ? "Base intraday strategy template"
        : "Base swing strategy template",
    tradeMode: mode,
    timeframes: buildDefaultTimeframes(mode),
    createdAt: now,
    updatedAt: now,
  };
}

interface GroupStrategyState {
  strategies: Record<string, StrategyConfig>;
  watchlists: Record<string, GroupWatchlist>;
  ensureGroupDefaults: (
    groupId: string,
    opts?: { tradeMode?: TradeMode; groupName?: string }
  ) => { strategy: StrategyConfig; watchlist: GroupWatchlist };
  updateStrategy: (groupId: string, strategy: StrategyConfig) => void;
  addWatchlistSymbol: (groupId: string, symbol: string) => void;
  removeWatchlistSymbol: (groupId: string, symbol: string) => void;
  renameWatchlist: (groupId: string, name: string) => void;
  isSymbolTracked: (groupId: string, symbol: string) => boolean;
  getStrategy: (groupId: string) => StrategyConfig | undefined;
  getWatchlist: (groupId: string) => GroupWatchlist | undefined;
}

export const useStrategyBuilderStore = create<GroupStrategyState>()(
  persist(
    (set, get) => ({
      strategies: {},
      watchlists: {},
      ensureGroupDefaults: (groupId, opts) => {
        const state = get();
        let strategy = state.strategies[groupId];
        let watchlist = state.watchlists[groupId];
        const existingMode = strategy?.tradeMode;
        const tradeMode = opts?.tradeMode ?? existingMode ?? "day";

        if (!strategy) {
          strategy = createDefaultStrategy(groupId, tradeMode, opts?.groupName);
          set((prev) => ({
            strategies: { ...prev.strategies, [groupId]: strategy! },
          }));
        }

        if (!watchlist) {
          const name = opts?.groupName
            ? `${opts.groupName} Watchlist`
            : "Group Watchlist";
          watchlist = {
            id: `group_watchlist_${groupId}`,
            name,
            symbols: [],
            updatedAt: Date.now(),
          };
          set((prev) => ({
            watchlists: { ...prev.watchlists, [groupId]: watchlist! },
          }));
        }

        return {
          strategy: strategy!,
          watchlist: watchlist!,
        };
      },
      updateStrategy: (groupId, strategy) => {
        set((prev) => ({
          strategies: {
            ...prev.strategies,
            [groupId]: {
              ...strategy,
              id: groupId,
              updatedAt: Date.now(),
            },
          },
        }));
      },
      addWatchlistSymbol: (groupId, symbol) => {
        const normalized = symbol.trim().toUpperCase();
        if (!normalized) return;
        set((prev) => {
          const current =
            prev.watchlists[groupId] ??
            ({
              id: `group_watchlist_${groupId}`,
              name: "Group Watchlist",
              symbols: [],
              updatedAt: Date.now(),
            } as GroupWatchlist);
          if (current.symbols.includes(normalized)) return prev;
          const updated: GroupWatchlist = {
            ...current,
            symbols: [...current.symbols, normalized],
            updatedAt: Date.now(),
          };
          return {
            ...prev,
            watchlists: { ...prev.watchlists, [groupId]: updated },
          };
        });
      },
      removeWatchlistSymbol: (groupId, symbol) => {
        set((prev) => {
          const current = prev.watchlists[groupId];
          if (!current) return prev;
          const nextSymbols = current.symbols.filter((s) => s !== symbol);
          const updated: GroupWatchlist = {
            ...current,
            symbols: nextSymbols,
            updatedAt: Date.now(),
          };
          return {
            ...prev,
            watchlists: { ...prev.watchlists, [groupId]: updated },
          };
        });
      },
      renameWatchlist: (groupId, name) => {
        set((prev) => {
          const current = prev.watchlists[groupId];
          if (!current) return prev;
          const updated: GroupWatchlist = {
            ...current,
            name,
            updatedAt: Date.now(),
          };
          return {
            ...prev,
            watchlists: { ...prev.watchlists, [groupId]: updated },
          };
        });
      },
      isSymbolTracked: (groupId, symbol) => {
        const watchlist = get().watchlists[groupId];
        if (!watchlist) return false;
        const normalized = symbol.trim().toUpperCase();
        return watchlist.symbols.includes(normalized);
      },
      getStrategy: (groupId) => get().strategies[groupId],
      getWatchlist: (groupId) => get().watchlists[groupId],
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: any, version) => {
        if (!persistedState || version < 2) {
          return {
            strategies: {},
            watchlists: {},
          } as GroupStrategyState;
        }
        return persistedState as GroupStrategyState;
      },
      partialize: (state) => ({
        strategies: state.strategies,
        watchlists: state.watchlists,
      }),
    }
  )
);
