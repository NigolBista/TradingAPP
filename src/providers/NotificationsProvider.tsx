import React, { useEffect, useCallback, useRef } from "react";
import * as Notifications from "expo-notifications";
import { navigate, navigationRef } from "../navigation";
import alertsService, { type TradeSignalRow } from "../services/alertsService";
import { useAlertStore } from "../store/alertStore";
import { useAuth } from "./AuthProvider";
import {
  useSignalCacheStore,
  type CachedSignal,
} from "../store/signalCacheStore";
import { useChatStore } from "../store/chatStore";

type NotificationData = {
  screen?: string;
  symbol?: string;
  timeframe?: string;
  entries?: number[];
  exits?: number[];
  tps?: number[];
  groupId?: string;
  groupName?: string | null;
  providerUserId?: string | null;
  providerName?: string | null;
  side?: "buy" | "sell" | null;
  confidence?: number | null;
  rationale?: string | null;
  timestamp?: number;
  condition?: string;
  price?: number;
  [key: string]: unknown;
};

function navigateWhenReady(screen: string, params?: Record<string, unknown>) {
  if (navigationRef.isReady()) {
    navigate(screen, params);
    return;
  }
  let attemptsRemaining = 20; // ~6s max (20 * 300ms)
  const tryLater = () => {
    if (navigationRef.isReady()) {
      navigate(screen, params);
      return;
    }
    attemptsRemaining -= 1;
    if (attemptsRemaining > 0) setTimeout(tryLater, 300);
  };
  setTimeout(tryLater, 300);
}

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const setAlerts = useAlertStore((s) => s.setAlerts);
  const cacheSignal = useSignalCacheStore((s) => s.cacheSignal);
  const addAnalysisMessage = useChatStore((s) => s.addAnalysisMessage);
  const receivedListenerRef = useRef<Notifications.Subscription | null>(null);
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);

  const sanitizeLevels = useCallback((value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
      .map((n) => Number.parseFloat(n.toFixed(4)));
  }, []);

  const notificationMetaFromData = useCallback(
    (data: NotificationData): CachedSignal["notificationMeta"] => ({
      groupId: data.groupId ?? undefined,
      groupName: data.groupName ?? null,
      providerUserId: data.providerUserId ?? null,
      providerName: data.providerName ?? null,
      side: data.side ?? null,
      confidence: typeof data.confidence === "number" ? data.confidence : null,
      rationale: data.rationale ?? null,
      timeframe: data.timeframe ?? null,
      notifiedAt: data.timestamp ?? Date.now(),
    }),
    []
  );

  const planFromNotification = useCallback(
    (
      data: NotificationData
    ): {
      tradePlan: { entries: number[]; exits: number[]; tps: number[] } | null;
      aiMeta: {
        strategyChosen?: string;
        side?: "long" | "short";
        confidence?: number;
        why?: string[];
      } | null;
    } => {
      const entries = sanitizeLevels(data.entries);
      const exits = sanitizeLevels(data.exits);
      const tps = sanitizeLevels(data.tps);

      const planEmpty = !entries.length && !exits.length && !tps.length;

      const side: "short" | "long" | undefined =
        data.side === "sell"
          ? "short"
          : data.side === "buy"
          ? "long"
          : undefined;
      const aiMeta =
        side || typeof data.confidence === "number" || data.rationale
          ? {
              strategyChosen: data.groupName ?? undefined,
              side,
              confidence:
                typeof data.confidence === "number"
                  ? data.confidence
                  : undefined,
              why: data.rationale ? [String(data.rationale)] : undefined,
            }
          : null;

      return {
        tradePlan: planEmpty ? null : { entries, exits, tps },
        aiMeta,
      };
    },
    [sanitizeLevels]
  );

  const planFromTradeSignal = useCallback(
    (
      signal: TradeSignalRow
    ): {
      tradePlan: { entries: number[]; exits: number[]; tps: number[] };
      aiMeta: {
        strategyChosen?: string;
        side?: "long" | "short";
        confidence?: number;
        why?: string[];
        notes?: string[];
        targets?: number[];
      };
      notificationMeta: {
        groupId?: string;
        groupName?: string | null;
        providerUserId?: string | null;
        providerName?: string | null;
        side?: "buy" | "sell" | null;
        confidence?: number | null;
        rationale?: string | null;
        timeframe?: string | null;
        notifiedAt?: number;
      };
    } => {
      const meta: Record<string, unknown> =
        (signal.metadata as Record<string, unknown>) ?? {};

      const entriesMeta = sanitizeLevels(meta.entries);
      const exitsMeta = sanitizeLevels(meta.exits);
      const tpsMeta = sanitizeLevels(meta.tps);

      const entries = entriesMeta.length
        ? entriesMeta
        : Number.isFinite(signal.entry_price)
        ? [Number(signal.entry_price)]
        : [];

      const exits = exitsMeta.length
        ? exitsMeta
        : Number.isFinite(signal.stop_loss)
        ? [Number(signal.stop_loss)]
        : [];

      const tps = tpsMeta.length
        ? tpsMeta
        : Array.isArray(signal.targets)
        ? sanitizeLevels(signal.targets)
        : [];

      const side: "short" | "long" =
        signal.action === "sell" ? "short" : "long";

      return {
        tradePlan: {
          entries,
          exits,
          tps,
        },
        aiMeta: {
          strategyChosen:
            typeof meta.group_name === "string" ? meta.group_name : undefined,
          side,
          confidence: signal.confidence ?? undefined,
          why: signal.rationale ? [signal.rationale] : undefined,
          targets: tps,
        },
        notificationMeta: {
          groupId:
            typeof meta.group_id === "string" ? meta.group_id : undefined,
          groupName:
            typeof meta.group_name === "string" ? meta.group_name : null,
          providerUserId:
            typeof meta.provider_user_id === "string"
              ? meta.provider_user_id
              : null,
          providerName:
            typeof meta.provider_name === "string" ? meta.provider_name : null,
          side: signal.action,
          confidence: signal.confidence,
          rationale: signal.rationale,
          timeframe: signal.timeframe ?? null,
          notifiedAt: undefined,
        },
      };
    },
    [sanitizeLevels]
  );

  useEffect(() => {
    async function syncAlerts() {
      if (!user) return;
      try {
        const serverAlerts = await alertsService.fetchAlerts(user.id);
        setAlerts(serverAlerts);
      } catch {
        // ignore sync errors
      }
    }

    function handleNotificationReceived(
      notification: Notifications.Notification
    ) {
      // Foreground receipt: keep store in sync with server state
      // (push payload includes symbol/condition/price but not alert id)
      void syncAlerts();
    }

    async function handleNotificationResponse(
      response: Notifications.NotificationResponse
    ) {
      try {
        const data = (response.notification.request.content.data ||
          {}) as NotificationData;

        // First, sync alerts to reflect server state
        void syncAlerts();

        // Decide navigation target
        if (typeof data.screen === "string" && data.screen.length > 0) {
          // If screen is ChartFullScreen and we have a symbol, normalize payload,
          // seed cache, and pass tradePlan/ai explicitly so levels render.
          if (
            data.screen === "ChartFullScreen" &&
            typeof data.symbol === "string"
          ) {
            const symbol = data.symbol;
            type TradePlanPayload = {
              entries: number[];
              exits: number[];
              tps: number[];
            };
            const params: Record<string, unknown> & {
              symbol: string;
              initialTimeframe?: string;
              tradePlan?: TradePlanPayload;
              ai?: {
                strategyChosen?: string;
                side?: "long" | "short";
                confidence?: number;
                why?: string[];
              };
              notificationMeta?: CachedSignal["notificationMeta"];
            } = { symbol };
            if (typeof data.timeframe === "string")
              params.initialTimeframe = data.timeframe;

            const { tradePlan, aiMeta } = planFromNotification(data);
            if (tradePlan) params.tradePlan = tradePlan;
            if (aiMeta) params.ai = aiMeta;

            const notificationMeta = notificationMetaFromData(data);
            params.notificationMeta = notificationMeta;

            if (tradePlan) {
              cacheSignal({
                symbol,
                timestamp: Date.now(),
                tradePlan,
                aiMeta: aiMeta ?? undefined,
                notificationMeta,
              });
            } else if (user?.id) {
              // Fallback: fetch latest signal for this user/symbol/group
              try {
                const row = await alertsService.fetchLatestSignal(
                  user.id,
                  symbol,
                  {
                    groupId: data.groupId ?? undefined,
                  }
                );
                if (row) {
                  const parsed = planFromTradeSignal(row);
                  params.tradePlan = parsed.tradePlan;
                  params.ai = parsed.aiMeta;
                  params.notificationMeta = parsed.notificationMeta;
                  cacheSignal({
                    symbol,
                    timestamp: Date.now(),
                    tradePlan: parsed.tradePlan,
                    aiMeta: parsed.aiMeta,
                    notificationMeta: {
                      ...parsed.notificationMeta,
                      notifiedAt: Date.now(),
                    },
                  });
                }
              } catch (e) {
                // ignore
              }
            }

            navigateWhenReady("ChartFullScreen", params);
            return;
          }

          navigateWhenReady(data.screen, data as Record<string, unknown>);
          return;
        }

        if (typeof data.symbol === "string" && data.symbol.length > 0) {
          const symbol = data.symbol;
          type TradePlanPayload = {
            entries: number[];
            exits: number[];
            tps: number[];
          };

          const params: Record<string, unknown> & {
            symbol: string;
            initialTimeframe?: string;
            tradePlan?: TradePlanPayload;
            ai?: {
              strategyChosen?: string;
              side?: "long" | "short";
              confidence?: number;
              why?: string[];
            };
            analysisContext?: {
              mode: string;
              tradePace: string;
              desiredRR: number;
              contextMode: string;
              isAutoAnalysis: boolean;
              contextLookback?: { mode: "auto" | "fixed"; ms?: number };
            };
            notificationMeta?: CachedSignal["notificationMeta"];
          } = { symbol };
          if (typeof data.timeframe === "string") {
            params.initialTimeframe = data.timeframe;
          }

          const { tradePlan, aiMeta } = planFromNotification(data);

          if (tradePlan) {
            params.tradePlan = tradePlan;
            if (aiMeta) {
              params.ai = aiMeta;
            }

            const notificationMeta = notificationMetaFromData(data);
            params.notificationMeta = notificationMeta;

            cacheSignal({
              symbol,
              timestamp: Date.now(),
              tradePlan,
              aiMeta: aiMeta ?? undefined,
              notificationMeta,
            });

            if (aiMeta) {
              try {
                addAnalysisMessage({
                  symbol,
                  strategy: aiMeta.strategyChosen,
                  side: aiMeta.side,
                  entry: tradePlan.entries?.[0],
                  exit: tradePlan.exits?.[0],
                  targets: tradePlan.tps,
                  confidence: aiMeta.confidence,
                  why: aiMeta.why,
                  tradePlan,
                  aiMeta,
                  analysisContext: {
                    mode: data.timeframe ? "manual" : "auto",
                    tradePace: data.timeframe ?? "auto",
                    desiredRR: 0,
                    contextMode: "price_action",
                    isAutoAnalysis: false,
                  },
                });
              } catch (error) {
                console.warn(
                  "[NotificationsProvider] addAnalysisMessage failed",
                  error
                );
              }
            }

            const hasLevels = Boolean(params.tradePlan);
            const targetScreen = hasLevels ? "ChartFullScreen" : "StockDetail";
            navigateWhenReady(targetScreen, params);
            return;
          }

          (async () => {
            if (user?.id) {
              try {
                const row = await alertsService.fetchLatestSignal(
                  user.id,
                  symbol,
                  {
                    groupId: data.groupId ?? undefined,
                  }
                );
                if (row) {
                  const parsed = planFromTradeSignal(row);
                  params.tradePlan = parsed.tradePlan;
                  params.ai = parsed.aiMeta;
                  params.notificationMeta = parsed.notificationMeta;

                  cacheSignal({
                    symbol,
                    timestamp: Date.now(),
                    tradePlan: parsed.tradePlan,
                    aiMeta: parsed.aiMeta,
                    notificationMeta: {
                      ...parsed.notificationMeta,
                      notifiedAt:
                        parsed.notificationMeta?.notifiedAt ?? Date.now(),
                    },
                  });

                  try {
                    addAnalysisMessage({
                      symbol,
                      strategy: parsed.aiMeta.strategyChosen,
                      side: parsed.aiMeta.side,
                      entry: parsed.tradePlan.entries?.[0],
                      exit: parsed.tradePlan.exits?.[0],
                      targets: parsed.tradePlan.tps,
                      confidence: parsed.aiMeta.confidence,
                      why: parsed.aiMeta.why,
                      tradePlan: parsed.tradePlan,
                      aiMeta: parsed.aiMeta,
                      analysisContext: {
                        mode: data.timeframe ? "manual" : "auto",
                        tradePace: data.timeframe ?? "auto",
                        desiredRR: 0,
                        contextMode: "price_action",
                        isAutoAnalysis: false,
                      },
                    });
                  } catch (error) {
                    console.warn(
                      "[NotificationsProvider] addAnalysisMessage failed",
                      error
                    );
                  }
                }
              } catch (error) {
                console.warn(
                  "[NotificationsProvider] fetchLatestSignal failed",
                  error
                );
              }
            }

            const hasLevels = Boolean(params.tradePlan);
            const targetScreen = hasLevels ? "ChartFullScreen" : "StockDetail";
            navigateWhenReady(targetScreen, params);
          })();
          return;
        }
      } catch {
        // no-op
      }
    }

    // Register listeners
    receivedListenerRef.current = Notifications.addNotificationReceivedListener(
      handleNotificationReceived
    );
    responseListenerRef.current =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

    // Handle cold start taps
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) await handleNotificationResponse(last);
      } catch {
        // ignore
      }
    })();

    return () => {
      try {
        receivedListenerRef.current?.remove();
      } catch {}
      try {
        responseListenerRef.current?.remove();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <>{children}</>;
}

export default NotificationsProvider;
