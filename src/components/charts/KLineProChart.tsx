import React, { useEffect, useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  locale?: "en-US" | "zh-CN";
  theme?: "dark" | "light";
  market?: "stocks" | "crypto" | "forex"; // Polygon market routing
  minimalUi?: boolean;
  lineOnly?: boolean;
  hideVolumePane?: boolean;
  hideIndicatorPane?: boolean;
  chartType?: "candle" | "line" | "area";
  showYAxis?: boolean; // Controls yAxis visibility - defaults to false
}

// Canonical timeframe map for display and datafeed period settings
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
  // Additional commonly used keys kept for compatibility with external controls
  "6M": { multiplier: 6, timespan: "month", text: "6M" },
};

function mapTimeframeToPeriod(tf: string | undefined): {
  multiplier: number;
  timespan: string;
  text: string;
} {
  const raw = (tf || "1d") as string;
  const lower = raw.toLowerCase();

  // Normalize common aliases/case
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
      : raw === "1M"
      ? "1M"
      : raw === "3M"
      ? "3M"
      : raw === "1Y"
      ? "1Y"
      : raw === "5Y"
      ? "5Y"
      : lower;

  // Direct map if available
  if (TIMEFRAMES[normalized]) return TIMEFRAMES[normalized];

  // Special ALL range (max)
  if (raw === "ALL") return { multiplier: 1, timespan: "month", text: "ALL" };

  // Generic fallbacks for minutes/hours
  if (lower.endsWith("m") && raw.endsWith("m")) {
    const n = parseInt(lower.replace("m", "")) || 1;
    return { multiplier: n, timespan: "minute", text: `${n}m` };
  }
  if (lower.endsWith("h")) {
    const n = parseInt(lower.replace("h", "")) || 1;
    return { multiplier: n, timespan: "hour", text: `${n}H` };
  }

  // Days/weeks default
  if (lower === "1d") return TIMEFRAMES["1d"];
  if (lower === "1w") return TIMEFRAMES["1w"];

  // Default fallback to daily
  return TIMEFRAMES["1d"];
}

export default function KLineProChart({
  symbol,
  timeframe = "1d",
  height = 280,
  locale = "en-US",
  theme = "dark",
  market = "stocks",
  minimalUi = false,
  lineOnly = false,
  hideVolumePane = false,
  hideIndicatorPane = false,
  chartType,
  showYAxis = false,
}: Props) {
  const polygonApiKey: string | undefined = (Constants.expoConfig?.extra as any)
    ?.polygonApiKey;

  const period = useMemo(() => mapTimeframeToPeriod(timeframe), [timeframe]);
  const webRef = useRef<any>(null);

  // Update chart type dynamically after the webview is ready
  useEffect(() => {
    if (!webRef.current || !chartType) return;
    try {
      webRef.current.injectJavaScript(
        `(function(){ try{ if(window.__KLP__&&window.__KLP__.setChartType){ window.__KLP__.setChartType(${JSON.stringify(
          chartType
        )}); } }catch(e){} })();`
      );
    } catch {}
  }, [chartType]);

  const html = useMemo(() => {
    const compactUi = minimalUi || lineOnly;
    const initialChartType = chartType || (lineOnly ? "line" : "candle");
    // Use the same versions as installed in package.json
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
      }; width: 100%; height: 100%; box-sizing: border-box; }
      #app { width: 100%; height: ${height}px; overflow: hidden; }
      
      /* KLine Pro CSS variable overrides */
      .klinecharts-pro {
        --klinecharts-pro-primary-color: #00D4AA;
        --klinecharts-pro-hover-background-color: rgba(0, 212, 170, 0.15);
        --klinecharts-pro-background-color: #FFFFFF;
        --klinecharts-pro-popover-background-color: #FFFFFF;
        --klinecharts-pro-text-color: #051441;
        --klinecharts-pro-text-second-color: #76808F;
        --klinecharts-pro-border-color: #ebedf1;
        --klinecharts-pro-selected-color: rgba(0, 212, 170, 0.15);
      }
      
      /* hide only timeframe chips */
      .klinecharts-pro-period-bar .item.period { display: none !important; }
      /* or hide the whole period bar */
      .klinecharts-pro-period-bar { display: none !important; }

      /* Remove any watermark/logo/background icons */
      .klinecharts-pro-watermark,
      .klinecharts-watermark,
      .klinecharts-pro-logo,
      [class*="watermark"],
      [class*="logo"],
      [class*="brand"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      .klinecharts-pro,
      .klinecharts-pro-main,
      .klinecharts-pro-chart,
      [class*="chart"] {
        background-image: none !important;
      }
      .klinecharts-pro::before,
      .klinecharts-pro::after,
      .klinecharts-pro-main::before,
      .klinecharts-pro-main::after,
      .klinecharts-pro-chart::before,
      .klinecharts-pro-chart::after {
        content: none !important;
        display: none !important;
      }
      .klinecharts-pro[data-theme="dark"] {
        --klinecharts-pro-primary-color: #00D4AA;
        --klinecharts-pro-hover-background-color: rgba(0, 212, 170, 0.15);
        --klinecharts-pro-background-color: #0a0a0a;
        --klinecharts-pro-popover-background-color: #1a1a1a;
        --klinecharts-pro-text-color: #F8F8F8;
        --klinecharts-pro-text-second-color: #929AA5;
        --klinecharts-pro-border-color: #292929;
        --klinecharts-pro-selected-color: rgba(0, 212, 170, 0.15);
      }
      ${""}
      
      /* Ensure main chart takes full space */
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
    <script src="${proSrc}"></script>
    <script>
      (function(){
        function post(msg){ try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {} }
        window.onerror = function(m, s, l, c, e){ post({ error: m || (e && e.message) || 'unknown' }); };
        (function(){ var ce = console.error, cl = console.log; console.error = function(){ try{ post({ consoleError: Array.from(arguments).join(' ') }); }catch(_){} ce && ce.apply(console, arguments); }; console.log = function(){ try{ post({ consoleLog: Array.from(arguments).join(' ') }); }catch(_){} cl && cl.apply(console, arguments); }; })();

        // Chart type styles mapping
        var CHART_TYPES = {
          candle: { 
            type: 'candle_solid',
            tooltip: { showRule: 'none' },
            priceMark: {
              show: false,
              last: { show: false },
              high: { show: false },
              low: { show: false }
            }
          },
          line: {  
            type: 'area',                 // use the "area" series type
            area: {
              lineColor: '#2196F3',  
              lineSize: 1,
              smooth: true,
              backgroundColor: 'rgba(0,0,0,0)',
            },
            tooltip: { showRule: 'none' },
            priceMark: {
              show: false,
              last: { show: false },
              high: { show: false },
              low: { show: false }
            }
          },
          area: {
            type: 'area',
            area: { 
              lineColor: '#2196F3', 
              fillColor: 'rgba(33, 150, 243, 0.1)', 
              lineSize: 1,
              smooth: true 
            },
            tooltip: { showRule: 'none' },
            priceMark: {
              show: false,
              last: { show: false },
              high: { show: false },
              low: { show: false }
            }
          }
        };
        var INITIAL_CHART_TYPE = ${JSON.stringify(initialChartType)};
        function applyChartType(chart, type){
          try {
            post({ debug: 'Attempting to apply chart type: ' + type });
            
            if (!chart) {
              post({ warn: 'Chart instance is null/undefined' });
              return;
            }
            
            var style = CHART_TYPES[type] || CHART_TYPES.candle;
            post({ debug: 'Using style config:', style: style });
            
            // Method 1: Try setStyleOptions
            if (typeof chart.setStyleOptions === 'function') {
              post({ debug: 'Trying setStyleOptions method' });
              chart.setStyleOptions({ candle: style });
            }
            
            // Method 2: Try setStyles
            if (typeof chart.setStyles === 'function') {
              post({ debug: 'Trying setStyles method' });
              chart.setStyles({ candle: style });
            }
            
            // Method 3: Try direct chart type setting
            var chartTypeMap = {
              'line': 'area',           // line charts now use area type with transparent background
              'candle': 'candle_solid', 
              'area': 'area'
            };
            
            var klineType = chartTypeMap[type] || 'candle_solid';
            if (typeof chart.setMainChartType === 'function') {
              post({ debug: 'Trying setMainChartType with: ' + klineType });
              chart.setMainChartType(klineType);
            }
            
            // Method 4: Try chart.chart if it exists (nested chart instance)
            if (chart.chart) {
              if (typeof chart.chart.setStyleOptions === 'function') {
                post({ debug: 'Trying nested chart setStyleOptions' });
                chart.chart.setStyleOptions({ candle: style });
              }
              if (typeof chart.chart.setMainChartType === 'function') {
                post({ debug: 'Trying nested chart setMainChartType' });
                chart.chart.setMainChartType(klineType);
              }
            }
            
            post({ debug: 'Chart type application completed for: ' + type });
          } catch (e) { 
            post({ error: 'setChartType failed: ' + (e && e.message || e) }); 
          }
        }
        function create(){
          try {
            post({ debug: 'Starting chart creation with type: ' + INITIAL_CHART_TYPE });
            
            if (!window.klinechartspro) { 
              post({ warn: 'klinechartspro not loaded yet' });
              return false; 
            }
            
            const { KLineChartPro, DefaultDatafeed } = window.klinechartspro;
            if (!${JSON.stringify(
              !!apiKey
            )}) { post({ warn: 'Missing POLYGON_API_KEY (extra.polygonApiKey)' }); }
            
            const datafeed = new DefaultDatafeed(${JSON.stringify(apiKey)});
            
            post({ debug: 'Creating KLineChartPro instance...' });
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
              periods: [], // Hide timeframe buttons
              mainIndicators: [], // Remove MA and other main indicators
              subIndicators: [], // Remove volume and other sub-indicators
              styles: {
                candle: Object.assign({}, CHART_TYPES[INITIAL_CHART_TYPE] || CHART_TYPES.candle, {
                  tooltip: {
                    showRule: 'none'  // Hides the tooltip that shows OHLC values
                  },
                  priceMark: {
                    show: false,      // Hides all price marks
                    last: {
                      show: false    // Hides the last price mark
                    },
                    high: {
                      show: false    // Hides the high price mark
                    },
                    low: {
                      show: false    // Hides the low price mark
                    }
                  }
                }),
                xAxis: { 
                  show: false,      // Hides time axis
                  axisLine: {
                    show: false    // Hides axis line
                  },
                  tickLine: {
                    show: false    // Hides tick lines
                  },
                  tickText: {
                    show: false    // Hides tick text
                  }
                },
                yAxis: { 
                  show: ${showYAxis},      // Controls price axis visibility
                  scrollZoomEnabled: ${showYAxis},
                  axisLine: {
                    show: ${showYAxis}    // Controls axis line visibility
                  },
                  tickLine: {
                    show: ${showYAxis}    // Controls tick lines visibility
                  },
                  tickText: {
                    show: ${showYAxis}    // Controls tick text visibility
                  }
                },
                grid: { show: false },
                indicator: { show: false }
              },
              drawingBarVisible: false, // Hide drawing tools
              datafeed,
              ${
                compactUi || hideVolumePane || hideIndicatorPane
                  ? `layout: {
                ${hideVolumePane || compactUi ? "showVolumePane: false," : ""}
                ${
                  hideIndicatorPane || compactUi
                    ? "showIndicatorPane: false,"
                    : ""
                }
                ${
                  compactUi
                    ? "showLeftPanel: false,\n                showRightPanel: false,\n                showHeader: false,\n                showToolbar: false,\n                showTimeline: false,\n                showPriceScale: false,\n                showSymbolInfo: false,\n                showPeriodSelector: false,\n                showDrawingToolbar: false,\n                showSettingsButton: false"
                    : ""
                }
              },`
                  : ""
              }
            });

            post({ debug: 'Chart instance created successfully' });
            
            // Log available methods on the chart instance
            if (chart) {
              var methods = [];
              for (var prop in chart) {
                if (typeof chart[prop] === 'function') {
                  methods.push(prop);
                }
              }
              post({ debug: 'Available chart methods:', methods: methods.slice(0, 10) }); // Log first 10 methods
            }

            // Apply initial chart type with multiple attempts
            try { 
              post({ debug: 'Applying initial chart type: ' + INITIAL_CHART_TYPE });
              applyChartType(chart, INITIAL_CHART_TYPE); 
              
              // Try again after delays to ensure chart is fully initialized
              setTimeout(function(){ 
                post({ debug: 'Retry 1: Applying chart type after 100ms' });
                applyChartType(chart, INITIAL_CHART_TYPE); 
              }, 100);
              setTimeout(function(){ 
                post({ debug: 'Retry 2: Applying chart type after 300ms' });
                applyChartType(chart, INITIAL_CHART_TYPE); 
              }, 300);
              setTimeout(function(){ 
                post({ debug: 'Retry 3: Applying chart type after 1000ms' });
                applyChartType(chart, INITIAL_CHART_TYPE); 
              }, 1000);
            } catch(e) {
              post({ error: 'Initial chart type application failed: ' + (e && e.message || e) });
            }
            
            try { 
              window.__KLP__ = { 
                setChartType: function(t){ 
                  post({ debug: 'External setChartType called with: ' + t });
                  try { 
                    applyChartType(chart, t); 
                  } catch(e) {
                    post({ error: 'External setChartType failed: ' + (e && e.message || e) });
                  } 
                } 
              }; 
            } catch(e) {
              post({ error: 'Failed to set up external chart type function: ' + (e && e.message || e) });
            }

            ${""}

            ${""}

            ${
              lineOnly
                ? `// Switch to simple line style using area type with transparent background
            (function(){
              function toLine(){
                try { if (chart && typeof chart.setMainChartType === 'function') { chart.setMainChartType('area'); } } catch(e) {}
                try { if (chart && typeof chart.setStyleOptions === 'function') { 
                  chart.setStyleOptions({ 
                    candle: { 
                      type: 'area',
                      area: {
                        lineSize: 2,
                        lineColor: '#2b6cb0',
                        smooth: true,
                        backgroundColor: 'rgba(0,0,0,0)',
                        point: { show: false }
                      }
                    } 
                  }); 
                } } catch(e) {}
              }
              toLine();
              setTimeout(toLine, 80);
              setTimeout(toLine, 200);
              setTimeout(toLine, 500);
            })();`
                : ""
            }

            // Remove right-side blank space to make chart fully flush
            (function(){
              function removeRightSpace(){
                try { if (chart && typeof chart.setOffsetRightDistance === 'function') { chart.setOffsetRightDistance(0); } } catch(e) {}
                try { if (chart && chart.chart && typeof chart.chart.setOffsetRightDistance === 'function') { chart.chart.setOffsetRightDistance(0); } } catch(e) {}
                try { if (chart && typeof chart.setRightSpace === 'function') { chart.setRightSpace(0); } } catch(e) {}
                try { if (chart && typeof chart.setRightMinVisibleBarCount === 'function') { chart.setRightMinVisibleBarCount(0); } } catch(e) {}
                try { if (chart && typeof chart.setRightBarCount === 'function') { chart.setRightBarCount(0); } } catch(e) {}
              }
              removeRightSpace();
              setTimeout(removeRightSpace, 100);
              setTimeout(removeRightSpace, 300);
              setTimeout(removeRightSpace, 600);
            })();
            
            post({ ready: true, symbol: ${JSON.stringify(
              safeSymbol
            )}, period: ${JSON.stringify(period)} });
            return true;
          } catch (err) { post({ error: String(err && err.message || err) }); return false; }
        }
        function init(){ if (!create()) { var tries = 0; var t = setInterval(function(){ tries++; if (create() || tries>300) clearInterval(t); }, 100); } }
        if (document.readyState === 'complete' || document.readyState === 'interactive') { init(); } else { document.addEventListener('DOMContentLoaded', init); }
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
  ]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webRef}
        key={`${symbol}-${period.timespan}-${period.multiplier}-${
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
            if (__DEV__) console.log("KLineProChart:", msg);
            // if (msg && msg.ready && chartType && webRef.current) {
            //   try {
            //     webRef.current.injectJavaScript(
            //       `(function(){ try{ if(window.__KLP__&&window.__KLP__.setChartType){ window.__KLP__.setChartType(${JSON.stringify(
            //         chartType
            //       )}); } }catch(e){} })();`
            //     );
            //   } catch {}
            // }
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
