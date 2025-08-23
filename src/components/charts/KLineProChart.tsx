import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";

type SupportedTimeframe =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "45m"
  | "1h"
  | "2h"
  | "4h"
  | "1d"
  | "1w"
  | "1M"
  | "3M"
  | "6M"
  | "1Y";

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  locale?: "en-US" | "zh-CN";
  theme?: "dark" | "light";
  market?: "stocks" | "crypto" | "forex"; // Polygon market routing
}

function mapTimeframeToPeriod(tf: string | undefined): {
  multiplier: number;
  timespan: string;
  text: string;
} {
  const raw = (tf || "1d") as string;
  const lower = raw.toLowerCase();
  if (lower.endsWith("m") && !/[a-z]$/.test(raw.replace(/[0-9]/g, ""))) {
    const n = parseInt(lower.replace("m", "")) || 1;
    return { multiplier: n, timespan: "minute", text: `${n}m` };
  }
  if (lower.endsWith("h")) {
    const n = parseInt(lower.replace("h", "")) || 1;
    return { multiplier: n, timespan: "hour", text: `${n}h` };
  }
  if (lower === "1d") return { multiplier: 1, timespan: "day", text: "1D" };
  if (lower === "1w") return { multiplier: 1, timespan: "week", text: "1W" };
  if (raw === "1M") return { multiplier: 1, timespan: "month", text: "1M" };
  if (raw === "3M") return { multiplier: 3, timespan: "month", text: "3M" };
  if (raw === "6M") return { multiplier: 6, timespan: "month", text: "6M" };
  if (raw === "1Y") return { multiplier: 1, timespan: "year", text: "1Y" };
  return { multiplier: 1, timespan: "day", text: "1D" };
}

const DEFAULT_PERIODS = [
  { multiplier: 1, timespan: "minute", text: "1m" },
  { multiplier: 5, timespan: "minute", text: "5m" },
  { multiplier: 15, timespan: "minute", text: "15m" },
  { multiplier: 1, timespan: "hour", text: "1h" },
  { multiplier: 4, timespan: "hour", text: "4h" },
  { multiplier: 1, timespan: "day", text: "1D" },
  { multiplier: 1, timespan: "week", text: "1W" },
  { multiplier: 1, timespan: "month", text: "1M" },
];

export default function KLineProChart({
  symbol,
  timeframe = "1d",
  height = 280,
  locale = "en-US",
  theme = "dark",
  market = "stocks",
}: Props) {
  const polygonApiKey: string | undefined = (Constants.expoConfig?.extra as any)
    ?.polygonApiKey;

  const period = useMemo(
    () => mapTimeframeToPeriod(timeframe as SupportedTimeframe),
    [timeframe]
  );

  const html = useMemo(() => {
    const cssHref =
      "https://unpkg.com/@klinecharts/pro@0.1.1/dist/klinecharts-pro.css";
    const klinechartsSrc =
      "https://unpkg.com/klinecharts@9.8.12/dist/umd/klinecharts.min.js";
    const proSrc =
      "https://unpkg.com/@klinecharts/pro@0.1.1/dist/klinecharts-pro.umd.js";
    const safeSymbol = (symbol || "AAPL").toUpperCase();
    const apiKey = polygonApiKey || "";

    return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="${cssHref}" />
    <style>
      html, body { margin: 0; padding: 0; background: ${
        theme === "dark" ? "#0a0a0a" : "#ffffff"
      }; }
      #app { width: 100%; height: ${height}px; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="${klinechartsSrc}"></script>
    <script src="${proSrc}"></script>
    <script>
      (function(){
        function post(msg){ try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {} }
        window.onerror = function(m, s, l, c, e){ post({ error: m || (e && e.message) || 'unknown' }); };
        (function(){ var ce = console.error, cl = console.log; console.error = function(){ try{ post({ consoleError: Array.from(arguments).join(' ') }); }catch(_){} ce && ce.apply(console, arguments); }; console.log = function(){ try{ post({ consoleLog: Array.from(arguments).join(' ') }); }catch(_){} cl && cl.apply(console, arguments); }; })();
        function create(){
          try {
            if (!window.klinechartspro) { return false; }
            const { KLineChartPro, DefaultDatafeed } = window.klinechartspro;
            if (!${JSON.stringify(
              !!apiKey
            )}) { post({ warn: 'Missing POLYGON_API_KEY (extra.polygonApiKey)' }); }
            const datafeed = new DefaultDatafeed(${JSON.stringify(apiKey)});
            const chart = new KLineChartPro({
              container: document.getElementById('app'),
              theme: ${JSON.stringify(theme)},
              locale: ${JSON.stringify(locale)},
              symbol: { ticker: ${JSON.stringify(
                safeSymbol
              )}, market: ${JSON.stringify(
      market
    )}, exchange: 'XNAS', priceCurrency: 'usd', shortName: ${JSON.stringify(
      safeSymbol
    )} },
              period: ${JSON.stringify(period)},
              periods: ${JSON.stringify(DEFAULT_PERIODS)},
              datafeed
            });
            post({ ready: true, symbol: ${JSON.stringify(
              safeSymbol
            )}, period: ${JSON.stringify(period)} });
            return true;
          } catch (err) { post({ error: String(err && err.message || err) }); return false; }
        }
        function init(){ if (!create()) { var tries = 0; var t = setInterval(function(){ tries++; if (create() || tries>50) clearInterval(t); }, 100); } }
        if (document.readyState === 'complete' || document.readyState === 'interactive') { init(); } else { document.addEventListener('DOMContentLoaded', init); }
      })();
    </script>
  </body>
</html>`;
  }, [height, locale, market, period, polygonApiKey, symbol, theme]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ height, width: "100%" }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled={false}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (__DEV__) console.log("KLineProChart:", msg);
          } catch (err) {
            if (__DEV__) console.log("KLineProChart:", e.nativeEvent.data);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    width: "100%",
  },
});
