import React from "react";
import { View, useColorScheme } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
  symbol: string; // e.g. "AAPL" or "NASDAQ:AAPL"
  height?: number;
  interval?: "1" | "5" | "15" | "30" | "60" | "120" | "240" | "D" | "W" | "M";
  theme?: "light" | "dark";
};

export default function TradingViewChart({
  symbol,
  height = 560,
  interval = "D",
  theme,
}: Props) {
  const scheme = useColorScheme();
  const resolvedTheme = theme || (scheme === "dark" ? "dark" : "light");

  // Ensure the symbol has an exchange prefix; default to NASDAQ
  const normalizedSymbol = symbol.includes(":") ? symbol : `NASDAQ:${symbol}`;

  const html = `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,body,#wrap{margin:0;padding:0;height:100%;width:100%;}
      #container{position:relative;height:100%;width:100%;}
    </style>
    </head><body>
    <div id="wrap">
      <div id="tradingview_container" style="height:100%;width:100%"></div>
    </div>
    <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
    <script type="text/javascript">
      function init() {
        if (!window.TradingView) {
          setTimeout(init, 100);
          return;
        }
        try {
          new window.TradingView.widget({
            width: "100%",
            height: "100%",
            autosize: true,
            symbol: ${JSON.stringify(normalizedSymbol)},
            interval: ${JSON.stringify(interval)},
            timezone: "Etc/UTC",
            theme: ${JSON.stringify(resolvedTheme)},
            style: "1",
            locale: "en",
            toolbar_bg: "transparent",
            enable_publishing: false,
            hide_top_toolbar: false,
            hide_legend: false,
            withdateranges: true,
            allow_symbol_change: true,
            calendar: true,
            details: true,
            hotlist: false,
            studies: [
              "VWAP@tv-basicstudies",
              "MACD@tv-basicstudies",
              "RSI@tv-basicstudies",
              // Simple/Exponential moving averages
              "MAExp@tv-basicstudies",
              "MASimple@tv-basicstudies"
            ],
            container_id: "tradingview_container"
          });
        } catch (e) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ error: e.message }));
        }
      }
      init();
    </script>
  </body></html>`;

  return (
    <View
      style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }}
    >
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ height, width: "100%" }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled={false}
        mixedContentMode="always"
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            console.log("TradingViewChart message:", msg);
          } catch {
            console.log("TradingViewChart message:", e.nativeEvent.data);
          }
        }}
        onError={(e) => {
          console.warn("TradingViewChart WebView error:", e.nativeEvent);
        }}
      />
    </View>
  );
}
