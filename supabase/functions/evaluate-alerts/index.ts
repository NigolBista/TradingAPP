// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SERVICE_ROLE_KEY");
if (!SERVICE_ROLE) {
  throw new Error("Missing service role key. Set SERVICE_ROLE_KEY");
}
const POLYGON_API_KEY = Deno.env.get("POLYGON_API_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// simple price fetch (last trade). Replace with snapshots/aggregates if you prefer.
async function getPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${POLYGON_API_KEY}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.results?.p ?? null;
  } catch {
    return null;
  }
}

function shouldTrigger(
  cond: string,
  lastPrice: number | null | undefined,
  current: number,
  level: number
) {
  switch (cond) {
    case "above":
      return current > level;
    case "below":
      return current < level;
    case "crosses_above":
      return lastPrice != null && lastPrice <= level && current > level;
    case "crosses_below":
      return lastPrice != null && lastPrice >= level && current < level;
    default:
      return false;
  }
}

Deno.serve(async (req) => {
  try {
    // fetch active alerts
    const { data: alerts, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("is_active", true);
    if (error) throw error;

    // group by symbol, get prices
    const symbols = Array.from(new Set((alerts ?? []).map((a) => a.symbol)));
    const priceMap = new Map<string, number>();
    for (const s of symbols) {
      const p = await getPrice(s);
      if (p != null) priceMap.set(s, p);
    }

    let fired = 0;
    for (const a of alerts ?? []) {
      const current = priceMap.get(a.symbol);
      if (current == null) continue;

      const trigger = shouldTrigger(
        a.condition,
        a.last_price,
        current,
        a.price
      );
      // always update last_price
      await supabase
        .from("alerts")
        .update({ last_price: current })
        .eq("id", a.id);

      if (!trigger) continue;

      // mark alert and emit event
      await supabase
        .from("alerts")
        .update({ is_active: false, triggered_at: new Date().toISOString() })
        .eq("id", a.id);

      const title = `${a.symbol} Alert`;
      const body = `${a.condition.replace("_", " ")} ${a.symbol} at $${Number(
        a.price
      ).toFixed(2)} (now $${current.toFixed(2)})`;

      await supabase.from("alert_events").insert({
        user_id: a.user_id,
        alert_id: a.id,
        symbol: a.symbol,
        price: current,
        condition: a.condition,
      });

      // enqueue push
      await supabase.from("notifications_queue").insert({
        user_id: a.user_id,
        channel: "push",
        payload: {
          title,
          body,
          data: { symbol: a.symbol, condition: a.condition, price: current },
        },
        status: "queued",
        scheduled_at: new Date().toISOString(),
        priority: 5,
      });

      fired++;
    }

    // Immediately process queued notifications for instant delivery
    try {
      const notifyUrl = `${SUPABASE_URL}/functions/v1/notify`;
      await fetch(notifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({ reason: "alerts-fired" }),
      });
    } catch (_) {}

    return new Response(
      JSON.stringify({ ok: true, symbols: symbols.length, fired }),
      {
        headers: { "content-type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
