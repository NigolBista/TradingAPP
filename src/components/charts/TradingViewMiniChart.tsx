import React, { useMemo, useState } from "react";
import { View, useColorScheme, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
  symbol: string;
  width?: number | string;
  height?: number;
  theme?: "light" | "dark";
  colorTheme?: "light" | "dark";
  trendLineColor?: string;
  underLineColor?: string;
  underLineBottomColor?: string;
  locale?: string;
  dateRange?: "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "ALL";
  isTransparent?: boolean;
  autosize?: boolean;
  largeChartUrl?: string;
};

export default function TradingViewMiniChart({
  symbol,
  width = "100%",
  height = 220,
  theme,
  colorTheme,
  trendLineColor = "#37a6ef",
  underLineColor = "rgba(55, 166, 239, 0.12)",
  underLineBottomColor = "rgba(55, 166, 239, 0)",
  locale = "en",
  dateRange = "1D",
  isTransparent = true,
  autosize = false,
  largeChartUrl = "",
}: Props) {
  const scheme = useColorScheme();
  const resolvedTheme =
    theme || colorTheme || (scheme === "dark" ? "dark" : "light");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const html = useMemo(() => {
    // Ensure symbol is properly formatted for TradingView
    let safeSymbol = (symbol || "AAPL").toUpperCase().trim();

    // If symbol doesn't include exchange, add NASDAQ for common US stocks
    if (!safeSymbol.includes(":")) {
      safeSymbol = `NASDAQ:${safeSymbol}`;
    }

    const widgetWidth = typeof width === "number" ? `${width}px` : width;
    const widgetHeight = autosize ? "100%" : `${height}px`;

    // Map dateRange to TradingView interval
    const getInterval = (range: string) => {
      switch (range) {
        case "1D":
          return "5"; // 5 minute intervals for 1 day
        case "5D":
          return "30"; // 30 minute intervals for 5 days (1 week view)
        case "1M":
          return "60"; // 1 hour intervals for 1 month
        case "3M":
          return "240"; // 4 hour intervals for 3 months
        case "6M":
        case "YTD":
        case "1Y":
          return "D"; // Daily intervals for 1 year
        case "5Y":
        case "ALL":
        default:
          return "W"; // Weekly intervals for 5 years and beyond
      }
    };

    const interval = getInterval(dateRange);

    return `<!doctype html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      <style>
        html, body, #container { 
          margin: 0; 
          padding: 0; 
          height: 100%; 
          width: 100%; 
          background: #0a0a0a; 
        }
        #tvchart { 
          position: absolute; 
          inset: 0; 
        }
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
                interval: ${JSON.stringify(interval)},
                container_id: "tvchart",
                autosize: true,
                theme: ${JSON.stringify(resolvedTheme)},
                style: "1",
                locale: ${JSON.stringify(locale)},
                hide_top_toolbar: true,
                allow_symbol_change: false,
                hide_legend: true,
                enable_publishing: false,
                withdateranges: false,
                studies: [],
                timezone: "Etc/UTC",
                toolbar_bg: "#0a0a0a",
                overrides: {
                  "paneProperties.background": "#0a0a0a",
                  "paneProperties.vertGridProperties.color": "#363c4e",
                  "paneProperties.horzGridProperties.color": "#363c4e",
                  "symbolWatermarkProperties.transparency": 90,
                  "scalesProperties.textColor": "#AAA",
                  "mainSeriesProperties.candleStyle.wickUpColor": "${trendLineColor}",
                  "mainSeriesProperties.candleStyle.wickDownColor": "#ff5252",
                  "mainSeriesProperties.candleStyle.upColor": "${trendLineColor}",
                  "mainSeriesProperties.candleStyle.downColor": "#ff5252",
                  "mainSeriesProperties.candleStyle.borderUpColor": "${trendLineColor}",
                  "mainSeriesProperties.candleStyle.borderDownColor": "#ff5252"
                }
              });
            } catch (e) {
              console.error("TradingView widget error:", e);
            }
          }

          if (window.TradingView && window.TradingView.widget) {
            createWidget();
          } else {
            var script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.onload = createWidget;
            script.onerror = function() {
              console.error("Failed to load TradingView script");
            };
            document.head.appendChild(script);
          }
        })();
      </script>
    </body>
    </html>`;
  }, [
    symbol,
    width,
    height,
    resolvedTheme,
    trendLineColor,
    underLineColor,
    underLineBottomColor,
    locale,
    dateRange,
    isTransparent,
    autosize,
    largeChartUrl,
  ]);

  return (
    <View
      style={{
        height: autosize ? "100%" : height,
        width: "100%",
        backgroundColor: isTransparent
          ? "#0a0a0a"
          : resolvedTheme === "dark"
          ? "#131722"
          : "#ffffff",
      }}
    >
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{
          height: autosize ? "100%" : height,
          width: "100%",
          backgroundColor: "#0a0a0a",
        }}
        containerStyle={{ backgroundColor: "#0a0a0a" }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn("WebView error: ", nativeEvent);
          setHasError(true);
          setIsLoading(false);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn("WebView HTTP error: ", nativeEvent);
          setHasError(true);
          setIsLoading(false);
        }}
        onLoadStart={() => {
          console.log("TradingView Mini Chart loading...");
          setIsLoading(true);
          setHasError(false);
        }}
        onLoadEnd={() => {
          console.log("TradingView Mini Chart loaded");
          setIsLoading(false);
        }}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />

      {/* Loading overlay */}
      {isLoading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#0a0a0a",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={{ color: "#888", marginTop: 8, fontSize: 12 }}>
            Loading chart for {symbol}...
          </Text>
        </View>
      )}

      {/* Error overlay */}
      {hasError && !isLoading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#0a0a0a",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <Text
            style={{
              color: "#ff5252",
              fontSize: 14,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            Chart Unavailable
          </Text>
          <Text
            style={{
              color: "#888",
              fontSize: 12,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            Unable to load chart for {symbol}
          </Text>
        </View>
      )}
    </View>
  );
}
