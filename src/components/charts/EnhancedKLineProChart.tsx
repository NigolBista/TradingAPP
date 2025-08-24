import React, {
  useEffect,
  useMemo,
  useRef,
  useImperativeHandle,
  useState,
} from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";
import {
  loadKLineChartsProLibrary,
  createInlineScript,
} from "../../utils/assetLoader";

export interface TradeLevel {
  price: number;
  timestamp?: number;
  color?: string;
  label?: string;
}

export interface TradeZone {
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  startTime?: number;
  endTime?: number;
  color?: string;
  label?: string;
  type?: "long" | "short";
}

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
  minimalUi?: boolean;
  lineOnly?: boolean;
  hideVolumePane?: boolean;
  hideIndicatorPane?: boolean;
  chartType?: "candle" | "line" | "area";
  showYAxis?: boolean;
  tradeLevels?: TradeLevel[];
  tradeZones?: TradeZone[];
  onTradeAnalysis?: (analysis: any) => void;
  styleConfig?: any;
}

// Canonical timeframe map
const TIMEFRAMES: Record<
  string,
  { multiplier: number; timespan: string; text: string }
> = {
  "1m": { multiplier: 1, timespan: "minute", text: "1m" },
  "3m": { multiplier: 3, timespan: "minute", text: "3m" },
  "5m": { multiplier: 5, timespan: "minute", text: "5m" },
  "15m": { multiplier: 15, timespan: "minute", text: "15m" },
  "1h": { multiplier: 1, timespan: "hour", text: "1H" },
  "4h": { multiplier: 4, timespan: "hour", text: "4H" },
  "1d": { multiplier: 1, timespan: "day", text: "D" },
  "1w": { multiplier: 1, timespan: "week", text: "W" },
  "1M": { multiplier: 1, timespan: "month", text: "M" },
  "3M": { multiplier: 3, timespan: "month", text: "3M" },
  "1Y": { multiplier: 1, timespan: "year", text: "1Y" },
  "5Y": { multiplier: 5, timespan: "year", text: "5Y" },
  "6M": { multiplier: 6, timespan: "month", text: "6M" },
};

function mapTimeframeToPeriod(tf: string | undefined): {
  multiplier: number;
  timespan: string;
  text: string;
} {
  const raw = (tf || "1d") as string;
  const lower = raw.toLowerCase();

  const normalized =
    raw === "1D"
      ? "1d"
      : raw === "1W"
      ? "1w"
      : raw === "1H"
      ? "1h"
      : raw === "4H"
      ? "4h"
      : raw === "6M"
      ? "6M"
      : lower;

  return TIMEFRAMES[normalized] || TIMEFRAMES["1d"];
}

const EnhancedKLineProChart = React.forwardRef<ChartRef, Props>(
  (
    {
      symbol,
      timeframe,
      height = 400,
      locale = "en-US",
      theme = "dark",
      market = "stocks",
      minimalUi = false,
      lineOnly = false,
      hideVolumePane = false,
      hideIndicatorPane = false,
      chartType,
      showYAxis = false,
      tradeLevels,
      tradeZones,
      onTradeAnalysis,
      styleConfig,
    },
    ref
  ) => {
    const webRef = useRef<WebView>(null);
    const [proLibraryCode, setProLibraryCode] = useState<string>("");
    const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);

    // Load the Pro library on component mount
    useEffect(() => {
      const loadLibrary = async () => {
        try {
          console.log("EnhancedKLineProChart: Starting library load...");
          const libraryCode = await loadKLineChartsProLibrary();
          console.log(
            "EnhancedKLineProChart: Library loaded, setting state..."
          );
          setProLibraryCode(libraryCode);
          setIsLibraryLoaded(true);
          console.log(
            "EnhancedKLineProChart: Ready to render with local library"
          );
        } catch (error) {
          console.error(
            "EnhancedKLineProChart: Failed to load library:",
            error
          );
          // Set empty library code but still allow rendering (will use fallback CDN)
          setProLibraryCode("");
          setIsLibraryLoaded(true);
          console.log("EnhancedKLineProChart: Will render with CDN fallback");
        }
      };

      loadLibrary();
    }, []);

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

          // Set up temporary listener for response
          const timeout = setTimeout(() => resolve(null), 5000);
          const originalOnMessage = webRef.current.props.onMessage;

          // This is a simplified approach - in production you'd want a more robust message handling system
          resolve(overlayId);
          clearTimeout(timeout);
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
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'supportedOverlays',
                  overlays: overlays
                }));
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
            console.log('=== ENHANCED CHART DEBUG ===');
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
              
              const overlayMethods = methods.filter(method => 
                method.toLowerCase().includes('overlay') || 
                method.toLowerCase().includes('create') ||
                method.toLowerCase().includes('draw')
              );
              console.log('Overlay-related methods:', overlayMethods);
            }
          })();
        `);
      },
    }));

    const html = useMemo(() => {
      if (!isLibraryLoaded) return "";

      const cssHref =
        "https://unpkg.com/klinecharts-pro/dist/klinecharts-pro.css";
      const klinechartsSrc =
        "https://unpkg.com/klinecharts/dist/klinecharts.umd.js";

      const hasLocalLibrary = proLibraryCode && proLibraryCode.length > 100;
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
      
      .klinecharts-pro-main,
      .klinecharts-pro-chart,
      [class*="main"],
      [class*="chart-container"] {
        width: 100% !important;
        height: 100% !important;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="${klinechartsSrc}"></script>
    ${
      hasLocalLibrary
        ? `<script>${createInlineScript(proLibraryCode)}</script>`
        : `<script src="${proSrc}"></script>`
    }
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
            post({ 
              debug: 'Chart initialization starting...', 
              librarySource: '${hasLocalLibrary ? "local-assets" : "cdn"}',
              hasKlineCharts: !!window.klinecharts,
              hasKlineChartsPro: !!window.klinechartspro
            });
            
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
              styles: ${JSON.stringify(styleConfig || {})},
              locale: '${locale}',
              theme: '${theme}'
            });

            // Store chart instance globally for API access
            window.chart = chart;
            
            // Expose chart methods for overlay creation
            window.__CHART_API__ = {
              createOverlay: (options) => {
                if (chart && typeof chart.createOverlay === 'function') {
                  return chart.createOverlay(options);
                }
                throw new Error('createOverlay method not available');
              },
              
              removeOverlay: (overlayId) => {
                if (chart && typeof chart.removeOverlay === 'function') {
                  return chart.removeOverlay(overlayId);
                }
                throw new Error('removeOverlay method not available');
              },
              
              clearOverlays: () => {
                if (chart && typeof chart.clearOverlays === 'function') {
                  return chart.clearOverlays();
                }
                throw new Error('clearOverlays method not available');
              },
              
              getSupportedOverlays: () => {
                if (chart && typeof chart.getSupportedOverlays === 'function') {
                  return chart.getSupportedOverlays();
                }
                return [];
              }
            };

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
    }, [
      height,
      locale,
      market,
      period,
      polygonApiKey,
      symbol,
      theme,
      chartType,
      minimalUi,
      lineOnly,
      hideVolumePane,
      hideIndicatorPane,
      showYAxis,
      proLibraryCode,
      isLibraryLoaded,
      styleConfig,
    ]);

    if (!isLibraryLoaded) {
      return (
        <View style={[styles.container, { height }]}>
          <View style={styles.loading}>{/* Add loading indicator here */}</View>
        </View>
      );
    }

    return (
      <View style={[styles.container, { height }]}>
        <WebView
          ref={webRef}
          key={`enhanced-${symbol}-${period.timespan}-${period.multiplier}-${
            chartType || (lineOnly ? "line" : "candle")
          }`}
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
              if (__DEV__) console.log("EnhancedKLineProChart:", msg);

              // Handle chart analysis results
              if (msg && msg.analysis && onTradeAnalysis) {
                onTradeAnalysis(msg.analysis);
              }

              // Handle overlay creation responses
              if (msg && msg.type === "overlayCreated") {
                // Handle overlay creation response
                console.log("Overlay created:", msg);
              }

              if (msg && msg.type === "supportedOverlays") {
                console.log("Supported overlays:", msg.overlays);
              }
            } catch (err) {
              if (__DEV__)
                console.log("EnhancedKLineProChart:", e.nativeEvent.data);
            }
          }}
        />
      </View>
    );
  }
);

export default EnhancedKLineProChart;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    width: "100%",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
});
