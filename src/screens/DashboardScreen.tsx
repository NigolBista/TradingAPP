import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import LightweightCandles from "../components/charts/LightweightCandles";
import { fetchCandles, fetchNews } from "../services/marketProviders";
import NewsList from "../components/insights/NewsList";
import { generateInsights } from "../services/ai";
import { analyzeNewsSentiment } from "../services/sentiment";
import dummyRaw from "../components/charts/dummyData.json";

function generateDummyCandles(count: number = 90, stepMs: number = 300000) {
  const now = Date.now();
  let price = 150;
  const out: any[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * stepMs;
    const open = price;
    const delta = (Math.random() - 0.5) * 2.5; // +/- ~1.25%
    const close = Math.max(1, open + delta);
    const high = Math.max(open, close) + Math.random() * 1.2;
    const low = Math.min(open, close) - Math.random() * 1.2;
    out.push({ time, open, high, low, close });
    price = close;
  }
  return out;
}

function parseDummyFromJson() {
  try {
    const series = (dummyRaw as any)["Weekly Time Series"] || {};
    const entries = Object.entries(series) as [string, any][];
    return entries
      .map(([date, v]) => ({
        time: new Date(date).getTime(),
        open: parseFloat(v["1. open"]),
        high: parseFloat(v["2. high"]),
        low: parseFloat(v["3. low"]),
        close: parseFloat(v["4. close"]),
      }))
      .sort((a, b) => a.time - b.time)
      .slice(-180);
  } catch {
    return [] as any[];
  }
}

export default function DashboardScreen() {
  const [symbol] = useState("AAPL");
  const [loading, setLoading] = useState(true);
  const [candles, setCandles] = useState<any[]>(parseDummyFromJson());
  const [news, setNews] = useState<any[]>([]);
  const [insight, setInsight] = useState("");
  const [sentiment, setSentiment] = useState<{
    label: string;
    score: number;
  } | null>(null);
  const [interval, setInterval] = useState<
    "1min" | "5min" | "15min" | "30min" | "60min" | "daily"
  >("daily");
  const [providerUsed, setProviderUsed] = useState<string>("");
  const [chartKind, setChartKind] = useState<
    "candlestick" | "area" | "line" | "bar"
  >("candlestick");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(candles.length === 0);
        const primary = await fetchCandles(symbol, { interval });
        let provider = "alphaVantage";
        let c = primary.length
          ? primary
          : await fetchCandles(symbol, { providerOverride: "yahoo" });
        if (!primary.length) provider = "yahoo";
        // Force use dummy data for now
        provider = "dummy";
        const series = (dummyRaw as any)["Weekly Time Series"] || {};
        const entries = Object.entries(series) as [string, any][];
        c = entries
          .map(([date, v]) => ({
            time: new Date(date).getTime(),
            open: parseFloat(v["1. open"]),
            high: parseFloat(v["2. high"]),
            low: parseFloat(v["3. low"]),
            close: parseFloat(v["4. close"]),
          }))
          .sort((a, b) => a.time - b.time)
          .slice(-180);
        if (!c.length) {
          c = generateDummyCandles(
            interval === "daily" ? 120 : 180,
            interval === "daily" ? 86_400_000 : 300_000
          );
        }
        const [n, ai] = await Promise.all([
          fetchNews(symbol),
          generateInsights({
            symbols: [symbol],
            skillLevel: "Intermediate",
            traderType: "Swing trader",
            timeframe: "today",
          }),
        ]);
        if (!isMounted) return;
        try {
          const sample = (c || []).slice(0, 5).map((k: any) => ({
            t: new Date(k.time).toISOString(),
            o: k.open,
            h: k.high,
            l: k.low,
            c: k.close,
          }));
          console.log("Candles", {
            symbol,
            interval,
            count: c?.length || 0,
            sample,
            provider,
          });
        } catch {}
        setCandles(c);
        setNews(n);
        setInsight(ai);
        setProviderUsed(provider);
        // sentiment
        const s = await analyzeNewsSentiment(n);
        setSentiment({ label: s.label, score: s.overallScore });
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [symbol, interval]);

  const chartData = useMemo(
    () =>
      candles.map((k) => ({
        x: new Date(k.time),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      })),
    [candles]
  );

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black">
      <View className="p-4">
        <Text className="text-2xl font-bold text-black dark:text-white">
          {symbol} • Price Action
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 mt-2">
          Candlesticks with moving averages
        </Text>
      </View>
      <View className="m-4 rounded-xl bg-white dark:bg-black">
        <View className="flex-row gap-2 px-2 pb-2 flex-wrap">
          {(["1min", "5min", "15min", "30min", "60min", "daily"] as const).map(
            (i) => (
              <Pressable
                key={i}
                onPress={() => setInterval(i)}
                className={`px-3 py-1 rounded-full ${
                  interval === i
                    ? "bg-indigo-600"
                    : "bg-gray-200 dark:bg-gray-800"
                }`}
              >
                <Text
                  className={`text-xs ${
                    interval === i ? "text-white" : "text-black dark:text-white"
                  }`}
                >
                  {i}
                </Text>
              </Pressable>
            )
          )}
          {["candlestick", "area", "line", "bar"].map((k) => (
            <Pressable
              key={k}
              onPress={() => setChartKind(k as any)}
              className={`px-3 py-1 rounded-full ${
                chartKind === k
                  ? "bg-emerald-600"
                  : "bg-gray-200 dark:bg-gray-800"
              }`}
            >
              <Text
                className={`text-xs ${
                  chartKind === k ? "text-white" : "text-black dark:text-white"
                }`}
              >
                {k}
              </Text>
            </Pressable>
          ))}
        </View>
        {loading ? (
          <View className="h-72 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : (
          <LightweightCandles data={candles} height={360} type={chartKind} />
        )}
      </View>

      <View className="px-4 mt-2 mb-3">
        <Text className="text-xl font-semibold text-black dark:text-white">
          Latest News
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 mt-1">
          Curated headlines related to {symbol}
          {sentiment
            ? ` • Sentiment: ${sentiment.label} (${sentiment.score.toFixed(2)})`
            : ""}
        </Text>
      </View>
      <NewsList items={news} />

      <View className="px-4 mt-6 mb-2">
        <Text className="text-xl font-semibold text-black dark:text-white">
          AI Outlook
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 mt-1">
          Not financial advice. Educational use only.
        </Text>
      </View>
      {insight ? (
        <View className="px-4 pb-6">
          <Text className="text-black dark:text-white leading-6">
            {insight}
          </Text>
        </View>
      ) : null}
      <View className="h-6" />
    </ScrollView>
  );
}
