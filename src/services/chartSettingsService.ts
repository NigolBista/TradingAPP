import { supabase } from "../lib/supabase";

export type UserChartSettings = {
  id?: string;
  user_id: string;
  symbol?: string | null;
  timeframe?: string | null;
  chart_type?: string | null;
  show_volume?: boolean | null;
  show_ma?: boolean | null;
  show_sessions?: boolean | null;
  indicators?: any | null; // JSON array of IndicatorConfig
  updated_at?: string | null;
  created_at?: string | null;
};

function table() {
  return supabase.from("user_chart_settings");
}

export async function getUserChartSettings(
  userId: string,
  symbol?: string
): Promise<UserChartSettings | null> {
  const key = symbol ?? "";
  const { data, error } = await table()
    .select("*")
    .eq("user_id", userId)
    .eq("symbol", key)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length ? (data[0] as UserChartSettings) : null;
}

export async function upsertUserChartSettings(
  row: UserChartSettings
): Promise<UserChartSettings> {
  const toUpsert = { ...row, symbol: row.symbol ?? "" } as UserChartSettings;
  const { data, error } = await table()
    .upsert(toUpsert, { onConflict: "user_id,symbol" })
    .select()
    .single();
  if (error) throw error;
  return data as UserChartSettings;
}

export default {
  getUserChartSettings,
  upsertUserChartSettings,
};
