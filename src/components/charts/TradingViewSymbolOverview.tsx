import React, { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { useColorScheme } from "react-native";

type Props = {
  symbol: string;
  height?: number;
  width?: string | number;
  theme?: "light" | "dark";
  colorTheme?: "light" | "dark";
  locale?: string;
  isTransparent?: boolean;
  autosize?: boolean;
  showSymbolLogo?: boolean;
  showCompanyName?: boolean;
  showFloatingTooltip?: boolean;
  displayMode?: "adaptive" | "regular" | "compact";
};

export default function TradingViewSymbolOverview({
  symbol,
  width = "100%",
  height = 400,
  theme,
  colorTheme,
  locale = "en",
  isTransparent = true,
  autosize = false,
  showSymbolLogo = true,
  showCompanyName = true,
  showFloatingTooltip = true,
  displayMode = "adaptive",
}: Props) {
  const scheme = useColorScheme();

  const resolvedTheme =
    theme || colorTheme || (scheme === "dark" ? "dark" : "light");

  const html = useMemo(() => {
    // Ensure symbol is properly formatted for TradingView
    let safeSymbol = (symbol || "AAPL").toUpperCase().trim();

    // If symbol doesn't include exchange, add NASDAQ for common US stocks
    if (!safeSymbol.includes(":")) {
      safeSymbol = `NASDAQ:${safeSymbol}`;
    }

    const widgetWidth = typeof width === "number" ? `${width}px` : width;
    const widgetHeight = autosize ? "100%" : `${height}px`;

    return `<!doctype html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      <style>
        html, body, #container { 
          margin: 0; 
          padding: 0; 
          height: 100%; 
          width: 100%; 
          background: ${
            isTransparent
              ? "transparent"
              : resolvedTheme === "dark"
              ? "#0a0a0a"
              : "#ffffff"
          }; 
        }
        .tradingview-widget-container {
          width: 100% !important;
          height: 100% !important;
          position: relative;
          overflow: hidden;
        }
        .tradingview-widget-container__widget {
          width: 100% !important;
          height: 100% !important;
        }
        /* Push embedded content to the right so the right scale is clipped */
        .tradingview-widget-container__widget iframe,
        .tradingview-widget-container iframe {
          width: calc(100% + 70px) !important; /* widen so rightmost 56px (price scale) are clipped */
          height: 100% !important;
          transform: none !important;
          display: block !important;
        }
        .tradingview-widget-copyright {
          display: none !important;
        }
      </style>
    </head>
    <body>
      <div id="container">
        <div class="tradingview-widget-container">
          <div class="tradingview-widget-container__widget"></div>
          <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js" async>
          {
            "symbols": [
              [
                "${safeSymbol}",
                "${safeSymbol}|1D"
              ]
            ],
            "chartOnly": false,
            "width": "100%",
            "height": "100%",
            "locale": "${locale}",
            "colorTheme": "${resolvedTheme}",
            "autosize": ${autosize},
            "showVolume": false,
            "showMA": false,
            "hideDateRanges": false,
            "hideMarketStatus": false,
            "hideSymbolLogo": ${!showSymbolLogo},
            "scalePosition": "none",
            "scaleMode": "Normal",
            "fontFamily": "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
            "fontSize": "10",
            "noTimeScale": false,
            "valuesTracking": "1",
            "changeMode": "price-and-percent",
            "chartType": "area",
            "maLineColor": "#2962FF",
            "maLineWidth": 1,
            "maLength": 9,
            "backgroundColor": "${
              isTransparent
                ? "rgba(255, 255, 255, 0)"
                : resolvedTheme === "dark"
                ? "rgba(10, 10, 10, 1)"
                : "rgba(255, 255, 255, 1)"
            }",
            "lineWidth": 2,
            "lineType": 0,
            "dateRanges": [
              "1d|1",
              "1m|30",
              "3m|60",
              "12m|1D",
              "60m|1W",
              "all|1M"
            ]
          }
          </script>
        </div>
      </div>
    </body>
    </html>`;
  }, [
    symbol,
    width,
    height,
    resolvedTheme,
    locale,
    isTransparent,
    autosize,
    showSymbolLogo,
    showCompanyName,
    showFloatingTooltip,
    displayMode,
  ]);

  return (
    <View style={{ height, width: "100%", backgroundColor: "transparent" }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{
          height,
          width: "100%",
          backgroundColor: "transparent",
        }}
        containerStyle={{ backgroundColor: "transparent" }}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}
