import { supabase } from "../shared/lib/supabase";

export type PolyAggregateRow = {
  id: number;
  symbol: string;
  t: string; // timestamptz
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number;
  vw?: number | null;
  scenario_id?: string | null;
  inserted_at?: string | null;
};

export type AlertEventRow = {
  id: string;
  user_id: string;
  alert_id: string;
  symbol: string;
  price: number;
  condition: "above" | "below" | "crosses_above" | "crosses_below";
  fired_at: string; // timestamptz
};

type Unsubscribe = () => void;

export const barsService = {
  subscribeBars(
    symbol: string,
    onInsert: (bar: PolyAggregateRow) => void
  ): Unsubscribe {
    const channel = supabase.channel(`bars:${symbol}`);

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "poly_aggregates",
        filter: `symbol=eq.${symbol}`,
      },
      (payload) => {
        // payload.new contains the inserted row
        onInsert(payload.new as PolyAggregateRow);
      }
    );

    channel.subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  },

  subscribeAlertEvents(onInsert: (evt: AlertEventRow) => void): Unsubscribe {
    const channel = supabase.channel("alert_events");

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "alert_events",
      },
      (payload) => {
        onInsert(payload.new as AlertEventRow);
      }
    );

    channel.subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  },
};

export default barsService;
