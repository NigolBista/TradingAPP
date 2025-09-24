import { supabase } from "../lib/supabase";

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

function table() {
  return supabase.from("user_strategy_preferences");
}

export async function fetchUserStrategyPreferences(
  userId: string
): Promise<UserStrategyPreferencesRow | null> {
  const { data, error } = await table()
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as UserStrategyPreferencesRow) ?? null;
}

export type UpsertStrategyPreferences = Partial<
  Omit<UserStrategyPreferencesRow, "created_at" | "updated_at" | "user_id">
> & { user_id: string };

export async function upsertUserStrategyPreferences(
  payload: UpsertStrategyPreferences
): Promise<UserStrategyPreferencesRow> {
  const { data, error } = await table()
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (
    (data as UserStrategyPreferencesRow) ?? {
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
  const { error } = await table().delete().eq("user_id", userId);
  if (error) throw error;
}

export default {
  fetchUserStrategyPreferences,
  upsertUserStrategyPreferences,
  clearUserStrategyPreferences,
};
