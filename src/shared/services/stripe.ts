// @ts-nocheck
import { supabase } from "../lib/supabase";

export async function getCustomerPortalUrl(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke(
    "create-portal-session",
    {}
  );
  if (error) return null;
  return (data as any)?.url ?? null;
}

export async function isFeatureAvailable(
  tier: "Free" | "Pro" | "Elite",
  feature: string
): Promise<boolean> {
  const tierMap: Record<string, number> = { Free: 0, Pro: 1, Elite: 2 };
  const featureMin: Record<string, number> = {
    realtimeData: 1,
    unlimitedWatchlist: 1,
    advancedAI: 1,
    premiumCoaching: 2,
  };
  return (tierMap[tier] ?? 0) >= (featureMin[feature] ?? 0);
}
