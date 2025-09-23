import { supabase } from "../lib/supabase";

export type UserChartLayout = {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  timeframe?: string | null;
  chart_type?: string | null;
  show_volume?: boolean | null;
  show_ma?: boolean | null;
  show_sessions?: boolean | null;
  indicators?: any | null; // JSON array of IndicatorConfig
  updated_at?: string | null;
  created_at?: string | null;
};

type LayoutInsert = Omit<
  UserChartLayout,
  "id" | "updated_at" | "created_at"
> & {
  id?: string;
};

function table() {
  return supabase.from("user_chart_settings");
}

export async function listUserChartLayouts(
  userId: string
): Promise<UserChartLayout[]> {
  const { data, error } = await table()
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as UserChartLayout[]) || [];
}

export async function getUserChartLayoutById(
  userId: string,
  id: string
): Promise<UserChartLayout | null> {
  const { data, error } = await table()
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .single();
  if (error) return null;
  return data as UserChartLayout;
}

export async function getDefaultUserChartLayout(
  userId: string
): Promise<UserChartLayout | null> {
  // Prefer explicit default, else most recently updated
  const { data, error } = await table()
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length ? (data[0] as UserChartLayout) : null;
}

export async function createUserChartLayout(
  layout: LayoutInsert
): Promise<UserChartLayout> {
  const payload: any = { ...layout };
  if (payload.symbol !== undefined) delete payload.symbol; // ignore legacy column if present in callers

  // If creating a default, unset others for this user first
  if (payload.is_default) {
    await table().update({ is_default: false }).eq("user_id", payload.user_id);
  }

  const { data, error } = await table().insert(payload).select("*").single();
  if (error) throw error;
  return data as UserChartLayout;
}

export async function updateUserChartLayout(
  userId: string,
  id: string,
  updates: Partial<Omit<UserChartLayout, "id" | "user_id">>
): Promise<UserChartLayout> {
  const payload: any = { ...updates };
  if (payload.symbol !== undefined) delete payload.symbol; // ignore legacy

  if (payload.is_default === true) {
    await table().update({ is_default: false }).eq("user_id", userId);
  }

  const { data, error } = await table()
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as UserChartLayout;
}

export async function setDefaultUserChartLayout(
  userId: string,
  id: string
): Promise<void> {
  await table().update({ is_default: false }).eq("user_id", userId);
  const { error } = await table()
    .update({ is_default: true })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteUserChartLayout(
  userId: string,
  id: string
): Promise<void> {
  const { error } = await table().delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

// Backwards-compat wrappers used by existing screens
export async function getUserChartSettings(
  userId: string
): Promise<UserChartLayout | null> {
  return getDefaultUserChartLayout(userId);
}

export async function upsertUserChartSettings(
  row: Partial<UserChartLayout> & { user_id: string }
): Promise<UserChartLayout> {
  // If an id is provided, update that layout; otherwise update/create the default
  if (row.id) {
    return updateUserChartLayout(row.user_id, row.id, row as any);
  }
  const existing = await getDefaultUserChartLayout(row.user_id);
  if (existing) {
    return updateUserChartLayout(row.user_id, existing.id, row as any);
  }
  return createUserChartLayout({
    user_id: row.user_id,
    name: (row as any).name || "Default",
    is_default: true,
    timeframe: row.timeframe ?? null,
    chart_type: row.chart_type ?? null,
    show_volume: row.show_volume ?? null,
    show_ma: row.show_ma ?? null,
    show_sessions: row.show_sessions ?? null,
    indicators: row.indicators ?? null,
  });
}

export default {
  listUserChartLayouts,
  getUserChartLayoutById,
  getDefaultUserChartLayout,
  createUserChartLayout,
  updateUserChartLayout,
  setDefaultUserChartLayout,
  deleteUserChartLayout,
  // legacy wrappers
  getUserChartSettings,
  upsertUserChartSettings,
};
