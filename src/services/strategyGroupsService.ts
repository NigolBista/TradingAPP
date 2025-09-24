import { supabase } from "../lib/supabase";

export type StrategyGroup = {
  id: string;
  name: string;
  description?: string | null;
  owner_user_id: string;
  created_at: string;
};

export type StrategyGroupMember = {
  group_id: string;
  user_id: string;
  role: "owner" | "member";
  created_at: string;
};

export async function createStrategyGroup(params: {
  userId: string;
  name: string;
  description?: string;
}): Promise<StrategyGroup> {
  const { data, error } = await supabase
    .from("strategy_groups")
    .insert({
      name: params.name,
      description: params.description ?? null,
      owner_user_id: params.userId,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Owner automatically gets membership as owner
  const { error: memberErr } = await supabase
    .from("strategy_group_members")
    .insert({ group_id: data.id, user_id: params.userId, role: "owner" });
  if (memberErr) throw memberErr;
  return data as StrategyGroup;
}

export async function subscribeToGroup(params: {
  userId: string;
  groupId: string;
}): Promise<StrategyGroupMember> {
  const { data, error } = await supabase
    .from("strategy_group_members")
    .insert({
      group_id: params.groupId,
      user_id: params.userId,
      role: "member",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as StrategyGroupMember;
}

export async function listMyStrategyGroups(userId: string) {
  const { data, error } = await supabase
    .from("strategy_groups")
    .select("id, name, description, owner_user_id, created_at")
    .in(
      "id",
      (
        await supabase
          .from("strategy_group_members")
          .select("group_id")
          .eq("user_id", userId)
      ).data?.map((r: any) => r.group_id) || []
    );
  if (error) throw error;
  return data as StrategyGroup[];
}
