import { supabase } from "../lib/supabase";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { PriceAlert } from "../store/alertStore";

export type AlertCondition =
  | "above"
  | "below"
  | "crosses_above"
  | "crosses_below";

export type AlertRow = {
  id: string;
  user_id: string;
  symbol: string;
  price: number;
  condition: AlertCondition;
  message: string | null;
  is_active: boolean;
  last_price: number | null;
  triggered_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type TradeSignalRow = {
  id: string;
  user_id: string;
  symbol: string;
  kind: "setup" | "entry" | "tp" | "exit";
  action: "buy" | "sell";
  timeframe: string;
  confidence: number | null;
  entry_price: number | null;
  stop_loss: number | null;
  targets: number[] | null;
  rationale: string | null;
  unique_key: string | null;
  created_at: string;
};

export type AlertEventRow = {
  id: string;
  user_id: string;
  alert_id: string;
  symbol: string;
  price: number;
  condition: AlertCondition;
  fired_at: string;
};

function mapAlertRowToStore(a: AlertRow): PriceAlert {
  return {
    id: a.id,
    symbol: a.symbol,
    price: a.price,
    condition: a.condition,
    message: a.message ?? undefined,
    isActive: a.is_active,
    createdAt: Date.parse(a.created_at),
    triggeredAt: a.triggered_at ? Date.parse(a.triggered_at) : undefined,
    lastPrice: a.last_price ?? undefined,
  };
}

export const alertsService = {
  async fetchAlerts(userId: string, symbol?: string): Promise<PriceAlert[]> {
    let query = supabase
      .from("alerts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (symbol) query = query.eq("symbol", symbol);

    const { data, error } = await query;
    if (error) throw error;
    return (data as AlertRow[]).map(mapAlertRowToStore);
  },

  async createAlert(
    userId: string,
    alert: Omit<PriceAlert, "id" | "createdAt" | "triggeredAt" | "lastPrice">
  ): Promise<PriceAlert> {
    const payload = {
      user_id: userId,
      symbol: alert.symbol,
      price: alert.price,
      condition: alert.condition,
      message: alert.message ?? null,
      is_active: alert.isActive,
    };

    const { data, error } = await supabase
      .from("alerts")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return mapAlertRowToStore(data as AlertRow);
  },

  async updateAlert(
    userId: string,
    id: string,
    updates: Partial<
      Omit<PriceAlert, "id" | "createdAt" | "triggeredAt" | "lastPrice">
    >
  ): Promise<PriceAlert> {
    const payload: Partial<AlertRow> = {
      symbol: updates.symbol,
      price: updates.price,
      condition: updates.condition as any,
      message: updates.message ?? null,
      is_active: updates.isActive,
    };

    const { data, error } = await supabase
      .from("alerts")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return mapAlertRowToStore(data as AlertRow);
  },

  async deleteAlert(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from("alerts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async registerDeviceToken(userId: string, expoPushToken: string) {
    const appVersion = Constants.expoConfig?.version ?? null;
    const devicePayload = {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform: Platform.OS,
      app_version: appVersion,
    };

    const { error } = await supabase
      .from("user_devices")
      .upsert(devicePayload, {
        onConflict: "user_id,expo_push_token",
      });
    if (error) throw error;
  },

  startRealtime(
    userId: string,
    handlers: {
      onTradeSignal?: (signal: TradeSignalRow) => void;
      onAlertEvent?: (evt: AlertEventRow) => void;
      onAlertChange?: (row: AlertRow) => void;
    }
  ) {
    const channel = supabase.channel(`alerts_and_signals_${userId}`);

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "trade_signals",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        handlers.onTradeSignal?.(payload.new as TradeSignalRow);
      }
    );

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "alert_events",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        handlers.onAlertEvent?.(payload.new as AlertEventRow);
      }
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "alerts",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        handlers.onAlertChange?.(payload.new as AlertRow);
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

export default alertsService;
