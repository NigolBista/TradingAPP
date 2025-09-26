import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MarketScanner,
  ScanFilter,
  ScanOptions,
  ScanResult,
  MarketScreenerData,
} from "./marketScanner";
import { useUserStore } from "../store/userStore";

export type SubscriptionTier = "Free" | "Pro" | "Elite";

interface PlanConfig {
  dailyLimit: number | null; // null = unlimited
  allowedScopes: "favorites" | "all";
  batchSize?: number;
  maxSymbols?: number | null; // null = unlimited per run
}

interface AnalysisQuotaState {
  date: string; // YYYY-MM-DD
  runsUsed: number;
  cachedResults: Record<string, CachedAnalysisEntry>;
}

interface CachedAnalysisEntry {
  key: string;
  timestamp: number;
  expiresAt: number;
  results: ScanResult[];
  screener?: MarketScreenerData;
}

interface RunScanOptions {
  filters?: ScanFilter;
  scope?: "favorites" | "all" | "custom";
  symbols?: string[];
  cacheKey?: string;
  force?: boolean;
  cacheTtlMs?: number;
  screener?: boolean;
}

export interface AnalysisRunResponse {
  results: ScanResult[];
  screener?: MarketScreenerData;
  fromCache: boolean;
  remainingRuns: number | null;
  usedRuns: number;
  cacheTimestamp: number;
}

const STORAGE_KEY = "analysis-manager/state";

const PLAN_CONFIG: Record<SubscriptionTier, PlanConfig> = {
  Free: {
    dailyLimit: 10,
    allowedScopes: "favorites",
    batchSize: 5,
    maxSymbols: 10,
  },
  Pro: {
    dailyLimit: 25,
    allowedScopes: "all",
    batchSize: 8,
    maxSymbols: null,
  },
  Elite: {
    dailyLimit: null,
    allowedScopes: "all",
    batchSize: 10,
    maxSymbols: null,
  },
};

function getToday(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

async function loadState(): Promise<AnalysisQuotaState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        date: getToday(),
        runsUsed: 0,
        cachedResults: {},
      };
    }

    const parsed: AnalysisQuotaState = JSON.parse(raw);

    if (parsed.date !== getToday()) {
      return {
        date: getToday(),
        runsUsed: 0,
        cachedResults: {},
      };
    }

    return parsed;
  } catch (error) {
    console.error("⚠️ Failed to load analysis quota state", error);
    return {
      date: getToday(),
      runsUsed: 0,
      cachedResults: {},
    };
  }
}

async function saveState(state: AnalysisQuotaState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("⚠️ Failed to save analysis quota state", error);
  }
}

function getPlanConfig(tier: SubscriptionTier): PlanConfig {
  return PLAN_CONFIG[tier] ?? PLAN_CONFIG.Free;
}

function collectFavoriteSymbols(
  profile = useUserStore.getState().profile
): string[] {
  const favoritesSet = new Set<string>();

  profile.favorites.forEach((symbol) => {
    if (symbol) favoritesSet.add(symbol.toUpperCase());
  });

  profile.watchlists.forEach((watchlist) => {
    watchlist.items.forEach((item) => {
      if (item?.symbol) favoritesSet.add(item.symbol.toUpperCase());
    });
  });

  return Array.from(favoritesSet);
}

function getAllowedSymbols(
  scope: RunScanOptions["scope"],
  plan: PlanConfig,
  symbols?: string[]
): string[] {
  const profile = useUserStore.getState().profile;

  if (scope === "custom" && symbols && symbols.length > 0) {
    if (plan.allowedScopes === "favorites") {
      const favoritesSet = new Set<string>(collectFavoriteSymbols(profile));
      return symbols
        .map((symbol) => symbol.toUpperCase())
        .filter((symbol) => favoritesSet.has(symbol));
    }

    return symbols.map((symbol) => symbol.toUpperCase());
  }

  if (plan.allowedScopes === "favorites") {
    return collectFavoriteSymbols(profile);
  }

  return MarketScanner.getDefaultSymbols();
}

function getRemainingRuns(plan: PlanConfig, runsUsed: number): number | null {
  if (plan.dailyLimit === null) return null;
  return Math.max(0, plan.dailyLimit - runsUsed);
}

function shouldUseCache(
  state: AnalysisQuotaState,
  cacheKey: string,
  force: boolean,
  cacheTtlMs: number
): CachedAnalysisEntry | null {
  if (force) return null;
  const entry = state.cachedResults[cacheKey];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    return null;
  }
  return entry;
}

function makeCacheKey(options: RunScanOptions): string {
  if (options.cacheKey) return options.cacheKey;
  const scope = options.scope ?? "favorites";
  const filterKey = JSON.stringify(options.filters || {});
  const symbolsKey = (options.symbols || [])
    .map((s) => s.toUpperCase())
    .join(",");
  const type = options.screener ? "screener" : "scan";
  return `${type}|${scope}|${filterKey}|${symbolsKey}`;
}

function pruneCache(state: AnalysisQuotaState, limit: number = 20): void {
  const entries = Object.entries(state.cachedResults);
  if (entries.length <= limit) return;

  entries
    .sort(([, a], [, b]) => b.timestamp - a.timestamp)
    .slice(limit)
    .forEach(([key]) => {
      delete state.cachedResults[key];
    });
}

export async function getAnalysisQuotaSummary(): Promise<{
  runsUsed: number;
  remainingRuns: number | null;
  plan: SubscriptionTier;
}> {
  const profile = useUserStore.getState().profile;
  const plan = profile.subscriptionTier as SubscriptionTier;
  const config = getPlanConfig(plan);
  const state = await loadState();

  return {
    runsUsed: state.runsUsed,
    remainingRuns: getRemainingRuns(config, state.runsUsed),
    plan,
  };
}

export async function runManagedScan(
  options: RunScanOptions = {}
): Promise<AnalysisRunResponse> {
  const profile = useUserStore.getState().profile;
  const plan = profile.subscriptionTier as SubscriptionTier;
  const config = getPlanConfig(plan);
  const filters = options.filters || {};
  const cacheTtlMs = options.cacheTtlMs ?? 1000 * 60 * 60; // 1 hour default

  const key = makeCacheKey(options);

  const state = await loadState();

  const cached = shouldUseCache(state, key, options.force ?? false, cacheTtlMs);
  if (cached) {
    return {
      results: cached.results,
      screener: cached.screener,
      fromCache: true,
      remainingRuns: getRemainingRuns(config, state.runsUsed),
      usedRuns: state.runsUsed,
      cacheTimestamp: cached.timestamp,
    };
  }

  const remaining = getRemainingRuns(config, state.runsUsed);
  if (remaining !== null && remaining <= 0) {
    throw Object.assign(new Error("Daily analysis limit reached"), {
      code: "ANALYSIS_QUOTA_EXCEEDED",
      remainingRuns: 0,
      usedRuns: state.runsUsed,
      plan,
    });
  }

  const scope =
    options.scope ??
    (config.allowedScopes === "favorites" ? "favorites" : "all");
  const symbols = getAllowedSymbols(scope, config, options.symbols);

  if (symbols.length === 0) {
    throw Object.assign(
      new Error("Add stocks to your watchlist to run analysis."),
      {
        code: "ANALYSIS_NO_SYMBOLS",
        remainingRuns: getRemainingRuns(config, state.runsUsed),
        usedRuns: state.runsUsed,
        plan,
      }
    );
  }

  let symbolsToScan = symbols;
  if (
    config.maxSymbols !== null &&
    config.maxSymbols !== undefined &&
    symbols.length > config.maxSymbols
  ) {
    symbolsToScan = symbols.slice(0, config.maxSymbols);
  }

  const scanOptions: ScanOptions = {
    symbols: symbolsToScan,
    batchSize: config.batchSize,
  };

  const results = await MarketScanner.scanMarket(filters, scanOptions);

  let screener: MarketScreenerData | undefined;
  if (options.screener) {
    screener = MarketScanner.buildScreenerData(results);
  }

  state.runsUsed += 1;
  const timestamp = Date.now();
  state.cachedResults[key] = {
    key,
    timestamp,
    expiresAt: timestamp + cacheTtlMs,
    results,
    screener,
  };

  pruneCache(state);
  await saveState(state);

  return {
    results,
    screener,
    fromCache: false,
    remainingRuns: getRemainingRuns(config, state.runsUsed),
    usedRuns: state.runsUsed,
    cacheTimestamp: timestamp,
  };
}

export async function clearAnalysisCache(): Promise<void> {
  const state = await loadState();
  state.cachedResults = {};
  await saveState(state);
}
