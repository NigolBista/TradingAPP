import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL env");
}
if (!SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SERVICE_ROLE_KEY. Set SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY"
  );
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Payload sent from client
interface PublishSignalPayload {
  providerUserId: string;
  providerName?: string | null;
  groupId: string;
  groupName?: string | null;
  symbol: string;
  timeframe: string;
  entries: number[];
  exits: number[];
  tps: number[];
  side?: "buy" | "sell";
  confidence?: number | null;
  rationale?: string | null;
}

interface StrategyGroupMemberRow {
  user_id: string;
  role: "owner" | "member";
}

const MAX_LEVELS = 10;

function sanitizeLevels(levels: unknown): number[] {
  if (!Array.isArray(levels)) return [];
  const numbers = levels
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
  return numbers.slice(0, MAX_LEVELS);
}

function buildSignalNotificationPayload(payload: PublishSignalPayload) {
  return {
    title: `${payload.groupName || "Strategy"} shared ${payload.symbol}`,
    body: `New ${payload.timeframe} update. Tap to view levels`,
    data: {
      screen: "ChartFullScreen",
      symbol: payload.symbol,
      timeframe: payload.timeframe,
      entries: payload.entries,
      exits: payload.exits,
      tps: payload.tps,
      groupId: payload.groupId,
    },
  };
}

async function getGroupMembers(
  groupId: string
): Promise<StrategyGroupMemberRow[]> {
  const { data, error } = await supabase
    .from("strategy_group_members")
    .select("user_id, role")
    .eq("group_id", groupId);
  if (error) throw error;
  return data as StrategyGroupMemberRow[];
}

async function getGroup(groupId: string) {
  const { data, error } = await supabase
    .from("strategy_groups")
    .select("id, name, owner_user_id")
    .eq("id", groupId)
    .single();
  if (error) throw error;
  return data as { id: string; name: string; owner_user_id: string } | null;
}

function validatePayload(payload: PublishSignalPayload) {
  if (!payload.providerUserId || !payload.groupId) {
    throw new Error("Missing provider or group");
  }
  if (!payload.symbol || !payload.timeframe) {
    throw new Error("Missing symbol or timeframe");
  }
  payload.entries = sanitizeLevels(payload.entries);
  payload.exits = sanitizeLevels(payload.exits);
  payload.tps = sanitizeLevels(payload.tps);
}

async function insertTradeSignal(
  recipientUserId: string,
  payload: PublishSignalPayload
) {
  const { error } = await supabase.from("trade_signals").insert({
    user_id: recipientUserId,
    symbol: payload.symbol,
    kind: "entry",
    action: payload.side === "sell" ? "sell" : "buy",
    timeframe: payload.timeframe,
    confidence: payload.confidence ?? null,
    entry_price: payload.entries[0] ?? null,
    stop_loss: payload.exits[0] ?? null,
    targets: payload.tps.length > 0 ? payload.tps : null,
    rationale: payload.rationale ?? null,
    metadata: {
      group_id: payload.groupId,
      group_name: payload.groupName ?? null,
      provider_user_id: payload.providerUserId,
      provider_name: payload.providerName ?? null,
      entries: payload.entries,
      exits: payload.exits,
      tps: payload.tps,
    },
  });
  if (error) throw error;
}

async function enqueueNotification(
  recipientUserId: string,
  payload: PublishSignalPayload
) {
  const notificationPayload = buildSignalNotificationPayload(payload);
  const { error } = await supabase.from("notifications_queue").insert({
    user_id: recipientUserId,
    channel: "push",
    payload: notificationPayload,
    priority: 5,
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  try {
    const json = (await req.json()) as PublishSignalPayload;
    validatePayload(json);

    const group = await getGroup(json.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const members = await getGroupMembers(json.groupId);
    if (!members.some((m) => m.user_id === json.providerUserId)) {
      throw new Error("Provider is not a member of this group");
    }

    const recipients = members.map((m) => m.user_id);

    await Promise.all(
      recipients.map(async (userId) => {
        await insertTradeSignal(userId, json);
        await enqueueNotification(userId, json);
      })
    );

    return new Response(
      JSON.stringify({
        ok: true,
        recipients: recipients.length,
      }),
      {
        headers: { "content-type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
});
