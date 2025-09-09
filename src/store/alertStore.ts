import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AlertCondition =
  | "above"
  | "below"
  | "crosses_above"
  | "crosses_below";

export type AlertSource = "user" | "agent";

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: AlertCondition;
  price: number;
  source: AlertSource;
  note?: string;
  createdAt: number;
  updatedAt?: number;
  active: boolean;
  triggeredAt?: number;
}

export interface AlertStoreState {
  alerts: Record<string, PriceAlert>; // id -> alert

  // CRUD
  createAlert: (
    a: Omit<PriceAlert, "id" | "createdAt" | "active">
  ) => PriceAlert;
  updateAlert: (id: string, updates: Partial<PriceAlert>) => PriceAlert | null;
  deleteAlert: (id: string) => void;
  clearAll: () => void;

  // Queries
  getAlertsForSymbol: (symbol: string) => PriceAlert[];
  getActiveAlertsForSymbol: (symbol: string) => PriceAlert[];
  getAllActiveAlerts: () => PriceAlert[];

  // Helpers
  markTriggered: (id: string) => void;
}

function generateId(prefix: string = "alert"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}

export const useAlertStore = create<AlertStoreState>()(
  persist(
    (set, get) => ({
      alerts: {},

      createAlert: (a) => {
        const id = generateId("price");
        const alert: PriceAlert = {
          id,
          symbol: a.symbol.toUpperCase(),
          condition: a.condition,
          price: Number(a.price),
          source: a.source || "user",
          note: a.note,
          createdAt: Date.now(),
          active: true,
        };
        set((s) => ({ alerts: { ...s.alerts, [id]: alert } }));
        return alert;
      },

      updateAlert: (id, updates) => {
        const current = get().alerts[id];
        if (!current) return null;
        const next: PriceAlert = {
          ...current,
          ...updates,
          updatedAt: Date.now(),
        };
        set((s) => ({ alerts: { ...s.alerts, [id]: next } }));
        return next;
      },

      deleteAlert: (id) => {
        set((s) => {
          const copy = { ...s.alerts };
          delete copy[id];
          return { alerts: copy } as any;
        });
      },

      clearAll: () => set({ alerts: {} }),

      getAlertsForSymbol: (symbol: string) => {
        const sym = symbol.toUpperCase();
        return Object.values(get().alerts).filter((a) => a.symbol === sym);
      },

      getActiveAlertsForSymbol: (symbol: string) => {
        const sym = symbol.toUpperCase();
        return Object.values(get().alerts).filter(
          (a) => a.symbol === sym && a.active
        );
      },

      getAllActiveAlerts: () => {
        return Object.values(get().alerts).filter((a) => a.active);
      },

      markTriggered: (id: string) => {
        const current = get().alerts[id];
        if (!current) return;
        const next: PriceAlert = {
          ...current,
          active: false,
          triggeredAt: Date.now(),
        };
        set((s) => ({ alerts: { ...s.alerts, [id]: next } }));
      },
    }),
    {
      name: "alerts-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ alerts: s.alerts }),
    }
  )
);

// Pure evaluator for alert conditions
export function shouldTrigger(
  condition: AlertCondition,
  last: number,
  level: number,
  prev?: number
): boolean {
  if (!Number.isFinite(last) || !Number.isFinite(level)) return false;
  switch (condition) {
    case "above":
      return last >= level;
    case "below":
      return last <= level;
    case "crosses_above":
      return Number.isFinite(prev)
        ? (prev as number) < level && last >= level
        : last >= level;
    case "crosses_below":
      return Number.isFinite(prev)
        ? (prev as number) > level && last <= level
        : last <= level;
    default:
      return false;
  }
}
