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
  showGrid?: boolean;
  levels?: {
    entries?: number[];
    exits?: number[];
    takeProfits?: number[];
  };
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
  showGrid = false,
  levels,
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

  // Update levels dynamically
  useEffect(() => {
    if (!webRef.current) return;
    try {
      const js = `(() => { try { if (window.__KLP__ && typeof window.__KLP__.setLevels === 'function') { window.__KLP__.setLevels(${JSON.stringify(
        levels || {}
      )}); } } catch (_) {} })();`;
      webRef.current.injectJavaScript(js);
    } catch {}
  }, [levels]);

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

      /* Ensure all chart elements can handle custom touch gestures */
      .klinecharts-pro, .klinecharts-pro * {
        touch-action: none;
      }
      
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
              show: true,
              last: {
                show: true,
                line: {
                  show: true,
                  style: 'dashed',
                  dashedValue: [4, 4],
                  size: 1
                },
                text: { show: true }
              },
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
              show: true,
              last: {
                show: true,
                line: {
                  show: true,
                  style: 'dashed',
                  dashedValue: [4, 4],
                  size: 1
                },
                text: { show: true }
              },
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
              show: true,
              last: {
                show: true,
                line: {
                  show: true,
                  style: 'dashed',
                  dashedValue: [4, 4],
                  size: 1
                },
                text: { show: true }
              },
              high: { show: false },
              low: { show: false }
            }
          }
        };
        var INITIAL_CHART_TYPE = ${JSON.stringify(initialChartType)};
        var LEVELS = ${JSON.stringify(levels || {})};
        function applyChartType(chart, type){
          try {
            post({ debug: 'Attempting to apply chart type: ' + type });
            
            if (!chart) {
              post({ warn: 'Chart instance is null/undefined' });
              return;
            }
            
            var style = CHART_TYPES[type] || CHART_TYPES.candle;
            post({ debug: 'Using style config:', style: style });
            
            if (typeof chart.setStyles === 'function') {
              post({ debug: 'Trying setStyles method' });
              chart.setStyles({ candle: style });
            }
            
            post({ debug: 'Chart type application completed for: ' + type });
          } catch (e) { 
            post({ error: 'setChartType failed: ' + (e && e.message || e) }); 
          }
        }
        function create(){
          try {
            
            if (!window.klinechartspro) { 
              post({ warn: 'klinechartspro not loaded yet' });
              return false; 
            }
            
            const { KLineChartPro } = window.klinechartspro;
            // Custom Polygon-backed Datafeed compatible with Pro's Datafeed interface
            class PolygonDatafeed {
              constructor(apiKey) {
                this._apiKey = apiKey;
                this._prevSymbolMarket = undefined;
                this._ws = null;
              }
              async searchSymbols(search) {
                try {
                  const url = 'https://api.polygon.io/v3/reference/tickers?apiKey=' + encodeURIComponent(this._apiKey) + '&active=true&search=' + encodeURIComponent(search || '');
                  const res = await fetch(url);
                  const result = await res.json();
                  return (result.results || []).map(function(data){
                    return {
                      ticker: data.ticker,
                      name: data.name,
                      shortName: data.ticker,
                      market: data.market,
                      exchange: data.primary_exchange,
                      priceCurrency: data.currency_name,
                      type: data.type,
                      logo: 'data:image/png;'
                    };
                  });
                } catch (e) { return []; }
              }
              async getHistoryKLineData(symbol, period, from, to) {
                try {
                  const url = 'https://api.polygon.io/v2/aggs/ticker/' + encodeURIComponent(symbol.ticker) +
                              '/range/' + String(period.multiplier) + '/' + String(period.timespan) + '/' + String(from) + '/' + String(to) +
                              '?apiKey=' + encodeURIComponent(this._apiKey);
                  const res = await fetch(url);
                  const result = await res.json();
                  return (result.results || []).map(function(d){
                    return {
                      timestamp: d.t,
                      open: d.o,
                      high: d.h,
                      low: d.l,
                      close: d.c,
                      volume: d.v,
                      turnover: d.vw
                    };
                  });
                } catch (e) { return []; }
              }
              subscribe(symbol, period, callback) {
                try {
                  if (this._prevSymbolMarket !== symbol.market) {
                    if (this._ws && this._ws.close) { try { this._ws.close(); } catch(_){} }
                    this._ws = new WebSocket('wss://delayed.polygon.io/' + String(symbol.market || 'stocks'));
                    this._ws.onopen = () => {
                      try { this._ws && this._ws.send(JSON.stringify({ action: 'auth', params: this._apiKey })); } catch(_){}
                    };
                    this._ws.onmessage = (event) => {
                      try {
                        const result = JSON.parse(event.data);
                        if (Array.isArray(result) && result.length > 0) {
                          const first = result[0];
                          if (first.ev === 'status') {
                            if (first.status === 'auth_success') {
                              try { this._ws && this._ws.send(JSON.stringify({ action: 'subscribe', params: 'T.' + symbol.ticker })); } catch(_){}
                            }
                          } else {
                            // Simple mapping when a trade event arrives; adapt as needed for aggregate channels
                            const msg = Array.isArray(result) ? result[0] : result;
                            if (msg && (msg.sym || msg.ticker)) {
                              callback({
                                timestamp: msg.s || msg.t,
                                open: msg.o || msg.p || msg.price,
                                high: msg.h || msg.p || msg.price,
                                low: msg.l || msg.p || msg.price,
                                close: msg.c || msg.p || msg.price,
                                volume: msg.v,
                                turnover: msg.vw
                              });
                            }
                          }
                        }
                      } catch(_){}
                    };
                  } else {
                    try { this._ws && this._ws.send(JSON.stringify({ action: 'subscribe', params: 'T.' + symbol.ticker })); } catch(_){}
                  }
                  this._prevSymbolMarket = symbol.market;
                } catch(_){}
              }
              unsubscribe(symbol, period) {
                try { this._ws && this._ws.send(JSON.stringify({ action: 'unsubscribe', params: 'T.' + symbol.ticker })); } catch(_){}
              }
            }
            if (!${JSON.stringify(
              !!apiKey
            )}) { post({ warn: 'Missing POLYGON_API_KEY (extra.polygonApiKey)' }); }
            
            const datafeed = new PolygonDatafeed(${JSON.stringify(apiKey)});
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
                    showRule: 'none'
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
                crosshair: {
                  show: true,
                  horizontal: {
                    show: true,
                    line: {
                      show: true,
                      // 'solid' | 'dashed'
                      style: 'dashed',
                      dashedValue: [4, 2],
                      size: 1,
                      color: '#888888'
                    },
                    text: {
                      show: true,
                      // 'fill' | 'stroke' | 'stroke_fill'
                      style: 'fill',
                      color: '#FFFFFF',
                      size: 12,
                      family: 'Helvetica Neue',
                      weight: 'normal',
                      // 'solid' | 'dashed'
                      borderStyle: 'solid',
                      borderDashedValue: [2, 2],
                      borderSize: 1,
                      borderColor: '#686D76',
                      borderRadius: 2,
                      paddingLeft: 4,
                      paddingRight: 4,
                      paddingTop: 4,
                      paddingBottom: 4,
                      backgroundColor: '#686D76'
                    },
                    // e.g.
                    // [{
                    //    id: 'icon_id',
                    //    position: 'left', // 'left' | 'middle' | 'right'
                    //    marginLeft: 8,
                    //    marginTop: 6,
                    //    marginRight: 0,
                    //    marginBottom: 0,
                    //    paddingLeft: 1,
                    //    paddingTop: 1,
                    //    paddingRight: 1,
                    //    paddingBottom: 1,
                    //    size: 12,
                    //    color: '#76808F',
                    //    activeColor: '#76808F',
                    //    backgroundColor: 'rgba(33, 150, 243, 0.2)',
                    //    activeBackgroundColor: 'rgba(33, 150, 243, 0.4)',
                    //    type: 'path', // 'path', 'icon_font'
                    //    content: {
                    //      style: 'stroke', // 'stroke', 'fill'
                    //      path: 'M6.81029,6.02908L11.7878,1.02746C12.0193,0.79483,12.0193,0.445881,11.7878,0.213247C11.5563,-0.019386,11.209,-0.019386,10.9775,0.213247L6,5.21486L1.02251,0.174475C0.790997,-0.0581583,0.44373,-0.0581583,0.212219,0.174475C-0.0192925,0.407108,-0.0192925,0.756058,0.212219,0.988691L5.18971,6.02908L0.173633,11.0307C-0.0578778,11.2633,-0.0578778,11.6123,0.173633,11.8449C0.289389,11.9612,0.44373,12,0.598071,12C0.752411,12,0.906752,11.9612,1.02251,11.8449L6,6.8433L10.9775,11.8449C11.0932,11.9612,11.2476,12,11.4019,12C11.5563,12,11.7106,11.9612,11.8264,11.8449C12.0579,11.6123,12.0579,11.2633,11.8264,11.0307L6.81029,6.02908Z',
                    //      lineWidth: 1,
                    //    }
                    // }]
                    features: []
                  },
                  vertical: {
                    show: true,
                    line: {
                      show: true,
                      // 'solid'|'dashed'
                      style: 'dashed',
                      dashedValue: [4, 2],
                      size: 1,
                      color: '#888888'
                    },
                    text: {
                      show: true,
                      // 'fill' | 'stroke' | 'stroke_fill'
                      style: 'fill',
                      color: '#FFFFFF',
                      size: 12,
                      family: 'Helvetica Neue',
                      weight: 'normal',
                      // 'solid' | 'dashed'
                      borderStyle: 'solid',
                      borderDashedValue: [2, 2],
                      borderSize: 1,
                      borderColor: '#686D76',
                      borderRadius: 2,
                      paddingLeft: 4,
                      paddingRight: 4,
                      paddingTop: 4,
                      paddingBottom: 4,
                      backgroundColor: '#686D76'
                    }
                  }
                },
                overlay: {
                  point: {
                    color: '#1677FF',
                    borderColor: 'rgba(22, 119, 255, 0.35)',
                    borderSize: 1,
                    radius: 5,
                    activeColor: '#1677FF',
                    activeBorderColor: 'rgba(22, 119, 255, 0.35)',
                    activeBorderSize: 3,
                    activeRadius: 5
                  },
                  line: {
                    // 'solid' | 'dashed'
                    style: 'solid',
                    smooth: false,
                    color: '#1677FF',
                    size: 1,
                    dashedValue: [2, 2]
                  },
                  rect: {
                    // 'fill' | 'stroke' | 'stroke_fill'
                    style: 'fill',
                    color: 'rgba(22, 119, 255, 0.25)',
                    borderColor: '#1677FF',
                    borderSize: 1,
                    borderRadius: 0,
                    // 'solid' | 'dashed'
                    borderStyle: 'solid',
                    borderDashedValue: [2, 2]
                  },
                  polygon: {
                    // 'fill' | 'stroke' | 'stroke_fill'
                    style: 'fill',
                    color: '#1677FF',
                    borderColor: '#1677FF',
                    borderSize: 1,
                    // 'solid' | 'dashed'
                    borderStyle: 'solid',
                    borderDashedValue: [2, 2]
                  },
                  circle: {
                    // 'fill' | 'stroke' | 'stroke_fill'
                    style: 'fill',
                    color: 'rgba(22, 119, 255, 0.25)',
                    borderColor: '#1677FF',
                    borderSize: 1,
                    // 'solid' | 'dashed'
                    borderStyle: 'solid',
                    borderDashedValue: [2, 2]
                  },
                  arc: {
                    // 'solid' | 'dashed'
                    style: 'solid',
                    color: '#1677FF',
                    size: 1,
                    dashedValue: [2, 2]
                  },
                  text: {
                    // 'fill' | 'stroke' | 'stroke_fill'
                    style: 'fill',
                    color: '#FFFFFF',
                    size: 12,
                    family: 'Helvetica Neue',
                    weight: 'normal',
                    // 'solid' | 'dashed'
                    borderStyle: 'solid',
                    borderDashedValue: [2, 2],
                    borderSize: 0,
                    borderRadius: 2,
                    borderColor: '#1677FF',
                    paddingLeft: 0,
                    paddingRight: 0,
                    paddingTop: 0,
                    paddingBottom: 0,
                    backgroundColor: '#1677FF'
                  }
                },
                grid: { 
                  show: ${showGrid},
                  horizontal: {
                    show: ${showGrid},
                    size: 1,
                    color: ${JSON.stringify(
                      theme === "dark" ? "#2a2a2a" : "#EDEDED"
                    )},
                    style: 'dashed',
                    dashedValue: [2, 2]
                  },
                  vertical: {
                    show: ${showGrid},
                    size: 1,
                    color: ${JSON.stringify(
                      theme === "dark" ? "#2a2a2a" : "#EDEDED"
                    )},
                    style: 'dashed',
                    dashedValue: [2, 2]
                  }
                },
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


            // Apply initial chart type
            try { 
              post({ debug: 'Applying initial chart type: ' + INITIAL_CHART_TYPE });
              applyChartType(chart, INITIAL_CHART_TYPE); 
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
                },
                setLevels: function(levels){
                  post({ debug: 'External setLevels called' });
                  applyLevels(levels);
                },
                levelOverlayIds: []
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
            // Apply initial levels if provided
            try { applyLevels(LEVELS); } catch(_) {}
            
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
        scrollEnabled
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
