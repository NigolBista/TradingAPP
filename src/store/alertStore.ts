import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface PriceAlert {
  id: string;
  symbol: string;
  price: number;
  condition: "above" | "below" | "crosses_above" | "crosses_below";
  message?: string;
  isActive: boolean;
  createdAt: number;
  triggeredAt?: number;
  lastPrice?: number;
}

interface AlertState {
  alerts: PriceAlert[];
  setAlerts: (alerts: PriceAlert[]) => void;
  upsertAlert: (alert: PriceAlert) => void;
  removeAlert: (id: string) => void;
  addAlert: (alert: Omit<PriceAlert, "id" | "createdAt" | "isActive">) => void;
  updateAlert: (id: string, updates: Partial<PriceAlert>) => void;
  deleteAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  getAlertsForSymbol: (symbol: string) => PriceAlert[];
  clearAlertsForSymbol: (symbol: string) => void;
  clearAllAlerts: () => void;
  checkAlerts: (symbol: string, currentPrice: number) => PriceAlert[];
}

export const useAlertStore = create<AlertState>()(
  persist(
    (set, get) => ({
      alerts: [],

      setAlerts: (alerts) => set({ alerts }),

      upsertAlert: (alert) => {
        set((state) => {
          const exists = state.alerts.some((a) => a.id === alert.id);
          if (exists) {
            return {
              alerts: state.alerts.map((a) => (a.id === alert.id ? alert : a)),
            };
          }
          return { alerts: [alert, ...state.alerts] };
        });
      },

      removeAlert: (id) => {
        set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }));
      },

      addAlert: (alertData) => {
        const newAlert: PriceAlert = {
          ...alertData,
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now(),
          isActive: true,
        };
        set((state) => ({
          alerts: [...state.alerts, newAlert],
        }));
      },

      updateAlert: (id, updates) => {
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === id ? { ...alert, ...updates } : alert
          ),
        }));
      },

      deleteAlert: (id) => {
        set((state) => ({
          alerts: state.alerts.filter((alert) => alert.id !== id),
        }));
      },

      toggleAlert: (id) => {
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === id ? { ...alert, isActive: !alert.isActive } : alert
          ),
        }));
      },

      getAlertsForSymbol: (symbol) => {
        return get().alerts.filter((alert) => alert.symbol === symbol);
      },

      clearAlertsForSymbol: (symbol) => {
        set((state) => ({
          alerts: state.alerts.filter((alert) => alert.symbol !== symbol),
        }));
      },

      clearAllAlerts: () => {
        set({ alerts: [] });
      },

      checkAlerts: (symbol, currentPrice) => {
        const alerts = get().alerts.filter(
          (alert) => alert.symbol === symbol && alert.isActive
        );
        const triggeredAlerts: PriceAlert[] = [];

        alerts.forEach((alert) => {
          let shouldTrigger = false;

          switch (alert.condition) {
            case "above":
              shouldTrigger = currentPrice > alert.price;
              break;
            case "below":
              shouldTrigger = currentPrice < alert.price;
              break;
            case "crosses_above":
              shouldTrigger =
                alert.lastPrice !== undefined &&
                alert.lastPrice <= alert.price &&
                currentPrice > alert.price;
              break;
            case "crosses_below":
              shouldTrigger =
                alert.lastPrice !== undefined &&
                alert.lastPrice >= alert.price &&
                currentPrice < alert.price;
              break;
          }

          if (shouldTrigger && !alert.triggeredAt) {
            triggeredAlerts.push(alert);
            // Update the alert as triggered
            get().updateAlert(alert.id, {
              triggeredAt: Date.now(),
              isActive: false,
            });
          }

          // Update last price for future cross detection
          get().updateAlert(alert.id, { lastPrice: currentPrice });
        });

        return triggeredAlerts;
      },
    }),
    {
      name: "alert-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ alerts: state.alerts }),
    }
  )
);
