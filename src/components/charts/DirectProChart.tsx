import React, { useRef, useImperativeHandle, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";

export interface OverlayOptions {
  name: string;
  points: Array<{
    timestamp?: number;
    value: number;
  }>;
  styles?: {
    line?: {
      color?: string;
      size?: number;
      style?: "solid" | "dashed" | "dotted";
    };
    text?: {
      color?: string;
      size?: number;
      family?: string;
      weight?: string;
      offset?: [number, number];
    };
  };
  text?: string;
  lock?: boolean;
}

export interface ChartRef {
  createOverlay: (options: OverlayOptions) => Promise<string | null>;
  removeOverlay: (overlayId: string) => void;
  clearAllOverlays: () => void;
  addHorizontalRayLineAtLevel: (
    priceLevel: number,
    timestamp?: number,
    color?: string,
    label?: string
  ) => void;
  getSupportedOverlays: () => void;
  debugWindowObjects: () => void;
}

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  locale?: "en-US" | "zh-CN";
  theme?: "dark" | "light";
  market?: "stocks" | "crypto" | "forex";
  onTradeAnalysis?: (analysis: any) => void;
}

const TIMEFRAMES: Record<
  string,
  { multiplier: number; timespan: string; text: string }
> = {
  "1m": { multiplier: 1, timespan: "minute", text: "1m" },
  "5m": { multiplier: 5, timespan: "minute", text: "5m" },
  "15m": { multiplier: 15, timespan: "minute", text: "15m" },
  "1h": { multiplier: 1, timespan: "hour", text: "1H" },
  "4h": { multiplier: 4, timespan: "hour", text: "4H" },
  "1d": { multiplier: 1, timespan: "day", text: "D" },
  "1w": { multiplier: 1, timespan: "week", text: "W" },
  "1M": { multiplier: 1, timespan: "month", text: "M" },
};

function mapTimeframeToPeriod(tf: string | undefined) {
  const raw = (tf || "1d") as string;
  const normalized = raw.toLowerCase();
  return TIMEFRAMES[normalized] || TIMEFRAMES["1d"];
}

const DirectProChart = React.forwardRef<ChartRef, Props>(
  (
    {
      symbol,
      timeframe,
      height = 400,
      locale = "en-US",
      theme = "dark",
      market = "stocks",
      onTradeAnalysis,
    },
    ref
  ) => {
    const webRef = useRef<WebView>(null);
    const period = useMemo(() => mapTimeframeToPeriod(timeframe), [timeframe]);
    const safeSymbol = symbol?.replace(/[^a-zA-Z0-9.-]/g, "") || "AAPL";
    const polygonApiKey = Constants.expoConfig?.extra?.polygonApiKey || "";

    useImperativeHandle(ref, () => ({
      createOverlay: async (
        options: OverlayOptions
      ): Promise<string | null> => {
        return new Promise((resolve) => {
          if (!webRef.current) {
            resolve(null);
            return;
          }

          const overlayId = `overlay_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;

          webRef.current.injectJavaScript(`
            (function() {
              try {
                if (window.chart && typeof window.chart.createOverlay === 'function') {
                  const overlayOptions = ${JSON.stringify({
                    ...options,
                    id: overlayId,
                  })};
                  
                  const resultId = window.chart.createOverlay(overlayOptions);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'overlayCreated',
                    overlayId: resultId || overlayId,
                    success: !!resultId
                  }));
                } else {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'overlayCreated',
                    overlayId: null,
                    success: false,
                    error: 'createOverlay method not available'
                  }));
                }
              } catch (error) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'overlayCreated',
                  overlayId: null,
                  success: false,
                  error: error.message
                }));
              }
            })();
          `);

          // Return the overlay ID immediately for simplicity
          resolve(overlayId);
        });
      },

      removeOverlay: (overlayId: string) => {
        if (!webRef.current) return;

        webRef.current.injectJavaScript(`
          (function() {
            try {
              if (window.chart && typeof window.chart.removeOverlay === 'function') {
                window.chart.removeOverlay('${overlayId}');
              }
            } catch (error) {
              console.error('Failed to remove overlay:', error);
            }
          })();
        `);
      },

      clearAllOverlays: () => {
        if (!webRef.current) return;

        webRef.current.injectJavaScript(`
          (function() {
            try {
              if (window.chart && typeof window.chart.clearOverlays === 'function') {
                window.chart.clearOverlays();
              }
            } catch (error) {
              console.error('Failed to clear overlays:', error);
            }
          })();
        `);
      },

      addHorizontalRayLineAtLevel: (
        priceLevel: number,
        timestamp?: number,
        color?: string,
        label?: string
      ) => {
        if (!webRef.current) return;

        const currentTime = timestamp || Date.now();
        const lineColor = color || (theme === "dark" ? "#00D4AA" : "#1890ff");
        const displayText = label || `$${priceLevel.toFixed(2)}`;

        webRef.current.injectJavaScript(`
          (function() {
            try {
              if (window.chart && typeof window.chart.createOverlay === 'function') {
                const overlayId = window.chart.createOverlay({
                  name: 'horizontalRayLine',
                  points: [
                    { timestamp: ${currentTime}, value: ${priceLevel} }
                  ],
                  styles: {
                    line: {
                      color: '${lineColor}',
                      size: 2,
                      style: 'solid'
                    },
                    text: {
                      color: '${lineColor}',
                      size: 12,
                      family: 'Arial',
                      weight: 'bold',
                      offset: [5, 0]
                    }
                  },
                  text: '${displayText}',
                  lock: true
                });
                console.log('Created horizontal ray line with ID:', overlayId);
              }
            } catch (error) {
              console.error('Failed to create horizontal ray line:', error);
            }
          })();
        `);
      },

      getSupportedOverlays: () => {
        if (!webRef.current) return;

        webRef.current.injectJavaScript(`
          (function() {
            try {
              if (window.chart && typeof window.chart.getSupportedOverlays === 'function') {
                const overlays = window.chart.getSupportedOverlays();
                console.log('Supported overlays:', overlays);
              }
            } catch (error) {
              console.error('Failed to get supported overlays:', error);
            }
          })();
        `);
      },

      debugWindowObjects: () => {
        if (!webRef.current) return;

        webRef.current.injectJavaScript(`
          (function() {
            console.log('=== DIRECT CHART DEBUG ===');
            console.log('window.klinecharts:', !!window.klinecharts);
            console.log('window.klinechartspro:', !!window.klinechartspro);
            console.log('window.chart:', !!window.chart);
            
            if (window.chart) {
              console.log('Chart type:', typeof window.chart);
              console.log('Chart constructor:', window.chart.constructor.name);
              
              const methods = Object.getOwnPropertyNames(window.chart).filter(prop => 
                typeof window.chart[prop] === 'function'
              );
              console.log('Chart methods:', methods);
            }
          })();
        `);
      },
    }));

    const html = useMemo(() => {
      const cssHref =
        "https://unpkg.com/klinecharts-pro/dist/klinecharts-pro.css";
      const klinechartsSrc =
        "https://unpkg.com/klinecharts/dist/klinecharts.umd.js";
      const proSrc =
        "https://unpkg.com/klinecharts-pro/dist/klinecharts-pro.umd.js";

      return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="${cssHref}" />
    <style>
      html, body { 
        margin: 0; 
        padding: 0; 
        background: ${theme === "dark" ? "#0a0a0a" : "#ffffff"}; 
        width: 100%; 
        height: 100%; 
        box-sizing: border-box; 
      }
      #app { 
        width: 100%; 
        height: ${height}px; 
        overflow: hidden; 
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="${klinechartsSrc}"></script>
    <script src="${proSrc}"></script>
    <script>
      (function(){
        function post(msg){ 
          try { 
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); 
          } catch(e) {} 
        }
        
        window.onerror = function(m, s, l, c, e){ 
          post({ error: m || (e && e.message) || 'unknown' }); 
        };

        function create() {
          try {
            if (!window.klinechartspro || !window.klinecharts) {
              post({ error: 'KLineCharts libraries not loaded' });
              return false;
            }

            // Create the chart using KLineCharts Pro
            const chart = new window.klinechartspro.KLineChartPro({
              container: 'app',
              symbol: { 
                ticker: '${safeSymbol}', 
                name: '${safeSymbol}' 
              },
              period: { 
                multiplier: ${period.multiplier}, 
                timespan: '${period.timespan}', 
                text: '${period.text}' 
              },
              datafeed: {
                searchSymbols: async (search) => {
                  try {
                    const response = await fetch(\`https://api.polygon.io/v3/reference/tickers?apiKey=${polygonApiKey}&active=true&search=\${search || ""}\`);
                    const data = await response.json();
                    return (data.results || []).map(item => ({
                      ticker: item.ticker,
                      name: item.name,
                      shortName: item.ticker,
                      market: item.market,
                      exchange: item.primary_exchange,
                      priceCurrency: item.currency_name,
                      type: item.type
                    }));
                  } catch (error) {
                    console.error('Search symbols error:', error);
                    return [];
                  }
                },
                
                getHistoryKLineData: async (symbol, period, from, to) => {
                  try {
                    const response = await fetch(\`https://api.polygon.io/v2/aggs/ticker/\${symbol.ticker}/range/\${period.multiplier}/\${period.timespan}/\${from}/\${to}?apiKey=${polygonApiKey}\`);
                    const data = await response.json();
                    return (data.results || []).map(item => ({
                      timestamp: item.t,
                      open: item.o,
                      high: item.h,
                      low: item.l,
                      close: item.c,
                      volume: item.v,
                      turnover: item.vw
                    }));
                  } catch (error) {
                    console.error('Get history data error:', error);
                    return [];
                  }
                }
              },
              locale: '${locale}',
              theme: '${theme}'
            });

            // Store chart instance globally for API access
            window.chart = chart;

            post({ 
              ready: true, 
              symbol: '${safeSymbol}', 
              period: ${JSON.stringify(period)},
              hasOverlaySupport: !!(chart && typeof chart.createOverlay === 'function')
            });
            
            return true;
          } catch (err) { 
            post({ error: String(err && err.message || err) }); 
            return false; 
          }
        }

        function init() { 
          if (!create()) { 
            var tries = 0; 
            var t = setInterval(function(){ 
              tries++; 
              if (create() || tries > 300) clearInterval(t); 
            }, 100); 
          } 
        }

        if (document.readyState === 'complete' || document.readyState === 'interactive') { 
          init(); 
        } else { 
          document.addEventListener('DOMContentLoaded', init); 
        }
      })();
    </script>
  </body>
</html>`;
    }, [height, locale, period, polygonApiKey, symbol, theme]);

    return (
      <View style={[styles.container, { height }]}>
        <WebView
          ref={webRef}
          key={`direct-${symbol}-${period.timespan}-${period.multiplier}`}
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
              if (__DEV__) console.log("DirectProChart:", msg);

              if (msg && msg.analysis && onTradeAnalysis) {
                onTradeAnalysis(msg.analysis);
              }

              if (msg && msg.ready && onTradeAnalysis) {
                onTradeAnalysis(msg);
              }
            } catch (err) {
              if (__DEV__) console.log("DirectProChart:", e.nativeEvent.data);
            }
          }}
        />
      </View>
    );
  }
);

export default DirectProChart;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    width: "100%",
  },
});
