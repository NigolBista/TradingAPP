import { supabase } from "../lib/supabase";
import { StrategyConfig } from "../types/strategy";

export type TradeStrategyMode = "day" | "swing";
export type TradeStrategyPace = "auto" | "day" | "scalp" | "swing";
export type TradeContextMode = "price_action" | "news_sentiment";
export type StrategyComplexityLevel = "simple" | "partial" | "advanced";

export type UserStrategyPreferencesRow = {
  user_id: string;
  selected_strategy_group_id?: string | null;
  trade_mode: TradeStrategyMode;
  trade_pace: TradeStrategyPace;
  context_mode: TradeContextMode;
  strategy_complexity: StrategyComplexityLevel;
  auto_apply_complexity: boolean;
  news_sentiment_enabled: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export interface StrategyPreferenceRow {
  id: string;
  user_id: string;
  selected_strategy_group_id?: string | null;
  strategy_complexity: StrategyComplexityLevel;
  trade_mode: "day" | "swing";
  default_strategy_id?: string | null;
  strategy_config?: StrategyConfig;
  created_at: string;
  updated_at: string;
}

export interface StrategyPreferencesPayload {
  selected_strategy_group_id?: string | null;
  strategy_complexity: StrategyComplexityLevel;
  trade_mode: "day" | "swing";
  default_strategy_id?: string | null;
  strategy_config?: StrategyConfig;
}

export type StrategyPrefUpdate = {
  selected_strategy_group_id?: string | null;
  strategy_complexity?: StrategyComplexityLevel;
  trade_mode?: "day" | "swing";
  default_strategy_id?: string | null;
  strategy_config?: StrategyConfig | null;
};

export type UpsertStrategyPreferences = Partial<
  Omit<UserStrategyPreferencesRow, "created_at" | "updated_at" | "user_id">
> & { user_id: string };

export async function fetchUserStrategyPreferences(
  userId: string
): Promise<UserStrategyPreferencesRow | null> {
  const { data, error } = await supabase
    .from("user_strategy_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UserStrategyPreferencesRow>();
  if (error) throw error;
  return data ?? null;
}

export async function upsertUserStrategyPreferences(
  payload: UpsertStrategyPreferences
): Promise<UserStrategyPreferencesRow> {
  const { data, error } = await supabase
    .from("user_strategy_preferences")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .maybeSingle<UserStrategyPreferencesRow>();
  if (error) throw error;
  return (
    data ?? {
      user_id: payload.user_id,
      trade_mode: "day",
      trade_pace: "auto",
      context_mode: "price_action",
      strategy_complexity: "simple",
      auto_apply_complexity: false,
      news_sentiment_enabled: false,
    }
  );
}

export async function clearUserStrategyPreferences(userId: string) {
  const { error } = await supabase
    .from("user_strategy_preferences")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

export async function upsertStrategyPreferences(
  userId: string,
  updates: StrategyPrefUpdate
) {
  const payload = {
    user_id: userId,
    ...updates,
  };

  const { data, error } = await supabase
    .from("user_strategy_preferences")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .maybeSingle<StrategyPreferenceRow>();

  if (error) throw error;
  return data ?? null;
}

export async function hydrateStrategyPreferences(
  userId: string
): Promise<StrategyPreferencesPayload | null> {
  const { data, error } = await supabase
    .from("user_strategy_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<StrategyPreferenceRow>();

  if (error) throw error;
  if (!data) return null;
  return {
    selected_strategy_group_id: data.selected_strategy_group_id ?? undefined,
    strategy_complexity: data.strategy_complexity,
    trade_mode: data.trade_mode,
    default_strategy_id: data.default_strategy_id ?? undefined,
    strategy_config: data.strategy_config ?? undefined,
  };
}

export default {
  fetchUserStrategyPreferences,
  upsertUserStrategyPreferences,
  clearUserStrategyPreferences,
  upsertStrategyPreferences,
  hydrateStrategyPreferences,
};
