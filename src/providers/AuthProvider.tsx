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
  scheduleSignalAlert,
  sendLocalNotification,
} from "../services/notifications";
import { useUserStore } from "../store/userStore";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import alertsService, {
  type AlertRow,
  type TradeSignalRow,
} from "../services/alertsService";
import { useAlertStore } from "../store/alertStore";
import barsService from "../services/barsService";

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
  const resetProfile = useUserStore((s) => s.reset);
  const setAlerts = useAlertStore((s) => s.setAlerts);
  const upsertAlert = useAlertStore((s) => s.upsertAlert);
  const alerts = useAlertStore((s) => s.alerts);

  // track realtime subscription cleanup
  const [cleanupRealtime, setCleanupRealtime] = useState<null | (() => void)>(
    null
  );
  const barUnsubsRef = useRef<Record<string, () => void>>({});

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

        // start realtime
        const stop = alertsService.startRealtime(u.id, {
          onTradeSignal: async (sig: TradeSignalRow) => {
            try {
              if (sig.entry_price && sig.confidence) {
                await scheduleSignalAlert(
                  sig.symbol,
                  sig.action,
                  sig.confidence,
                  sig.entry_price
                );
              } else {
                await sendLocalNotification(
                  `${sig.symbol} ${sig.kind}`,
                  `${sig.action.toUpperCase()} signal received`
                );
              }
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
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

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
