import { supabase } from "../lib/supabase";

type WatchlistRow = {
  user_id: string;
  symbol: string;
  is_favorite: boolean;
  added_at: string | null;
};

function table() {
  return supabase.from("user_watchlist");
}

export async function fetchUserWatchlist(
  userId: string
): Promise<Array<{ symbol: string; isFavorite: boolean; addedAt?: string }>> {
  const { data, error } = await table()
    .select("symbol,is_favorite,added_at")
    .eq("user_id", userId)
    .order("symbol", { ascending: true });
  if (error) throw error;
  return (data as WatchlistRow[]).map((r) => ({
    symbol: r.symbol,
    isFavorite: !!r.is_favorite,
    addedAt: r.added_at || undefined,
  }));
}

export async function syncUserWatchlist(
  userId: string,
  items: Array<{ symbol: string; isFavorite: boolean }>
): Promise<void> {
  // Fetch existing symbols
  const { data: existing, error: fetchErr } = await table()
    .select("symbol")
    .eq("user_id", userId);
  if (fetchErr) throw fetchErr;
  const existingSet = new Set((existing || []).map((r: any) => r.symbol));
  const nextSet = new Set(items.map((i) => i.symbol));

  // Delete rows no longer present
  const toDelete = Array.from(existingSet).filter((s) => !nextSet.has(s));
  if (toDelete.length) {
    const { error: delErr } = await table()
      .delete()
      .eq("user_id", userId)
      .in("symbol", toDelete as any);
    if (delErr) throw delErr;
  }

  // Upsert current set
  if (items.length) {
    const rows = items.map((i) => ({
      user_id: userId,
      symbol: i.symbol.toUpperCase(),
      is_favorite: !!i.isFavorite,
      added_at: new Date().toISOString(),
    }));
    const { error: upErr } = await table()
      .upsert(rows, { onConflict: "user_id,symbol" })
      .select();
    if (upErr) throw upErr;
  }
}

export default {
  fetchUserWatchlist,
  syncUserWatchlist,
};
