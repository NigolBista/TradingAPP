import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  registerForPushNotificationsAsync,
  sendLocalNotification,
  sendSignalPushNotification,
} from "../services/notifications";
import { useUserStore } from "../store/userStore";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import alertsService, {
  type AlertRow,
  type TradeSignalRow,
} from "../services/alertsService";
import { notifySubscribers } from "../services/signalService";
import { useAlertStore } from "../store/alertStore";
import barsService from "../services/barsService";
import {
  fetchUserWatchlist,
  syncUserWatchlist,
} from "../services/watchlistService";
import {
  fetchUserStrategyPreferences,
  upsertUserStrategyPreferences,
} from "../services/strategyPreferencesService";

export type AuthUser = { id: string; email?: string; user_metadata?: any };

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  demoLogin: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const setProfile = useUserStore((s) => s.setProfile);
  const profile = useUserStore((s) => s.profile);
  const resetProfile = useUserStore((s) => s.reset);
  const hydrateStrategyPreferences = useUserStore(
    (s) => s.hydrateStrategyPreferences
  );
  const saveStrategyPreferences = useUserStore(
    (s) => s.saveStrategyPreferences
  );
  const setAlerts = useAlertStore((s) => s.setAlerts);
  const upsertAlert = useAlertStore((s) => s.upsertAlert);
  const removeAlert = useAlertStore((s) => s.removeAlert);
  const alerts = useAlertStore((s) => s.alerts);

  // track realtime subscription cleanup
  const [cleanupRealtime, setCleanupRealtime] = useState<null | (() => void)>(
    null
  );
  const barUnsubsRef = useRef<Record<string, () => void>>({});
  const watchlistSaveRef = useRef<NodeJS.Timeout | null>(null);
  const skipWatchlistSaveRef = useRef<boolean>(true);
  const strategyPrefsSaveRef = useRef<NodeJS.Timeout | null>(null);
  const skipStrategyPrefsSaveRef = useRef<boolean>(true);

  useEffect(() => {
    // Ask permissions early
    registerForPushNotificationsAsync();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata,
        });
        setProfile({
          email: session.user.email,
          subscriptionTier: "Free",
          skillLevel: session.user.user_metadata?.skill_level || "Beginner",
          traderType:
            session.user.user_metadata?.trader_type || "Long-term holder",
        });
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata,
        });
        setProfile({
          email: session.user.email,
          subscriptionTier: "Free",
          skillLevel: session.user.user_metadata?.skill_level || "Beginner",
          traderType:
            session.user.user_metadata?.trader_type || "Long-term holder",
        });
      } else {
        setUser(null);
        resetProfile();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // When user is available, register device token and start realtime
  useEffect(() => {
    let isMounted = true;
    async function setupForUser(u: AuthUser) {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await alertsService.registerDeviceToken(u.id, token);
        }

        // In development, trigger processing the notifications queue so push tests send immediately
        if ((process.env.NODE_ENV || "development") !== "production") {
          try {
            await alertsService.processNotificationQueue();
          } catch {}
        }

        // hydrate alerts initially
        const serverAlerts = await alertsService.fetchAlerts(u.id);
        if (!isMounted) return;
        setAlerts(serverAlerts);

        // hydrate watchlists
        try {
          const canPersist = !!(u.id && /^[0-9a-fA-F-]{36}$/.test(u.id));
          if (canPersist) {
            const rows = await fetchUserWatchlist(u.id);
            if (isMounted && Array.isArray(rows)) {
              const current = useUserStore.getState().profile;
              const items = rows.map((r) => ({
                symbol: r.symbol,
                isFavorite: !!r.isFavorite,
                addedAt: r.addedAt ? new Date(r.addedAt) : new Date(),
              }));
              setProfile({
                watchlists: [
                  {
                    id: "default",
                    name: "My Watchlist",
                    description: "Default watchlist",
                    color: current.watchlists[0]?.color || "#00D4AA",
                    items,
                    createdAt: current.watchlists[0]?.createdAt || new Date(),
                    isDefault: true,
                  },
                ],
                activeWatchlistId: "default",
                favorites: items
                  .filter((i) => i.isFavorite)
                  .map((i) => i.symbol),
              });
            }
          }
        } catch {
        } finally {
          skipWatchlistSaveRef.current = false;
        }

        // hydrate strategy preferences
        try {
          const canPersist = !!(u.id && /^[0-9a-fA-F-]{36}$/.test(u.id));
          if (canPersist) {
            const prefs = await fetchUserStrategyPreferences(u.id);
            if (isMounted && prefs) {
              hydrateStrategyPreferences({
                selectedStrategyGroupId:
                  prefs.selected_strategy_group_id ?? undefined,
                tradeMode: prefs.trade_mode,
                tradePace: prefs.trade_pace,
                contextMode: prefs.context_mode,
                strategyComplexity: prefs.strategy_complexity,
                autoApplyComplexity: prefs.auto_apply_complexity,
                newsSentimentEnabled: prefs.news_sentiment_enabled,
              });
            }
          }
        } catch (error) {
          console.warn(
            "[AuthProvider] Failed to hydrate strategy prefs",
            error
          );
        } finally {
          skipStrategyPrefsSaveRef.current = false;
        }

        // start realtime
        const stop = alertsService.startRealtime(u.id, {
          onTradeSignal: (sig: TradeSignalRow) => {
            try {
              notifySubscribers({
                symbol: sig.symbol,
                groupId: sig.user_id,
                timeframe: sig.timeframe,
                entries: sig.entry_price ? [sig.entry_price] : [],
                exits: sig.stop_loss ? [sig.stop_loss] : [],
                tps: Array.isArray(sig.targets) ? sig.targets : [],
                createdAt: Date.now(),
              });
            } catch (e) {}
          },
          onAlertEvent: async (evt) => {
            try {
              await sendLocalNotification(
                `${evt.symbol} Alert`,
                `${evt.condition.replace("_", " ")}: $${evt.price.toFixed(2)}`
              );
            } catch (e) {}
          },
          onAlertChange: (row: AlertRow) => {
            // map to local store shape
            upsertAlert({
              id: row.id,
              symbol: row.symbol,
              price: row.price,
              condition: row.condition,
              message: row.message ?? undefined,
              isActive: row.is_active,
              createdAt: Date.parse(row.created_at),
              triggeredAt: row.triggered_at
                ? Date.parse(row.triggered_at)
                : undefined,
              lastPrice: row.last_price ?? undefined,
              repeat: (row as any).repeat,
              lastNotifiedAt: (row as any).last_notified_at
                ? Date.parse((row as any).last_notified_at)
                : undefined,
            });
          },
          onAlertDelete: (id: string) => {
            try {
              removeAlert(id);
            } catch {}
          },
        });
        setCleanupRealtime(() => stop);
      } catch (e) {
        // ignore
      }
    }

    if (user) {
      setupForUser(user);
    } else {
      // clean up realtime on logout
      if (cleanupRealtime) {
        try {
          cleanupRealtime();
        } catch {}
        setCleanupRealtime(null);
      }
      setAlerts([]);
      skipWatchlistSaveRef.current = true;
      skipStrategyPrefsSaveRef.current = true;
      try {
        if (watchlistSaveRef.current) clearTimeout(watchlistSaveRef.current);
      } catch {}
      try {
        if (strategyPrefsSaveRef.current)
          clearTimeout(strategyPrefsSaveRef.current);
      } catch {}
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Debounced save of all watchlists and global favorites to Supabase
  useEffect(() => {
    const canPersist = !!(user?.id && /^[0-9a-fA-F-]{36}$/.test(user.id));
    if (!canPersist || skipWatchlistSaveRef.current) return;
    try {
      if (watchlistSaveRef.current) clearTimeout(watchlistSaveRef.current);
    } catch {}
    watchlistSaveRef.current = setTimeout(() => {
      // Persist the union of all symbols from all watchlists and global favorites
      const symbolSet = new Set<string>();
      try {
        for (const w of profile.watchlists) {
          for (const it of w.items) symbolSet.add(it.symbol);
        }
        for (const sym of profile.favorites) symbolSet.add(sym);
      } catch {}

      const items = Array.from(symbolSet).map((symbol) => ({
        symbol,
        isFavorite: profile.favorites.includes(symbol),
      }));
      syncUserWatchlist(user!.id, items).catch(() => {});
    }, 600);
    return () => {
      try {
        if (watchlistSaveRef.current) clearTimeout(watchlistSaveRef.current);
      } catch {}
    };
  }, [user?.id, profile.watchlists, profile.favorites]);

  useEffect(() => {
    const canPersist = !!(user?.id && /^[0-9a-fA-F-]{36}$/.test(user.id));
    if (!canPersist || skipStrategyPrefsSaveRef.current) return;

    try {
      if (strategyPrefsSaveRef.current)
        clearTimeout(strategyPrefsSaveRef.current);
    } catch {}

    strategyPrefsSaveRef.current = setTimeout(() => {
      const payload = {
        user_id: user!.id,
        trade_mode: profile.tradeMode || "day",
        trade_pace: profile.tradePace || "auto",
        context_mode: profile.contextMode || "price_action",
        strategy_complexity: profile.strategyComplexity || "advanced",
        auto_apply_complexity: !!profile.autoApplyComplexity,
        news_sentiment_enabled: !!profile.newsSentimentEnabled,
        selected_strategy_group_id:
          profile.selectedStrategyGroupId ?? undefined,
      } as const;

      upsertUserStrategyPreferences(payload)
        .then((row) => {
          saveStrategyPreferences({
            tradeMode: row.trade_mode,
            tradePace: row.trade_pace,
            contextMode: row.context_mode,
            strategyComplexity: row.strategy_complexity,
            autoApplyComplexity: row.auto_apply_complexity,
            newsSentimentEnabled: row.news_sentiment_enabled,
            selectedStrategyGroupId:
              row.selected_strategy_group_id ?? undefined,
          });
        })
        .catch((error) => {
          console.warn(
            "[AuthProvider] Failed to persist strategy prefs",
            error
          );
        });
    }, 600);

    return () => {
      try {
        if (strategyPrefsSaveRef.current)
          clearTimeout(strategyPrefsSaveRef.current);
      } catch {}
    };
  }, [
    user?.id,
    profile.tradeMode,
    profile.tradePace,
    profile.contextMode,
    profile.strategyComplexity,
    profile.autoApplyComplexity,
    profile.newsSentimentEnabled,
    profile.selectedStrategyGroupId,
  ]);

  // Subscribe to realtime bars for symbols with active alerts and update local lastPrice
  useEffect(() => {
    function currentSymbolsSet(): Set<string> {
      const set = new Set<string>();
      alerts.filter((a) => a.isActive).forEach((a) => set.add(a.symbol));
      return set;
    }

    if (!user) {
      // Cleanup all bar subscriptions when logging out
      Object.values(barUnsubsRef.current).forEach((unsub) => {
        try {
          unsub();
        } catch {}
      });
      barUnsubsRef.current = {};
      return;
    }

    const desired = currentSymbolsSet();
    const existing = new Set(Object.keys(barUnsubsRef.current));

    // Unsubscribe symbols we no longer need
    for (const sym of existing) {
      if (!desired.has(sym)) {
        try {
          barUnsubsRef.current[sym]!();
        } catch {}
        delete barUnsubsRef.current[sym];
      }
    }

    // Subscribe new symbols
    for (const sym of desired) {
      if (!barUnsubsRef.current[sym]) {
        const unsub = barsService.subscribeBars(sym, (bar) => {
          const lastClose = Number(bar.c);
          try {
            const state = useAlertStore.getState();
            state.alerts
              .filter((a) => a.symbol === sym)
              .forEach((a) =>
                state.updateAlert(a.id, { lastPrice: lastClose })
              );
          } catch {}
        });
        barUnsubsRef.current[sym] = unsub;
      }
    }

    return () => {
      // Do not eagerly tear down here; handled on next run or user logout
    };
  }, [user?.id, alerts]);

  function demoLogin() {
    const demo: AuthUser = { id: "demo-user", email: "demo@TradingApp.app" };
    setUser(demo);
    setProfile({
      email: demo.email,
      subscriptionTier: "Free",
      skillLevel: "Beginner",
      traderType: "Long-term holder",
    });
  }

  async function login(email: string, password: string) {
    if (!email || !password) throw new Error("Email and password are required");

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Please enter a valid email address");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (error) throw error;
  }

  async function register(email: string, password: string, fullName?: string) {
    if (!email || !password) throw new Error("Email and password are required");

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Please enter a valid email address");
    }

    // Password validation
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    const { error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          full_name: fullName,
          skill_level: "Beginner",
          trader_type: "Long-term holder",
        },
      },
    });

    if (error) throw error;
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function resetPassword(email: string) {
    if (!email) throw new Error("Email is required");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Please enter a valid email address");
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase().trim()
    );
    if (error) throw error;
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      demoLogin,
      login,
      register,
      logout,
      resetPassword,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
