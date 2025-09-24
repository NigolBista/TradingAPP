import { supabase } from "../lib/supabase";
import type { DraftPlan } from "../store/composeDraftStore";

export type RemoteDraftPlan = {
  id: string;
  user_id: string;
  symbol: string;
  entries: number[] | null;
  exits: number[] | null;
  tps: number[] | null;
  updated_at: string;
  created_at: string;
};

const UUID_CONFLICT_TARGET = "user_id,symbol";

function table() {
  return supabase.from("user_trade_drafts");
}

function toNumericArray(value: number[] | null | undefined): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => Number(v))
    .filter((v) => typeof v === "number" && Number.isFinite(v));
}

export function mapRemoteDraftPlan(row: RemoteDraftPlan): DraftPlan {
  return {
    entries: toNumericArray(row.entries),
    exits: toNumericArray(row.exits),
    tps: toNumericArray(row.tps),
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
  };
}

export async function fetchUserDraftPlan(
  userId: string,
  symbol: string
): Promise<RemoteDraftPlan | null> {
  const { data, error } = await table()
    .select("*")
    .eq("user_id", userId)
    .eq("symbol", symbol)
    .maybeSingle();
  if (error) throw error;
  return (data as RemoteDraftPlan) ?? null;
}

export async function upsertUserDraftPlan(params: {
  userId: string;
  symbol: string;
  draft: DraftPlan;
}): Promise<RemoteDraftPlan> {
  const { draft } = params;
  const payload = {
    user_id: params.userId,
    symbol: params.symbol,
    entries: toNumericArray(draft.entries),
    exits: toNumericArray(draft.exits),
    tps: toNumericArray(draft.tps),
    updated_at: new Date(
      typeof draft.updatedAt === "number" ? draft.updatedAt : Date.now()
    ).toISOString(),
  };

  const { data, error } = await table()
    .upsert(payload, { onConflict: UUID_CONFLICT_TARGET })
    .select("*")
    .single();
  if (error) throw error;
  return data as RemoteDraftPlan;
}

export async function deleteUserDraftPlan(
  userId: string,
  symbol: string
): Promise<void> {
  const { error } = await table()
    .delete()
    .eq("user_id", userId)
    .eq("symbol", symbol);
  if (error) throw error;
}

export default {
  fetchUserDraftPlan,
  upsertUserDraftPlan,
  deleteUserDraftPlan,
  mapRemoteDraftPlan,
};

