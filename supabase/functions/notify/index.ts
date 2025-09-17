// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE =
  Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SERVICE_ROLE) {
  throw new Error(
    "Missing service role key. Set SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY"
  );
}
const EXPO_ACCESS_TOKEN = Deno.env.get("EXPO_ACCESS_TOKEN") || "";
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sendPush(
  to: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ to, title, body, sound: "default", data }),
  });
  return res.ok;
}

Deno.serve(async () => {
  try {
    // pull a small batch of ready jobs
    const nowIso = new Date().toISOString();
    const { data: jobs, error } = await supabase
      .from("notifications_queue")
      .select("*")
      .in("status", ["queued", "retrying"])
      .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;

    let sent = 0;

    for (const job of jobs ?? []) {
      // lock job
      await supabase
        .from("notifications_queue")
        .update({ status: "processing", locked_at: new Date().toISOString() })
        .eq("id", job.id);

      // devices
      const { data: devices, error: devErr } = await supabase
        .from("user_devices")
        .select("expo_push_token")
        .eq("user_id", job.user_id);
      if (devErr) {
        await supabase
          .from("notifications_queue")
          .update({
            status: "retrying",
            attempts: (job.attempts ?? 0) + 1,
            scheduled_at: new Date(Date.now() + 60_000).toISOString(),
            error: String(devErr),
          })
          .eq("id", job.id);
        continue;
      }
      if (!devices || devices.length === 0) {
        await supabase
          .from("notifications_queue")
          .update({ status: "failed", error: "no devices" })
          .eq("id", job.id);
        continue;
      }

      const payload = job.payload ?? {};
      const title = payload.title ?? "Notification";
      const body = payload.body ?? "";
      const data = payload.data ?? undefined;

      let allOk = true;
      for (const d of devices) {
        const ok = await sendPush(d.expo_push_token, title, body, data);
        allOk = allOk && ok;
      }

      if (allOk) {
        await supabase
          .from("notifications_queue")
          .update({ status: "succeeded" })
          .eq("id", job.id);
        sent++;
      } else {
        await supabase
          .from("notifications_queue")
          .update({
            status: "retrying",
            attempts: (job.attempts ?? 0) + 1,
            scheduled_at: new Date(
              Date.now() + Math.min(5, (job.attempts ?? 0) + 1) * 60_000
            ).toISOString(), // backoff up to 5m
            error: "push failed",
          })
          .eq("id", job.id);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: jobs?.length ?? 0, sent }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
