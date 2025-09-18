import React, { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { navigate, navigationRef } from "../navigation";
import alertsService from "../shared/services/alertsService";
import { useAlertStore } from "../store/alertStore";
import { useAuth } from "./AuthProvider";

type NotificationData = {
  screen?: string;
  symbol?: string;
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
  const receivedListenerRef = useRef<Notifications.Subscription | null>(null);
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);

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

    function handleNotificationResponse(
      response: Notifications.NotificationResponse
    ) {
      try {
        const data = (response.notification.request.content.data ||
          {}) as NotificationData;

        // First, sync alerts to reflect server state
        void syncAlerts();

        // Decide navigation target
        if (typeof data.screen === "string" && data.screen.length > 0) {
          navigateWhenReady(data.screen, data as Record<string, unknown>);
          return;
        }

        if (typeof data.symbol === "string" && data.symbol.length > 0) {
          navigateWhenReady("StockDetail", { symbol: data.symbol });
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
        if (last) handleNotificationResponse(last);
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
