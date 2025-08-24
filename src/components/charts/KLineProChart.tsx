import React, { useEffect, useMemo, useRef, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";

export interface TradeLevel {
  price: number;
  timestamp?: number; // Optional timestamp for time-based anchoring
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

export interface ChartAnalysis {
  symbol: string;
  currentPrice: number;
  trend: "bullish" | "bearish" | "sideways";
  resistance: number;
  support: number;
  sma20: number;
  sma50: number;
  suggestedEntry: number;
  suggestedExit: number;
  stopLoss: number;
  takeProfit: number;
  timestamp: number;
}

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
  tradeLevels?: TradeLevel[]; // Price lines for entry/exit levels
  tradeZones?: TradeZone[]; // Rectangles for trade visualization
  onTradeAnalysis?: (analysis: any) => void; // Callback for chart analysis results
  /** Optional full style configuration object (KLineCharts/Pro styles JSON) */
  styleConfig?: any;
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

const KLineProChart = React.forwardRef<any, Props>(
  (
    {
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
      tradeLevels = [],
      tradeZones = [],
      onTradeAnalysis,
      styleConfig,
    }: Props,
    ref
  ) => {
    const polygonApiKey: string | undefined = (
      Constants.expoConfig?.extra as any
    )?.polygonApiKey;

    const period = useMemo(() => mapTimeframeToPeriod(timeframe), [timeframe]);
    const webRef = useRef<any>(null);

    // Expose imperative API to parent (tool use from outside)
    useImperativeHandle(
      ref,
      () => ({
        injectJavaScript: (script: string) => {
          try {
            webRef.current && webRef.current.injectJavaScript(script);
          } catch {}
        },
        showIndicators: () => {
          try {
            webRef.current &&
              webRef.current.injectJavaScript(
                `(function(){ try{ if(window.__KLP__&&window.__KLP__.showIndicators){ window.__KLP__.showIndicators(); } }catch(e){} })();`
              );
          } catch {}
        },
        hideIndicators: () => {
          try {
            webRef.current &&
              webRef.current.injectJavaScript(
                `(function(){ try{ if(window.__KLP__&&window.__KLP__.hideIndicators){ window.__KLP__.hideIndicators(); } }catch(e){} })();`
              );
          } catch {}
        },
        clearAllDrawings: () => {
          try {
            webRef.current &&
              webRef.current.injectJavaScript(
                `(function(){ try{ if(window.__KLP__&&window.__KLP__.clearAllDrawings){ window.__KLP__.clearAllDrawings(); } }catch(e){} })();`
              );
          } catch {}
        },
        clearIndicators: () => {
          try {
            webRef.current &&
              webRef.current.injectJavaScript(
                `(function(){ try{ if(window.__KLP__&&window.__KLP__.clearIndicators){ window.__KLP__.clearIndicators(); } }catch(e){} })();`
              );
          } catch {}
        },
        addHorizontalRayLineAtLevel: (
          priceLevel: number,
          timestamp?: number,
          color?: string,
          label?: string
        ) => {
          try {
            webRef.current &&
              webRef.current.injectJavaScript(
                `(function(){ try{ if(window.__KLP__&&window.__KLP__.addHorizontalRayLineAtLevel){ window.__KLP__.addHorizontalRayLineAtLevel(${priceLevel}, ${
                  timestamp || "undefined"
                }, ${JSON.stringify(color || "")}, ${JSON.stringify(
                  label || ""
                )}); } }catch(e){} })();`
              );
          } catch {}
        },
        // Test direct KLineCharts API
        testDirectOverlay: (priceLevel: number, overlayType?: string) => {
          try {
            const type = overlayType || "horizontalStraightLine";
            webRef.current &&
              webRef.current.injectJavaScript(
                `(function(){ 
                  try{ 
                    if(window.__KLP__ && window.__KLP__.createOverlay){ 
                      var lineId = window.__KLP__.createOverlay({
                        name: '${type}',
                        points: [{ value: ${priceLevel} }],
                        lock: true
                      });
                      console.log('Direct overlay created with ID:', lineId);
                    } 
                  }catch(e){ 
                    console.error('Direct overlay creation failed:', e); 
                  } 
                })();`
              );
          } catch {}
        },
        // Get supported overlays
        getSupportedOverlays: () => {
          try {
            webRef.current &&
              webRef.current.injectJavaScript(
                `(function(){ 
                  try{ 
                    if(window.__KLP__ && window.__KLP__.getSupportedOverlays){ 
                      var overlays = window.__KLP__.getSupportedOverlays();
                      console.log('Supported overlays:', overlays);
                    } 
                  }catch(e){ 
                    console.error('Get supported overlays failed:', e); 
                  } 
                })();`
              );
          } catch {}
        },
        // Debug window objects
        debugWindowObjects: () => {
          try {
            webRef.current &&
              webRef.current.injectJavaScript(
                `(function(){ 
                  try{ 
                    console.log('=== WINDOW DEBUG ===');
                    console.log('window.chart:', !!window.chart);
                    console.log('window.klinecharts:', !!window.klinecharts);
                    console.log('window.__KLP__:', !!window.__KLP__);
                    
                    if (window.chart) {
                      // Debug the chart object structure
                      console.log('Chart object type:', typeof window.chart);
                      console.log('Chart constructor:', window.chart.constructor.name);
                      console.log('Chart keys:', Object.keys(window.chart));
                      console.log('Chart properties:', Object.getOwnPropertyNames(window.chart));
                      
                      // Deep inspection of all properties
                      for (var key in window.chart) {
                        try {
                          var prop = window.chart[key];
                          if (prop && typeof prop === 'object') {
                            console.log('Property ' + key + ':', typeof prop, prop.constructor ? prop.constructor.name : 'unknown');
                            if (prop.constructor && prop.constructor.name && prop.constructor.name.toLowerCase().includes('chart')) {
                              console.log('Found potential chart in property:', key);
                              var propMethods = Object.getOwnPropertyNames(prop).filter(function(p) {
                                return typeof prop[p] === 'function';
                              });
                              console.log(key + ' methods:', propMethods.slice(0, 10));
                            }
                          }
                        } catch(e) {
                          console.log('Error inspecting property ' + key + ':', e.message);
                        }
                      }
                      
                      var chartMethods = Object.getOwnPropertyNames(window.chart).filter(function(prop) {
                        return typeof window.chart[prop] === 'function';
                      });
                      console.log('Chart methods:', chartMethods.slice(0, 15));
                      console.log('Total chart methods:', chartMethods.length);
                      
                      // Check if chart has nested chart instance (_chartApi)
                      if (window.chart._chartApi) {
                        console.log('Found _chartApi instance');
                        console.log('_chartApi type:', typeof window.chart._chartApi);
                        console.log('_chartApi constructor:', window.chart._chartApi.constructor.name);
                        var apiMethods = Object.getOwnPropertyNames(window.chart._chartApi).filter(function(prop) {
                          return typeof window.chart._chartApi[prop] === 'function';
                        });
                        console.log('_chartApi methods:', apiMethods.slice(0, 15));
                        console.log('Total _chartApi methods:', apiMethods.length);
                        
                        // Check for overlay methods specifically
                        var overlayApiMethods = apiMethods.filter(function(method) {
                          return method.toLowerCase().includes('overlay') || 
                                 method.toLowerCase().includes('draw') ||
                                 method.toLowerCase().includes('create');
                        });
                        console.log('_chartApi overlay methods:', overlayApiMethods);
                      }
                      
                      // Also check for chart.chart (fallback)
                      if (window.chart.chart) {
                        console.log('Found nested chart instance');
                        console.log('Nested chart type:', typeof window.chart.chart);
                        console.log('Nested chart constructor:', window.chart.chart.constructor.name);
                        var nestedMethods = Object.getOwnPropertyNames(window.chart.chart).filter(function(prop) {
                          return typeof window.chart.chart[prop] === 'function';
                        });
                        console.log('Nested chart methods:', nestedMethods.slice(0, 15));
                        console.log('Total nested methods:', nestedMethods.length);
                      }
                      
                      // Check for overlay-related methods
                      var overlayMethods = chartMethods.filter(function(method) {
                        return method.toLowerCase().includes('overlay') || 
                               method.toLowerCase().includes('draw') ||
                               method.toLowerCase().includes('create');
                      });
                      console.log('Overlay-related methods:', overlayMethods);
                    }
                    
                    if (window.__KLP__) {
                      console.log('__KLP__ methods:', Object.keys(window.__KLP__));
                    }
                    
                    // Try to create a test overlay with different APIs
                    if (window.chart) {
                      console.log('Testing overlay creation...');
                      
                      // Check if KLineChartPro has direct overlay methods
                      console.log('Checking KLineChartPro direct methods...');
                      var directMethods = [];
                      for (var method in window.chart) {
                        if (typeof window.chart[method] === 'function') {
                          directMethods.push(method);
                        }
                      }
                      console.log('Direct methods on chart:', directMethods);
                      
                      // Check prototype methods
                      if (window.chart.constructor && window.chart.constructor.prototype) {
                        var prototypeMethods = Object.getOwnPropertyNames(window.chart.constructor.prototype).filter(function(prop) {
                          return typeof window.chart.constructor.prototype[prop] === 'function' && prop !== 'constructor';
                        });
                        console.log('Prototype methods:', prototypeMethods.slice(0, 15));
                      }
                      
                      // Method 1: Try createOverlay (basic KLineCharts)
                      if (typeof window.chart.createOverlay === 'function') {
                        try {
                          var testId1 = window.chart.createOverlay({
                            name: 'horizontalStraightLine',
                            points: [{ value: 225 }]
                          });
                          console.log('createOverlay result:', testId1);
                        } catch(e) {
                          console.log('createOverlay failed:', e.message);
                        }
                      }
                      
                      // Method 2: Try addOverlay (Pro version)
                      if (typeof window.chart.addOverlay === 'function') {
                        try {
                          var testId2 = window.chart.addOverlay({
                            name: 'horizontalStraightLine',
                            points: [{ value: 225 }]
                          });
                          console.log('addOverlay result:', testId2);
                        } catch(e) {
                          console.log('addOverlay failed:', e.message);
                        }
                      }
                      
                      // Method 3: Try createShape (Pro version)
                      if (typeof window.chart.createShape === 'function') {
                        try {
                          var testId3 = window.chart.createShape({
                            name: 'horizontalStraightLine',
                            points: [{ value: 225 }]
                          });
                          console.log('createShape result:', testId3);
                        } catch(e) {
                          console.log('createShape failed:', e.message);
                        }
                      }
                      
                      // Method 4: Try _chartApi (KLineCharts Pro internal API)
                      if (window.chart._chartApi && typeof window.chart._chartApi.createOverlay === 'function') {
                        try {
                          var testId4 = window.chart._chartApi.createOverlay({
                            name: 'horizontalStraightLine',
                            points: [{ value: 225 }]
                          });
                          console.log('_chartApi.createOverlay result:', testId4);
                        } catch(e) {
                          console.log('_chartApi.createOverlay failed:', e.message);
                        }
                      }
                      
                      // Method 5: Check if it's Pro version with different API
                      if (window.chart.chart && typeof window.chart.chart.createOverlay === 'function') {
                        try {
                          var testId5 = window.chart.chart.createOverlay({
                            name: 'horizontalStraightLine',
                            points: [{ value: 225 }]
                          });
                          console.log('chart.chart.createOverlay result:', testId5);
                        } catch(e) {
                          console.log('chart.chart.createOverlay failed:', e.message);
                        }
                      }
                    }
                    
                  }catch(e){ 
                    console.error('Window debug failed:', e); 
                  } 
                })();`
              );
          } catch {}
        },
      }),
      []
    );

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

    // Apply external style overrides dynamically
    useEffect(() => {
      if (!webRef.current || !styleConfig) return;
      try {
        webRef.current.injectJavaScript(
          `(function(){ try{ if(window.__KLP__&&window.__KLP__.setStyles){ window.__KLP__.setStyles(${JSON.stringify(
            styleConfig
          )}); } }catch(e){} })();`
        );
      } catch {}
    }, [styleConfig]);

    // Draw trade levels (price lines) when they change
    useEffect(() => {
      if (!webRef.current || !tradeLevels || tradeLevels.length === 0) return;

      try {
        const drawLevelsScript = `
        (function(){
          try {
            var levels = ${JSON.stringify(tradeLevels)};
            levels.forEach(function(level) {
              if (window.__KLP__ && window.__KLP__.drawPriceLine) {
                window.__KLP__.drawPriceLine(level.price, level.color, level.label);
              }
            });
          } catch(e) {
            console.error('Failed to draw trade levels:', e);
          }
        })();
      `;

        webRef.current.injectJavaScript(drawLevelsScript);
      } catch (e) {
        console.error("Failed to inject trade levels script:", e);
      }
    }, [tradeLevels]);

    // Draw trade zones (rectangles) when they change
    useEffect(() => {
      if (!webRef.current || !tradeZones || tradeZones.length === 0) return;

      try {
        const drawZonesScript = `
        (function(){
          try {
            var zones = ${JSON.stringify(tradeZones)};
            zones.forEach(function(zone) {
              if (window.__KLP__ && window.__KLP__.drawTradeZone) {
                window.__KLP__.drawTradeZone(
                  zone.entryPrice,
                  zone.exitPrice,
                  zone.startTime || Date.now() - 86400000, // Default to 1 day ago
                  zone.endTime || Date.now(),
                  zone.color,
                  zone.label,
                  zone.type || 'long'
                );
              }
              
              // Draw stop loss and take profit lines if provided
              if (zone.stopLoss && window.__KLP__ && window.__KLP__.drawStopLoss) {
                window.__KLP__.drawStopLoss(zone.stopLoss, '#FF5252', 'Stop Loss');
              }
              
              if (zone.takeProfit && window.__KLP__ && window.__KLP__.drawTakeProfit) {
                window.__KLP__.drawTakeProfit(zone.takeProfit, '#00D4AA', 'Take Profit');
              }
            });
          } catch(e) {
            console.error('Failed to draw trade zones:', e);
          }
        })();
      `;

        webRef.current.injectJavaScript(drawZonesScript);
      } catch (e) {
        console.error("Failed to inject trade zones script:", e);
      }
    }, [tradeZones]);

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
        var USER_STYLES = ${JSON.stringify(styleConfig || null)};
        var SHOW_Y_AXIS = ${JSON.stringify(showYAxis)};

        function isObject(obj){ return obj && typeof obj === 'object' && !Array.isArray(obj); }
        function deepMerge(target, source){
          if (!isObject(target) || !isObject(source)) return target;
          Object.keys(source).forEach(function(key){
            var srcVal = source[key];
            if (isObject(srcVal)){
              if (!isObject(target[key])) target[key] = {};
              deepMerge(target[key], srcVal);
            } else {
              target[key] = srcVal;
            }
          });
          return target;
        }
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
              styles: (function(){
                var base = {
                  candle: Object.assign({}, CHART_TYPES[INITIAL_CHART_TYPE] || CHART_TYPES.candle, {
                    tooltip: { showRule: 'none' },
                    priceMark: { show: false, last: { show: false }, high: { show: false }, low: { show: false } }
                  }),
                  xAxis: { show: false, axisLine: { show: false }, tickLine: { show: false }, tickText: { show: false } },
                  yAxis: { show: SHOW_Y_AXIS, scrollZoomEnabled: SHOW_Y_AXIS, axisLine: { show: SHOW_Y_AXIS }, tickLine: { show: SHOW_Y_AXIS }, tickText: { show: SHOW_Y_AXIS } },
                  grid: { show: false },
                  indicator: { show: false }
                };
                try { return USER_STYLES ? deepMerge(base, USER_STYLES) : base; } catch(_) { return base; }
              })(),
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
              // Expose KLineCharts library and chart instance to window for debugging
              post({ debug: 'Exposing chart and library to window' });
              
              // Expose chart instance
              window.chart = chart.getChart();
              
              // Debug: Log what we're exposing
              post({ 
                debug: 'Window objects exposed', 
                hasChart: !!window.chart,
                hasKLineCharts: !!window.klinecharts,
                chartMethods: window.chart ? Object.getOwnPropertyNames(window.chart).filter(function(prop) {
                  return typeof window.chart[prop] === 'function';
                }).slice(0, 5) : []
              });
              
              window.__KLP__ = { 
                // Direct access to chart instance
                chart: chart,
                
                // Direct access to KLineCharts library
                klinecharts: window.klinecharts,
                
                // Helper function to create overlays (uses working Pro methods)
                createOverlay: function(options) {
                  try {
                    if (!options || !options.name) {
                      post({ error: 'Invalid overlay options' });
                      return null;
                    }
                    
                    var overlayType = options.name;
                    var points = options.points || [];
                    var styles = options.styles || {};
                    var lock = options.lock || false;
                    
                    // Map overlay types to working Pro methods
                    if (overlayType === 'horizontalStraightLine' || overlayType === 'horizontalRayLine' || overlayType === 'priceLine') {
                      if (points.length > 0 && typeof points[0].value !== 'undefined') {
                        var priceLevel = points[0].value;
                        var color = (styles.line && styles.line.color) || '#00D4AA';
                        var label = options.text || ('Line at ' + priceLevel);
                        
                        // Use the working drawPriceLine method
                        if (window.__KLP__ && window.__KLP__.drawPriceLine) {
                          var lineId = window.__KLP__.drawPriceLine(priceLevel, color, label);
                          post({ 
                            debug: 'Overlay created via drawPriceLine', 
                            id: lineId, 
                            type: overlayType,
                            price: priceLevel,
                            color: color
                          });
                          return lineId;
                        }
                      }
                    }
                    
                    // Fallback: try direct chart access (probably won't work but worth trying)
                    if (chart && typeof chart.createOverlay === 'function') {
                      var overlayId = chart.createOverlay(options);
                      post({ 
                        debug: 'Overlay created via direct chart', 
                        id: overlayId, 
                        options: options 
                      });
                      return overlayId;
                    }
                    
                    post({ error: 'No working overlay creation method found for type: ' + overlayType });
                    return null;
                  } catch(e) {
                    post({ error: 'createOverlay failed: ' + (e && e.message || e) });
                    return null;
                  }
                },
                
                // Helper function to update overlays (Pro compatible)
                overrideOverlay: function(options) {
                  try {
                    if (!options || !options.id) {
                      post({ error: 'Invalid override options - id required' });
                      return false;
                    }
                    
                    // For Pro, we need to remove and recreate since direct override may not work
                    if (options.points && options.points.length > 0 && typeof options.points[0].value !== 'undefined') {
                      // Remove existing overlay
                      if (window.__KLP__ && window.__KLP__.removeOverlayById) {
                        window.__KLP__.removeOverlayById(options.id);
                      }
                      
                      // Create new overlay with updated values
                      var newOverlay = {
                        name: 'horizontalStraightLine',
                        points: options.points
                      };
                      var newId = this.createOverlay(newOverlay);
                      
                      post({ 
                        debug: 'Overlay updated via recreate', 
                        oldId: options.id,
                        newId: newId,
                        options: options 
                      });
                      return newId;
                    }
                    
                    post({ error: 'Override not supported for this overlay type' });
                    return false;
                  } catch(e) {
                    post({ error: 'overrideOverlay failed: ' + (e && e.message || e) });
                    return false;
                  }
                },
                
                // Helper function to remove overlays (Pro compatible)
                removeOverlay: function(filter) {
                  try {
                    if (!filter) {
                      post({ error: 'Remove filter required' });
                      return false;
                    }
                    
                    // Use Pro's removeOverlayById if available
                    if (filter.id && window.__KLP__ && window.__KLP__.removeOverlayById) {
                      var result = window.__KLP__.removeOverlayById(filter.id);
                      post({ 
                        debug: 'Overlay removed via removeOverlayById', 
                        result: result, 
                        filter: filter 
                      });
                      return result;
                    }
                    
                    // Fallback to clearAllDrawings if no specific ID
                    if (window.__KLP__ && window.__KLP__.clearAllDrawings) {
                      window.__KLP__.clearAllDrawings();
                      post({ 
                        debug: 'All overlays cleared via clearAllDrawings' 
                      });
                      return true;
                    }
                    
                    post({ error: 'No working remove method found' });
                    return false;
                  } catch(e) {
                    post({ error: 'removeOverlay failed: ' + (e && e.message || e) });
                    return false;
                  }
                },
                
                // Get supported overlays
                getSupportedOverlays: function() {
                  try {
                    if (window.klinecharts && typeof window.klinecharts.getSupportedOverlays === 'function') {
                      return window.klinecharts.getSupportedOverlays();
                    }
                    return ['horizontalStraightLine', 'horizontalRayLine', 'horizontalSegment', 'priceLine', 'verticalStraightLine', 'verticalRayLine', 'segment', 'rayLine', 'straightLine'];
                  } catch(e) {
                    post({ error: 'getSupportedOverlays failed: ' + (e && e.message || e) });
                    return [];
                  }
                },
                
                setChartType: function(t){ 
                  post({ debug: 'External setChartType called with: ' + t });
                  try { 
                    applyChartType(chart, t); 
                  } catch(e) {
                    post({ error: 'External setChartType failed: ' + (e && e.message || e) });
                  } 
                },
                // Allow external style overrides
                setStyles: function(s){
                  try {
                    if (!s) return;
                    if (typeof chart.setStyleOptions === 'function') { chart.setStyleOptions(s); }
                    if (typeof chart.setStyles === 'function') { chart.setStyles(s); }
                    post({ debug: 'setStyles applied' });
                  } catch(e) { post({ error: 'setStyles failed: ' + (e && e.message || e) }); }
                },
                
                // Indicator controls
                addIndicator: function(config){
                  try {
                    if (!chart) return;
                    var type = (config && config.type ? String(config.type) : 'MA').toUpperCase();
                    var period = (config && config.period) || 20;
                    var color = (config && config.color) || '#00D4AA';
                    var params = (config && config.parameters) || {};

                    // Ensure indicator visuals are enabled
                    try { if (typeof chart.setStyles === 'function') { chart.setStyles({ indicator: { show: true } }); } } catch(_) {}
                    try { if (typeof chart.setLayout === 'function') { chart.setLayout({ showIndicatorPane: true }); } } catch(_) {}

                    // Map friendly names to klinecharts names
                    var nameMap = { SMA: 'MA', EMA: 'EMA', RSI: 'RSI', MACD: 'MACD', BOLLINGER: 'BOLL', BOLL: 'BOLL', VOL: 'VOL', VOLUME: 'VOL' };
                    var name = nameMap[type] || type;

                    var calcParams = undefined;
                    if (name === 'MA' || name === 'EMA') { calcParams = [period]; }
                    if (name === 'RSI') { calcParams = [period]; }
                    if (name === 'MACD') { calcParams = [ params.fast || 12, params.slow || 26, params.signal || 9 ]; }
                    if (name === 'BOLL') { calcParams = [ period, params.deviation || params.std || 2 ]; }

                    var added = false;

                    // Attempt via pro API first
                    try {
                      if (typeof chart.setMainIndicators === 'function') {
                        var current = (chart.getMainIndicators && chart.getMainIndicators()) || [];
                        var next = current.concat([{ name: name, calcParams: calcParams }]);
                        chart.setMainIndicators(next);
                        added = true;
                      }
                    } catch(_) {}

                    // Fallback to underlying klinecharts instance
                    try {
                      if (!added && chart.chart && typeof chart.chart.createIndicator === 'function') {
                        var options = { id: undefined, lock: false, styles: { line: { color: color } } };
                        chart.chart.createIndicator(name, true, undefined, { calcParams: calcParams, styles: options.styles });
                        added = true;
                      }
                    } catch(_) {}

                    post({ debug: 'addIndicator', name: name, calcParams: calcParams, added: added });
                    return added;
                  } catch(e) {
                    post({ error: 'addIndicator failed: ' + (e && e.message || e) });
                    return false;
                  }
                },
                clearIndicators: function(){
                  try {
                    var cleared = false;
                    try { if (typeof chart.setMainIndicators === 'function') { chart.setMainIndicators([]); cleared = true; } } catch(_) {}
                    try { if (typeof chart.setSubIndicators === 'function') { chart.setSubIndicators([]); cleared = true; } } catch(_) {}
                    try { if (chart.chart && typeof chart.chart.removeIndicator === 'function') { chart.chart.removeIndicator(); cleared = true; } } catch(_) {}
                    post({ debug: 'clearIndicators', cleared: cleared });
                  } catch(e) {
                    post({ error: 'clearIndicators failed: ' + (e && e.message || e) });
                  }
                },
                showIndicators: function(){
                  try { if (typeof chart.setStyles === 'function') { chart.setStyles({ indicator: { show: true } }); } } catch(_) {}
                  try { if (typeof chart.setLayout === 'function') { chart.setLayout({ showIndicatorPane: true }); } } catch(_) {}
                  post({ debug: 'showIndicators called' });
                },
                hideIndicators: function(){
                  try { if (typeof chart.setStyles === 'function') { chart.setStyles({ indicator: { show: false } }); } } catch(_) {}
                  try { if (typeof chart.setLayout === 'function') { chart.setLayout({ showIndicatorPane: false }); } } catch(_) {}
                  post({ debug: 'hideIndicators called' });
                },
                
                // Drawing functions for trade visualization
                drawPriceLine: function(price, color, label) {
                  try {
                    if (!chart) return;
                    
                    var lineId = 'price_line_' + Date.now() + '_' + Math.random();
                    var lineOptions = {
                      id: lineId,
                      points: [{ value: price }],
                      styles: {
                        line: {
                          color: color || '#00D4AA',
                          size: 2,
                          style: 'solid'
                        },
                        text: {
                          color: color || '#00D4AA',
                          size: 12,
                          family: 'Arial',
                          weight: 'normal',
                          offset: [5, 0]
                        }
                      },
                      text: label || ''
                    };
                    
                    var created = false;
                    // Try priceLine
                    try {
                      if (chart.chart && typeof chart.chart.createOverlay === 'function') {
                        chart.chart.createOverlay('priceLine', lineOptions);
                        created = true;
                      } else if (typeof chart.createOverlay === 'function') {
                        chart.createOverlay('priceLine', lineOptions);
                        created = true;
                      }
                    } catch(_) {}

                    // Fallback to horizontal types using latest timestamp
                    if (!created) {
                      var lastTs = undefined;
                      try { var dl = (chart.chart && chart.chart.getDataList && chart.chart.getDataList()) || []; if (dl && dl.length) { lastTs = dl[dl.length - 1].timestamp || dl[dl.length - 1].time; } } catch(_) {}
                      var pointA = lastTs ? { timestamp: lastTs, value: price } : { value: price };
                      var pointB = lastTs ? { timestamp: lastTs + 60000, value: price } : { value: price };
                      var opts = { id: lineId, points: [pointA], styles: lineOptions.styles, text: lineOptions.text };
                      try { if (chart.chart && typeof chart.chart.createOverlay === 'function') { chart.chart.createOverlay('horizontalStraightLine', opts); created = true; } } catch(_) {}
                      if (!created) {
                        opts.points = [pointA, pointB];
                        try { if (chart.chart && typeof chart.chart.createOverlay === 'function') { chart.chart.createOverlay('horizontalSegment', opts); created = true; } } catch(_) {}
                      }
                    }
                    
                    post({ debug: 'Price line drawn at: ' + price });
                    return lineId;
                  } catch(e) {
                    post({ error: 'Failed to draw price line: ' + (e && e.message || e) });
                  }
                },
                
                // Enhanced horizontal line with better value display
                drawHorizontalLineWithValue: function(price, color, label, showValue, valuePosition) {
                  try {
                    if (!chart) return;
                    
                    var lineId = 'horizontal_line_' + Date.now() + '_' + Math.random();
                    var displayText = label || '';
                    var lineColor = color || '#00D4AA';
                    
                    // Add price value to label if requested
                    if (showValue !== false) {
                      var formattedPrice = typeof price === 'number' ? price.toFixed(2) : String(price);
                      displayText = displayText ? displayText + ' (' + formattedPrice + ')' : formattedPrice;
                    }
                    
                    var lineOptions = {
                      id: lineId,
                      points: [{ value: price }],
                      styles: {
                        line: {
                          color: lineColor,
                          size: 3, // Make line thicker for better visibility
                          style: 'solid'
                        },
                        text: {
                          color: lineColor,
                          size: 14, // Larger text
                          family: 'Arial',
                          weight: 'bold',
                          offset: valuePosition === 'left' ? [-10, 0] : [10, 0],
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          borderRadius: 4,
                          paddingLeft: 6,
                          paddingRight: 6,
                          paddingTop: 3,
                          paddingBottom: 3
                        }
                      },
                      text: displayText
                    };
                    
                    var created = false;
                    var method = 'unknown';
                    var chartInstance = chart.chart || chart;
                    
                    // Try horizontalStraightLine first (infinite line)
                    if (!created && chartInstance && typeof chartInstance.createOverlay === 'function') {
                      try {
                        var overlayId = chartInstance.createOverlay('horizontalStraightLine', lineOptions);
                        if (overlayId) {
                          created = true;
                          method = 'horizontalStraightLine';
                          lineId = overlayId;
                          post({ debug: 'horizontalStraightLine created successfully with ID: ' + overlayId });
                        } else {
                          post({ debug: 'horizontalStraightLine returned null/undefined' });
                        }
                      } catch(e) {
                        post({ debug: 'horizontalStraightLine in drawHorizontalLineWithValue failed: ' + (e && e.message || e) });
                      }
                    }
                    
                    // Fallback to priceLine
                    if (!created && chartInstance && typeof chartInstance.createOverlay === 'function') {
                      try {
                        var overlayId = chartInstance.createOverlay('priceLine', lineOptions);
                        if (overlayId) {
                          created = true;
                          method = 'priceLine';
                          lineId = overlayId;
                          post({ debug: 'priceLine created successfully with ID: ' + overlayId });
                        } else {
                          post({ debug: 'priceLine returned null/undefined' });
                        }
                      } catch(e) {
                        post({ debug: 'priceLine in drawHorizontalLineWithValue failed: ' + (e && e.message || e) });
                      }
                    }
                    
                    // If overlays don't work, try the existing drawPriceLine function
                    if (!created && typeof this.drawPriceLine === 'function') {
                      try {
                        var resultId = this.drawPriceLine(price, lineColor, displayText);
                        if (resultId) {
                          created = true;
                          method = 'drawPriceLine_fallback';
                          lineId = resultId;
                          post({ debug: 'drawPriceLine fallback created successfully with ID: ' + resultId });
                        }
                      } catch(e) {
                        post({ debug: 'drawPriceLine fallback failed: ' + (e && e.message || e) });
                      }
                    }
                    
                    // Force chart refresh to ensure visibility
                    try {
                      if (chartInstance && typeof chartInstance.refresh === 'function') {
                        chartInstance.refresh();
                      } else if (chartInstance && typeof chartInstance.invalidate === 'function') {
                        chartInstance.invalidate();
                      }
                    } catch(_) {}
                    
                    post({ 
                      debug: 'Horizontal line with value drawn at: ' + price, 
                      label: displayText, 
                      created: created,
                      method: method,
                      lineId: lineId,
                      color: lineColor
                    });
                    return created ? lineId : null;
                  } catch(e) {
                    post({ error: 'Failed to draw horizontal line with value: ' + (e && e.message || e) });
                    return null;
                  }
                },
                
                drawTradeZone: function(entryPrice, exitPrice, startTime, endTime, color, label, type) {
                  try {
                    if (!chart || !chart.chart) return;
                    
                    var rectId = 'trade_zone_' + Date.now() + '_' + Math.random();
                    var isLong = type === 'long';
                    var isProfit = (isLong && exitPrice > entryPrice) || (!isLong && exitPrice < entryPrice);
                    var defaultColor = isProfit ? 'rgba(0, 212, 170, 0.2)' : 'rgba(255, 82, 82, 0.2)';
                    
                    var rectOptions = {
                      id: rectId,
                      points: [
                        { timestamp: startTime, value: entryPrice },
                        { timestamp: endTime, value: exitPrice }
                      ],
                      styles: {
                        style: 'fill',
                        color: color || defaultColor,
                        borderColor: color ? color.replace('0.2', '1') : (isProfit ? '#00D4AA' : '#FF5252'),
                        borderSize: 1,
                        borderStyle: 'solid'
                      },
                      text: label || (type + ' trade')
                    };
                    
                    if (typeof chart.chart.createOverlay === 'function') {
                      chart.chart.createOverlay('rect', rectOptions);
                    } else if (typeof chart.createOverlay === 'function') {
                      chart.createOverlay('rect', rectOptions);
                    }
                    
                    post({ debug: 'Trade zone drawn: ' + label });
                    return rectId;
                  } catch(e) {
                    post({ error: 'Failed to draw trade zone: ' + (e && e.message || e) });
                  }
                },
                
                drawStopLoss: function(price, color, label) {
                  try {
                    return this.drawPriceLine(price, color || '#FF5252', label || 'Stop Loss');
                  } catch(e) {
                    post({ error: 'Failed to draw stop loss: ' + (e && e.message || e) });
                  }
                },
                
                drawTakeProfit: function(price, color, label) {
                  try {
                    return this.drawPriceLine(price, color || '#00D4AA', label || 'Take Profit');
                  } catch(e) {
                    post({ error: 'Failed to draw take profit: ' + (e && e.message || e) });
                  }
                },
                
                clearAllDrawings: function() {
                  try {
                    if (chart && chart.chart && typeof chart.chart.removeOverlay === 'function') {
                      chart.chart.removeOverlay();
                    } else if (chart && typeof chart.removeOverlay === 'function') {
                      chart.removeOverlay();
                    }
                    post({ debug: 'All drawings cleared' });
                  } catch(e) {
                    post({ error: 'Failed to clear drawings: ' + (e && e.message || e) });
                  }
                },
                
                removeOverlayById: function(id) {
                  try {
                    if (!id) return false;
                    if (chart && chart.chart && typeof chart.chart.removeOverlay === 'function') {
                      chart.chart.removeOverlay(id);
                      return true;
                    } else if (chart && typeof chart.removeOverlay === 'function') {
                      chart.removeOverlay(id);
                      return true;
                    }
                    return false;
                  } catch(e) {
                    post({ error: 'Failed to remove overlay: ' + (e && e.message || e) });
                    return false;
                  }
                },
                
                // Add horizontal ray line at specific price level
                addHorizontalRayLineAtLevel: function(priceLevel, timestamp, color, label) {
                  try {
                    if (!chart) {
                      post({ error: 'Widget not available' });
                      return;
                    }

                    var currentTime = timestamp || Date.now();
                    var lineId = 'horizontal_ray_' + Date.now() + '_' + Math.random();
                    var displayText = label || ('Ray Line $' + priceLevel.toFixed(2));
                    var lineColor = color || '#00D4AA';
                    
                    var created = false;
                    var method = 'unknown';
                    
                    // Get the underlying chart instance
                    var chartInstance = chart.chart || chart;
                    
                    if (!chartInstance) {
                      post({ error: 'No chart instance available' });
                      return null;
                    }
                    
                    // Method 1: Try horizontalRayLine (the actual overlay type from KLineCharts)
                    if (!created && typeof chartInstance.createOverlay === 'function') {
                      try {
                        // KLineCharts horizontalRayLine expects a single point with timestamp and value
                        var rayLineOptions = {
                          id: lineId,
                          points: [
                            { timestamp: currentTime, value: priceLevel }
                          ],
                          styles: {
                            line: {
                              color: lineColor,
                              size: 2,
                              style: 'solid'
                            },
                            text: {
                              color: lineColor,
                              size: 12,
                              family: 'Arial',
                              weight: 'bold',
                              offset: [5, 0]
                            }
                          },
                          text: displayText
                        };
                        
                        // Create the overlay using the correct KLineCharts API
                        var overlayId = chartInstance.createOverlay('horizontalRayLine', rayLineOptions);
                        if (overlayId) {
                          created = true;
                          method = 'horizontalRayLine';
                          lineId = overlayId;
                          post({ debug: 'Successfully created horizontalRayLine overlay with ID: ' + overlayId });
                        } else {
                          post({ debug: 'horizontalRayLine createOverlay returned null/undefined' });
                        }
                      } catch(e) {
                        post({ debug: 'horizontalRayLine failed: ' + (e && e.message || e) });
                      }
                    }
                    
                    // Method 2: Try horizontalStraightLine as fallback
                    if (!created && typeof chartInstance.createOverlay === 'function') {
                      try {
                        var straightLineOptions = {
                          id: lineId + '_straight',
                          points: [{ value: priceLevel }],
                          styles: {
                            line: {
                              color: lineColor,
                              size: 2,
                              style: 'solid'
                            },
                            text: {
                              color: lineColor,
                              size: 12,
                              family: 'Arial',
                              weight: 'bold',
                              offset: [5, 0]
                            }
                          },
                          text: displayText
                        };
                        
                        chartInstance.createOverlay('horizontalStraightLine', straightLineOptions);
                        created = true;
                        method = 'horizontalStraightLine';
                        lineId = lineId + '_straight';
                        post({ debug: 'Successfully created horizontalStraightLine overlay' });
                      } catch(e) {
                        post({ debug: 'horizontalStraightLine failed: ' + (e && e.message || e) });
                      }
                    }
                    
                    // Method 3: Try priceLine as fallback
                    if (!created && typeof chartInstance.createOverlay === 'function') {
                      try {
                        var priceLineOptions = {
                          id: lineId + '_price',
                          points: [{ value: priceLevel }],
                          styles: {
                            line: {
                              color: lineColor,
                              size: 2,
                              style: 'solid'
                            },
                            text: {
                              color: lineColor,
                              size: 12,
                              family: 'Arial',
                              weight: 'bold',
                              offset: [5, 0]
                            }
                          },
                          text: displayText
                        };
                        
                        chartInstance.createOverlay('priceLine', priceLineOptions);
                        created = true;
                        method = 'priceLine';
                        lineId = lineId + '_price';
                        post({ debug: 'Successfully created priceLine overlay' });
                      } catch(e) {
                        post({ debug: 'priceLine failed: ' + (e && e.message || e) });
                      }
                    }
                    
                    // Method 4: Try using existing drawHorizontalLineWithValue function
                    if (!created && typeof this.drawHorizontalLineWithValue === 'function') {
                      try {
                        var resultId = this.drawHorizontalLineWithValue(priceLevel, lineColor, displayText, true, 'right');
                        if (resultId) {
                          created = true;
                          method = 'drawHorizontalLineWithValue';
                          lineId = resultId;
                        }
                      } catch(e) {
                        post({ debug: 'drawHorizontalLineWithValue failed: ' + (e && e.message || e) });
                      }
                    }
                    
                    // Method 5: Try using existing drawPriceLine function
                    if (!created && typeof this.drawPriceLine === 'function') {
                      try {
                        var resultId = this.drawPriceLine(priceLevel, lineColor, displayText);
                        if (resultId) {
                          created = true;
                          method = 'drawPriceLine';
                          lineId = resultId;
                        }
                      } catch(e) {
                        post({ debug: 'drawPriceLine failed: ' + (e && e.message || e) });
                      }
                    }
                    
                    // Debug: Log available overlay types and chart instance info
                    if (!created) {
                      try {
                        // Log chart instance type and available methods
                        var chartMethods = [];
                        for (var prop in chartInstance) {
                          if (typeof chartInstance[prop] === 'function') {
                            chartMethods.push(prop);
                          }
                        }
                        post({ debug: 'Chart instance methods:', methods: chartMethods.slice(0, 15) });
                        
                        // Try to get supported overlays if method exists
                        if (typeof chartInstance.getSupportedOverlays === 'function') {
                          var supportedOverlays = chartInstance.getSupportedOverlays();
                          post({ debug: 'Available overlay types:', overlays: supportedOverlays });
                        } else {
                          post({ debug: 'getSupportedOverlays method not available' });
                        }
                        
                        // Check if we can access the global overlay registry
                        if (typeof window.klinecharts !== 'undefined' && window.klinecharts.getSupportedOverlays) {
                          var globalOverlays = window.klinecharts.getSupportedOverlays();
                          post({ debug: 'Global supported overlays:', overlays: globalOverlays });
                        }
                      } catch(e) {
                        post({ debug: 'Debug info gathering failed: ' + (e && e.message || e) });
                      }
                    }
                    
                    // Get current price range for debugging
                    var priceRange = null;
                    var currentPrice = null;
                    try {
                      // Try multiple ways to get chart data
                      var dataList = null;
                      if (chartInstance && typeof chartInstance.getDataList === 'function') {
                        dataList = chartInstance.getDataList();
                      } else if (chart && typeof chart.getDataList === 'function') {
                        dataList = chart.getDataList();
                      }
                      
                      if (dataList && dataList.length > 0) {
                        var lastCandle = dataList[dataList.length - 1];
                        currentPrice = lastCandle.close || lastCandle.c || lastCandle.value || lastCandle.price;
                        post({ debug: 'Found current price: ' + currentPrice, dataLength: dataList.length });
                      } else {
                        post({ debug: 'No data list available or empty', hasDataList: !!dataList });
                      }
                      
                      // Try to get visible range
                      if (chartInstance && typeof chartInstance.getVisibleRange === 'function') {
                        var visibleRange = chartInstance.getVisibleRange();
                        if (visibleRange) {
                          priceRange = { from: visibleRange.from, to: visibleRange.to };
                        }
                      } else if (chart && typeof chart.getVisibleRange === 'function') {
                        var visibleRange = chart.getVisibleRange();
                        if (visibleRange) {
                          priceRange = { from: visibleRange.from, to: visibleRange.to };
                        }
                      }
                    } catch(e) {
                      post({ debug: 'Could not get price range info: ' + (e && e.message || e) });
                    }
                    
                    post({ 
                      debug: 'Horizontal ray line at level: ' + priceLevel, 
                      id: lineId, 
                      created: created,
                      method: method,
                      color: lineColor,
                      label: displayText,
                      timestamp: currentTime,
                      currentPrice: currentPrice,
                      priceRange: priceRange,
                      priceLevel: priceLevel
                    });
                    
                    return created ? lineId : null;
                  } catch(e) {
                    post({ error: 'Failed to add horizontal ray line: ' + (e && e.message || e) });
                    return null;
                  }
                },
                
                // Chart analysis function
                analyzeChart: function() {
                  try {
                    if (!chart || !chart.chart) return null;
                    
                    // Get visible data range
                    var visibleRange = chart.chart.getVisibleRange();
                    var dataList = chart.chart.getDataList();
                    
                    if (!dataList || dataList.length === 0) return null;
                    
                    // Simple analysis - find support/resistance levels
                    var recentData = dataList.slice(-50); // Last 50 candles
                    var highs = recentData.map(function(d) { return d.high; });
                    var lows = recentData.map(function(d) { return d.low; });
                    var closes = recentData.map(function(d) { return d.close; });
                    
                    var currentPrice = closes[closes.length - 1];
                    var maxHigh = Math.max.apply(Math, highs);
                    var minLow = Math.min.apply(Math, lows);
                    
                    // Calculate simple moving averages
                    var sma20 = closes.slice(-20).reduce(function(a, b) { return a + b; }, 0) / 20;
                    var sma50 = closes.length >= 50 ? closes.slice(-50).reduce(function(a, b) { return a + b; }, 0) / 50 : sma20;
                    
                    // Determine trend
                    var trend = currentPrice > sma20 && sma20 > sma50 ? 'bullish' : 
                               currentPrice < sma20 && sma20 < sma50 ? 'bearish' : 'sideways';
                    
                    // Calculate potential entry/exit levels
                    var analysis = {
                      symbol: ${JSON.stringify(safeSymbol)},
                      currentPrice: currentPrice,
                      trend: trend,
                      resistance: maxHigh,
                      support: minLow,
                      sma20: sma20,
                      sma50: sma50,
                      suggestedEntry: trend === 'bullish' ? currentPrice * 0.98 : currentPrice * 1.02,
                      suggestedExit: trend === 'bullish' ? currentPrice * 1.05 : currentPrice * 0.95,
                      stopLoss: trend === 'bullish' ? currentPrice * 0.95 : currentPrice * 1.05,
                      takeProfit: trend === 'bullish' ? currentPrice * 1.08 : currentPrice * 0.92,
                      timestamp: Date.now()
                    };
                    
                    post({ analysis: analysis });
                    return analysis;
                  } catch(e) {
                    post({ error: 'Chart analysis failed: ' + (e && e.message || e) });
                    return null;
                  }
                }
              }; 
            } catch(e) {
              post({ error: 'Failed to set up external chart functions: ' + (e && e.message || e) });
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
      showYAxis,
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

              // Handle chart analysis results
              if (msg && msg.analysis && onTradeAnalysis) {
                onTradeAnalysis(msg.analysis);
              }

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
);

export default KLineProChart;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    width: "100%",
  },
});
