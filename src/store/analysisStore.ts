import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MarketScanner,
  ScanFilter,
  ScanResult,
  MarketScreenerData,
} from "../services/marketScanner";
import {
  runManagedScan,
  getAnalysisQuotaSummary,
  AnalysisRunResponse,
  SubscriptionTier,
} from "../services/analysisManager";

type ViewType = "favorites" | "all" | "custom";

export interface ScreenerCacheEntry {
  key: string;
  timestamp: number;
  results: ScanResult[];
  screener?: MarketScreenerData;
  fromCache: boolean;
  remainingRuns: number | null;
  usedRuns: number;
  plan: SubscriptionTier;
}

interface ScreenerState {
  data: MarketScreenerData | null;
  results: ScanResult[];
  loading: boolean;
  lastUpdated: number | null;
  error: string | null;
  runsUsedToday: number;
  remainingRunsToday: number | null;
  plan: SubscriptionTier;
  viewType: ViewType;
  cachedEntries: Record<string, ScreenerCacheEntry>;
  availableSymbols: string[];
  lastSymbols: string[];
  fromCache: boolean;
  currentCacheKey: string | null;
  setViewType: (view: ViewType) => void;
  setAvailableSymbols: (symbols: string[]) => void;
  loadInitialQuota: () => Promise<void>;
  loadMarketAnalysis: (params?: {
    filters?: ScanFilter;
    scope?: ViewType;
    force?: boolean;
    symbols?: string[];
    cacheKey?: string;
  }) => Promise<void>;
  useCachedScreener: (key: string) => void;
  clearCache: () => void;
}

const DEFAULT_SCREENNER_DATA: MarketScreenerData = {
  topGainers: [],
  topLosers: [],
  highVolume: [],
  breakouts: [],
  oversold: [],
  overbought: [],
  signalAlerts: [],
};

const DEFAULT_STATE = {
  data: null,
  results: [],
  loading: false,
  lastUpdated: null,
  error: null,
  runsUsedToday: 0,
  remainingRunsToday: null,
  plan: "Free" as SubscriptionTier,
  viewType: "favorites" as ViewType,
  cachedEntries: {} as Record<string, ScreenerCacheEntry>,
  availableSymbols: [] as string[],
  lastSymbols: [] as string[],
  fromCache: false,
  currentCacheKey: null as string | null,
};

export const useAnalysisStore = create<ScreenerState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setViewType: (view) => set({ viewType: view }),

      setAvailableSymbols: (symbols) => {
        const normalized = Array.from(
          new Set(symbols.map((s) => s.toUpperCase()))
        );
        set({ availableSymbols: normalized, lastSymbols: normalized });
      },

      loadInitialQuota: async () => {
        try {
          const summary = await getAnalysisQuotaSummary();
          set({
            runsUsedToday: summary.runsUsed,
            remainingRunsToday: summary.remainingRuns,
            plan: summary.plan,
          });
        } catch (error) {
          console.error("Failed to load analysis quota", error);
        }
      },

      loadMarketAnalysis: async (params) => {
        const state = get();
        if (state.loading) return;

        set({ loading: true, error: null });

        try {
          const scope = params?.scope ?? state.viewType;
          const response: AnalysisRunResponse = await runManagedScan({
            filters: params?.filters,
            scope,
            force: params?.force,
            symbols: params?.symbols,
            cacheKey: params?.cacheKey,
            screener: true,
          });

          const key =
            params?.cacheKey ??
            `${scope}|${JSON.stringify(params?.filters || {})}`;

          const screenerData =
            response.screener ||
            MarketScanner.buildScreenerData(response.results);
          const symbols = Array.from(
            new Set(response.results.map((r) => r.symbol.toUpperCase()))
          );

          const entry: ScreenerCacheEntry = {
            key,
            timestamp: response.cacheTimestamp,
            results: response.results,
            screener: screenerData,
            fromCache: response.fromCache,
            remainingRuns: response.remainingRuns,
            usedRuns: response.usedRuns,
            plan: state.plan,
          };

          set((current) => ({
            data: screenerData,
            results: response.results,
            loading: false,
            lastUpdated: response.cacheTimestamp,
            runsUsedToday: response.usedRuns,
            remainingRunsToday: response.remainingRuns,
            cachedEntries: {
              ...current.cachedEntries,
              [key]: entry,
            },
            plan: current.plan,
            fromCache: response.fromCache,
            currentCacheKey: key,
            lastSymbols: symbols,
            availableSymbols: symbols,
          }));
        } catch (error: any) {
          console.error("Failed to load managed analysis", error);

          let message = "Failed to analyze market";
          if (error?.code === "ANALYSIS_QUOTA_EXCEEDED") {
            message =
              "Daily analysis limit reached. Upgrade to unlock more runs.";
          } else if (error?.code === "ANALYSIS_NO_SYMBOLS") {
            message = "Add stocks to your watchlist to run analysis.";
          }

          set({
            error: message,
            loading: false,
          });
        }
      },

      useCachedScreener: (key) => {
        const entry = get().cachedEntries[key];
        if (!entry) return;

        set({
          data: entry.screener ?? DEFAULT_SCREENNER_DATA,
          results: entry.results,
          lastUpdated: entry.timestamp,
          error: null,
          loading: false,
          runsUsedToday: entry.usedRuns,
          remainingRunsToday: entry.remainingRuns,
          fromCache: true,
          currentCacheKey: key,
          lastSymbols: Array.from(
            new Set(entry.results.map((r) => r.symbol.toUpperCase()))
          ),
        });
      },

      clearCache: () => set({ cachedEntries: {}, currentCacheKey: null }),
    }),
    {
      name: "analysis-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        cachedEntries: state.cachedEntries,
        viewType: state.viewType,
        plan: state.plan,
        runsUsedToday: state.runsUsedToday,
        remainingRunsToday: state.remainingRunsToday,
        lastUpdated: state.lastUpdated,
        currentCacheKey: state.currentCacheKey,
        lastSymbols: state.lastSymbols,
      }),
    }
  )
);
