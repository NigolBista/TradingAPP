import React, { useMemo } from "react";
import { View, useColorScheme } from "react-native";
import { WebView } from "react-native-webview";

type TVInterval =
  | "1"
  | "5"
  | "15"
  | "30"
  | "60"
  | "120"
  | "240"
  | "D"
  | "W"
  | "M";

type Props = {
  symbol: string;
  height?: number;
  interval?: TVInterval;
  theme?: "light" | "dark";
  allowSymbolChange?: boolean;
  hideTopToolbar?: boolean;
};

export default function TradingViewWidget({
  symbol,
  height = 320,
  interval = "D",
  theme,
  allowSymbolChange = true,
  hideTopToolbar = false,
}: Props) {
  const scheme = useColorScheme();
  const resolvedTheme = theme || (scheme === "dark" ? "dark" : "light");

  const html = useMemo(() => {
    const safeSymbol = (symbol || "AAPL").toUpperCase();
    const tvTheme = resolvedTheme === "dark" ? "dark" : "light";
    const hideTop = hideTopToolbar ? "true" : "false";
    const allowChange = allowSymbolChange ? "true" : "false";
    const intv = interval;

    return `<!doctype html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      <style>
        html, body, #container { margin: 0; padding: 0; height: 100%; width: 100%; background: transparent; }
        #tvchart { position: absolute; inset: 0; }
      </style>
    </head>
    <body>
      <div id="container">
        <div id="tvchart"></div>
      </div>
      <script type="text/javascript">
        (function() {
          function createWidget() {
            if (!window.TradingView || !document.getElementById('tvchart')) return;
            try {
              new TradingView.widget({
                symbol: ${JSON.stringify(safeSymbol)},
                interval: ${JSON.stringify(intv)},
                container_id: "tvchart",
                autosize: true,
                theme: ${JSON.stringify(tvTheme)},
                style: "1",
                locale: "en",
                hide_top_toolbar: ${hideTop},
                allow_symbol_change: ${allowChange},
                hide_legend: false,
                enable_publishing: false,
                withdateranges: true,
                studies: [],
                timezone: "Etc/UTC",
              });
            } catch (e) {
              // no-op
            }
          }

          if (window.TradingView && window.TradingView.widget) {
            createWidget();
          } else {
            var script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.onload = createWidget;
            document.head.appendChild(script);
          }
        })();
      </script>
    </body>
    </html>`;
  }, [symbol, interval, resolvedTheme, allowSymbolChange, hideTopToolbar]);

  return (
    <View style={{ height, width: "100%", backgroundColor: "transparent" }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ height, width: "100%", backgroundColor: "transparent" }}
        containerStyle={{ backgroundColor: "transparent" }}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
