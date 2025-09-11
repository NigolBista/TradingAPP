import React, { useMemo, useRef, useEffect, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  theme?: "dark" | "light";
  chartType?: "candle" | "line" | "area";
  showVolume?: boolean;
  showMA?: boolean;
  showTopInfo?: boolean;
  showGrid?: boolean;
  showPriceAxisLine?: boolean;
  showTimeAxisLine?: boolean;
  showPriceAxisText?: boolean;
  showTimeAxisText?: boolean;
  showLastPriceLabel?: boolean;
  flushRightEdge?: boolean;
  showSessions?: boolean;
  levels?: {
    entries?: number[];
    exits?: number[];
    takeProfits?: number[];
    // Enhanced level types for detailed labeling
    entry?: number;
    lateEntry?: number;
    exit?: number;
    lateExit?: number;
    stop?: number;
    targets?: number[];
  };
  // Optional: provide custom bars to render instead of fetching
  customBars?: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    turnover?: number;
  }>;
  // Optional: simpler custom series (will be converted to OHLC with equal values)
  customData?: Array<{ time: number; value: number }>;
  // New: dynamic indicators configuration
  indicators?: IndicatorConfig[];
  // New: indicator override callback setter
  onOverrideIndicator?: (
    overrideFn: (
      id: string | { name: string; paneId?: string },
      styles: any,
      calcParams?: any
    ) => void
  ) => void;
  // Alert click callback
  onAlertClick?: (price: number) => void;
  // Alerts to display as price lines
  alerts?: Array<{
    id?: string;
    price: number;
    condition: string;
    isActive: boolean;
  }>;
  // Fired when user taps an existing alert line on the chart
  onAlertSelected?: (payload: { id: string; price: number; y: number }) => void;
  // Fired when user drags an alert line and releases with a new price
  onAlertMoved?: (payload: { id: string; price: number }) => void;
}

export interface IndicatorConfig {
  id?: string;
  name: string; // e.g., 'MA', 'EMA', 'MACD', 'RSI'
  overlay?: boolean; // true to draw on candle pane when compatible
  calcParams?: any; // e.g., [5,10,30,60]
  styles?: any; // pass-through style object to klinecharts
}

export default function SimpleKLineChart({
  symbol,
  timeframe = "1D",
  height = 280,
  theme = "dark",
  chartType = "candle",
  showVolume = true,
  showMA = true,
  showTopInfo = true,
  showGrid = true,
  showPriceAxisLine = false,
  showTimeAxisLine = false,
  showPriceAxisText,
  showTimeAxisText,
  showLastPriceLabel = true,
  showSessions = false,
  levels,
  customBars,
  customData,
  indicators = [],
  onOverrideIndicator,
  onAlertClick,
  alerts = [],
  onAlertSelected,
  onAlertMoved,
}: Props) {
  const webRef = useRef<WebView>(null);
  const isReadyRef = useRef<boolean>(false);
  const [crosshairY, setCrosshairY] = useState<number | null>(null);
  const [crosshairPrice, setCrosshairPrice] = useState<number | null>(null);

  // Method to override indicator styles and parameters
  const overrideIndicator = React.useCallback(
    (
      id: string | { name: string; paneId?: string },
      styles: any,
      calcParams?: any
    ) => {
      if (isReadyRef.current && webRef.current) {
        const message = JSON.stringify({
          type: "overrideIndicator",
          id,
          styles,
          calcParams,
        });
        // console.log("📤 Sending message to WebView:", message);

        // Try both methods
        webRef.current.postMessage(message);

        // Also try injecting JavaScript directly with correct API signature
        const indicatorName = typeof id === "string" ? id : id.name;
        const jsCode = `
          if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.overrideIndicator) {
            console.log('Direct injection: calling overrideIndicator for ${indicatorName}');
            var overrideObj = {
              name: '${indicatorName}',
              styles: ${JSON.stringify(styles)},
              calcParams: ${JSON.stringify(calcParams || null)}
            };
            console.log('Direct injection: override object', overrideObj);
            window.__SIMPLE_KLINE__.overrideIndicator(overrideObj, 'candle_pane', function() {
              console.log('Direct injection: override callback executed');
            });
          } else {
            console.log('Direct injection: overrideIndicator not available');
          }
        `;
        webRef.current.injectJavaScript(jsCode);
      } else {
        console.log(
          "❌ Cannot send message - isReady:",
          isReadyRef.current,
          "webRef:",
          !!webRef.current
        );
      }
    },
    []
  );

  // Expose overrideIndicator method to parent component
  React.useEffect(() => {
    if (onOverrideIndicator) {
      onOverrideIndicator(overrideIndicator);
    }
  }, [onOverrideIndicator, overrideIndicator]);

  // Push alert changes to the WebView without full reload
  useEffect(() => {
    try {
      if (!isReadyRef.current || !webRef.current) return;
      const message = JSON.stringify({ type: "setAlerts", alerts });
      webRef.current.postMessage(message);
    } catch (_) {}
  }, [alerts]);
  const polygonApiKey: string | undefined = (Constants.expoConfig?.extra as any)
    ?.polygonApiKey;

  // Ensure WebView remounts when custom data changes to force a fresh load
  const dataKey = useMemo(() => {
    try {
      const bars =
        customBars && customBars.length > 0
          ? customBars
          : customData && customData.length > 0
          ? customData
          : [];
      if (!Array.isArray(bars) || bars.length === 0) return "0";
      const first = (bars[0] as any).timestamp ?? (bars[0] as any).time ?? 0;
      const last =
        (bars[bars.length - 1] as any).timestamp ??
        (bars[bars.length - 1] as any).time ??
        0;
      return `${bars.length}-${first}-${last}`;
    } catch (_) {
      return "0";
    }
  }, [customBars, customData]);

  // Create a compact hash key for indicators so changes force a refresh
  const indicatorsKey = useMemo(() => {
    try {
      if (!indicators || indicators.length === 0) return "none";
      const norm = indicators.map((i) => ({
        n: String(i.name || ""),
        o: !!i.overlay,
        p: i.calcParams,
        s: i.styles,
      }));
      return JSON.stringify(norm);
    } catch (_) {
      return "err";
    }
  }, [indicators]);

  const html = useMemo(() => {
    const safeSymbol = (symbol || "AAPL").toUpperCase();
    const ct = chartType;
    // Precompute axis text defaults (granular only)
    const showYAxisText =
      typeof showPriceAxisText === "boolean" ? showPriceAxisText : true;
    const showXAxisText =
      typeof showTimeAxisText === "boolean" ? showTimeAxisText : true;

    return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
    <style>
      html, body { margin: 0; padding: 0; background: ${
        theme === "dark" ? "#0a0a0a" : "#ffffff"
      }; width: 100%; height: 100%; }
      #k-line-wrap { width: 100%; height: ${height}px; }
      #k-line-chart { width: 100%; height: 100%; }
      * { touch-action: none; }
    </style>
  </head>
  <body>
    <div id="k-line-wrap"><div id="k-line-chart"></div></div>
    <script src="https://unpkg.com/klinecharts@10.0.0-alpha9/dist/umd/klinecharts.min.js"></script>
    <script>
      (function(){
        function post(msg){ try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {} }
        window.onerror = function(m, s, l, c, e){ post({ error: m || (e && e.message) || 'unknown' }); };

        // Handle messages from React Native
        document.addEventListener('message', function(event) {
          try {
            var data = {};
            try { data = JSON.parse(event.data || '{}'); } catch(_) { data = {}; }
            if (data.type === 'overrideIndicator') {
              if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.overrideIndicator) {
                // Pass the parameters correctly - id, styles, and calcParams separately
                window.__SIMPLE_KLINE__.overrideIndicator(data.id, data.styles, data.calcParams);
              } else {
                post({ error: 'overrideIndicator function not available in __SIMPLE_KLINE__' });
              }
            } else if (data.type === 'setAlerts') {
              try {
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                if (typeof window.__SIMPLE_KLINE__.applyAlerts === 'function') {
                  window.__SIMPLE_KLINE__.applyAlerts(Array.isArray(data.alerts) ? data.alerts : []);
                  // Re-apply after fonts are ready to ensure Material Icons render
                  try {
                    if (document.fonts && document.fonts.ready) {
                      document.fonts.ready.then(function(){
                        try { window.__SIMPLE_KLINE__.applyAlerts(Array.isArray(data.alerts) ? data.alerts : []); } catch(_){ }
                      });
                    } else {
                      setTimeout(function(){
                        try { window.__SIMPLE_KLINE__.applyAlerts(Array.isArray(data.alerts) ? data.alerts : []); } catch(_){ }
                      }, 500);
                    }
                  } catch(_){ }
                }
              } catch(e) { post({ warn: 'setAlerts handler failed', message: String(e && e.message || e) }); }
            } else if (data.type === 'getYForPrice') {
              try {
                var price = Number(data.price);
                var y = null;
                if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.getYForPrice) {
                  y = window.__SIMPLE_KLINE__.getYForPrice(price);
                }
                post({ type: 'pricePosition', price: price, y: y });
              } catch(e) { post({ warn: 'getYForPrice failed', message: String(e && e.message || e) }); }
            } else {
              post({ debug: 'Unknown message type', type: data.type });
            }
          } catch(e) {
            post({ error: 'message_handler_failed', message: String(e && e.message || e), rawData: event.data });
          }
        });

        var SYMBOL = ${JSON.stringify(safeSymbol)};
        var CHART_TYPE = ${JSON.stringify(ct)}; // 'candle' | 'line' | 'area'
        var TF = ${JSON.stringify(timeframe)};
        var SHOW_VOL = ${JSON.stringify(showVolume)};
        var SHOW_MA = ${JSON.stringify(showMA)};
        var SHOW_TOP_INFO = ${JSON.stringify(showTopInfo)};
        var SHOW_GRID = ${JSON.stringify(showGrid)};
        var SHOW_Y_AXIS_LINE = ${JSON.stringify(showPriceAxisLine)};
        var SHOW_X_AXIS_LINE = ${JSON.stringify(showTimeAxisLine)};
        var SHOW_Y_AXIS_TEXT = ${JSON.stringify(showYAxisText)};
        var SHOW_X_AXIS_TEXT = ${JSON.stringify(showXAxisText)};
        var SHOW_LAST_PRICE_LABEL = ${JSON.stringify(showLastPriceLabel)};
        var SHOW_SESSIONS = ${JSON.stringify(showSessions)};
        var LEVELS = ${JSON.stringify(levels || {})};
        var ALERTS = []; // Will be set via postMessage after ready
        var POLY_API_KEY = ${JSON.stringify(polygonApiKey || "")};
        var CUSTOM_BARS = ${JSON.stringify(customBars || [])};
        var CUSTOM_DATA = ${JSON.stringify(
          (customData || []).map(function (p) {
            return {
              timestamp: Number(p.time) || 0,
              open: Number(p.value) || 0,
              high: Number(p.value) || 0,
              low: Number(p.value) || 0,
              close: Number(p.value) || 0,
              volume: 0,
              turnover: 0,
            };
          })
        )};
        var INDICATORS = ${JSON.stringify(indicators || [])};

        function mapPeriod(tf){
          try {
            if (!tf) return { span: 1, type: 'day' };
            var raw = String(tf);
            if (raw === '1D' || raw.toLowerCase() === '1d') return { span: 1, type: 'day' };
            if (raw === '1W' || raw.toLowerCase() === '1w') return { span: 1, type: 'week' };
            if (raw === '1M') return { span: 1, type: 'month' };
            if (raw === '3M') return { span: 3, type: 'month' };
            if (raw === '6M') return { span: 6, type: 'month' };
            if (raw === '1Y') return { span: 1, type: 'year' };
            if (raw === '5Y') return { span: 5, type: 'year' };
            if (/^[0-9]+m$/i.test(raw)) return { span: parseInt(raw), type: 'minute' };
            if (/^[0-9]+h$/i.test(raw)) return { span: parseInt(raw), type: 'hour' };
            return { span: 1, type: 'day' };
          } catch (_) { return { span: 1, type: 'day' }; }
        }

        function applyChartType(chart, t){
          try {
            var type = (t === 'candle') ? 'candle_solid' : 'area';
            var opts = { 
              candle: { 
                type: type,
                priceMark: {
                  last: {
                    show: SHOW_LAST_PRICE_LABEL,
                    line: { show: SHOW_LAST_PRICE_LABEL, size: 1 },
                    text: { show: SHOW_LAST_PRICE_LABEL }
                  },
                  high: { show: false },
                  low: { show: false }
                }
              },
              xAxis: {
                tickText: { show: SHOW_X_AXIS_TEXT },
                axisLine: { show: SHOW_X_AXIS_LINE },
                tickLine: { show: false }
              },
              yAxis: {
                tickText: { show: SHOW_Y_AXIS_TEXT },
                axisLine: { show: SHOW_Y_AXIS_LINE },
                tickLine: { show: false }
              },
              crosshair: {
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
                features: []
              },
                vertical: { text: { show: true } }
              },
              grid: {
                horizontal: {
                  show: SHOW_GRID,
                  display: SHOW_GRID,
                  size: 1,
                  color: ${JSON.stringify(
                    theme === "dark" ? "rgba(255,255,255,0.06)" : "#EDEDED"
                  )},
                  style: 'dashed',
                  dashedValue: [2, 2]
                },
                vertical: {
                  show: SHOW_GRID,
                  display: SHOW_GRID,
                  size: 1,
                  color: ${JSON.stringify(
                    theme === "dark" ? "rgba(255,255,255,0.06)" : "#EDEDED"
                  )},
                  style: 'dashed',
                  dashedValue: [2, 2]
                }
              },
              // Hide/darken the pane separator line between main and volume panes
              separator: {
                size: 1,
                color: ${JSON.stringify(
                  theme === "dark" ? "#0a0a0a" : "#ffffff"
                )}
              }
            };
            if (!SHOW_TOP_INFO) {
              // Hide only the candle (OHLC) header tooltip
              // Keep indicator tooltips visible so MA/indicators still show values
              opts.candle.tooltip = { showRule: 'none' };
            }
            if (typeof chart.setStyles === 'function') chart.setStyles(opts);
            else if (typeof chart.setStyleOptions === 'function') chart.setStyleOptions(opts);
          } catch (e) { post({ warn: 'applyChartType failed', message: String(e && e.message || e) }); }
        }

        function periodToMs(p){
          try {
            var m = (p && p.span) || 1;
            var t = (p && p.type) || 'day';
            if (t === 'minute') return m * 60 * 1000;
            if (t === 'hour') return m * 60 * 60 * 1000;
            if (t === 'day') return m * 24 * 60 * 60 * 1000;
            if (t === 'week') return m * 7 * 24 * 60 * 60 * 1000;
            if (t === 'month') return m * 30 * 24 * 60 * 60 * 1000;
            if (t === 'year') return m * 365 * 24 * 60 * 60 * 1000;
            return m * 24 * 60 * 60 * 1000;
          } catch(_) { return 24 * 60 * 60 * 1000; }
        }

        function create(){
          try {
            if (!window.klinecharts || !window.klinecharts.init) { return false; }
            
            // Register custom labeled line overlay
            if (window.klinecharts.registerOverlay && !window.__LABELED_LINE_REGISTERED__) {
              window.klinecharts.registerOverlay({
                name: 'labeledHorizontalLine',
                totalStep: 1,
                createPointFigures: function({ coordinates, overlay, precision }) {
                  var point = coordinates[0];
                  if (!point) return [];
                  
                  var extendData = overlay.extendData || {};
                  var label = extendData.label || '';
                  var price = extendData.price || 0;
                  var color = extendData.color || '#10B981';
                  // Treat dragHintArrows as a selection flag so we can reuse existing calls
                  var isSelected = !!extendData.dragHintArrows;
                  
                  var figs = [
                    {
                      type: 'line',
                      attrs: {
                        coordinates: [
                          { x: 0, y: point.y },
                          { x: 9999, y: point.y }
                        ]
                      },
                      styles: {
                        color: color,
                        size: 1,
                        style: 'dashed',
                        dashedValue: [10, 6]
                      }
                    }
                  ];

                  if (isSelected) {
                    // Show full label when selected
                    figs.push({
                      type: 'text',
                      attrs: {
                        x: 12,
                        y: point.y - 5,
                        text: label + ' $' + Number(price).toFixed(2),
                        baseline: 'bottom',
                        align: 'left'
                      },
                      styles: {
                        color: '#FFFFFF',
                        size: 11,
                        backgroundColor: color,
                        borderColor: color,
                        borderSize: 1,
                        borderRadius: 3,
                        paddingLeft: 4,
                        paddingRight: 4,
                        paddingTop: 2,
                        paddingBottom: 2
                      }
                    });
                    // Tiny up/down arrows just above/below the line
                    figs.push(
                      {
                        type: 'text',
                        attrs: {
                          x: 6,
                          y: point.y - 8,
                          text: '\u25B2', // ▲
                          baseline: 'bottom',
                          align: 'left'
                        },
                        styles: {
                          color: '#C7CDD7',
                          size: 8,
                          backgroundColor: 'transparent'
                        }
                      },
                      {
                        type: 'text',
                        attrs: {
                          x: 6,
                          y: point.y + 8,
                          text: '\u25BC', // ▼
                          baseline: 'top',
                          align: 'left'
                        },
                        styles: {
                          color: '#C7CDD7',
                          size: 8,
                          backgroundColor: 'transparent'
                        }
                      }
                    );
                  } else {
                    // When not selected, show a small bell icon instead of the label
                    figs.push({
                      type: 'text',
                      attrs: {
                        x: 8,
                        y: point.y - 6,
                        text: '\uE7F4',
                        baseline: 'bottom',
                        align: 'left'
                      },
                      styles: {
                        color: color,
                        family: 'Material Icons',
                        size: 16,
                        backgroundColor: 'transparent'
                      }
                    });
                  }

                  return figs;
                }
              });
              window.__LABELED_LINE_REGISTERED__ = true;
              post({ debug: 'Custom labeled line overlay registered' });
            }

            // Register session background overlay
            if (window.klinecharts.registerOverlay && !window.__SESSION_BG_REGISTERED__) {
              window.klinecharts.registerOverlay({
                name: 'sessionBg',
                // This overlay only draws preset rectangles and should never
                // capture pointer events.  Define it as a pure decoration by
                // disabling interaction steps and default mouse handling so it
                // does not block chart panning.
                totalStep: 0,
                needDefaultMouseEvent: false,
                needCrosshair: false,
                createPointFigures: function({ coordinates, overlay }) {
                  var start = coordinates[0];
                  var end = coordinates[1];
                  if (!start || !end) return [];
                  var color = (overlay.extendData && overlay.extendData.color) || 'rgba(0,0,0,0.1)';
                  return [
                    {
                      type: 'rect',
                      attrs: { x: start.x, y: 0, width: end.x - start.x, height: 9999 },
                      styles: { color: color, style: 'fill' },
                      // Explicitly ignore pointer events so the rectangle does not
                      // intercept touch gestures and block chart panning
                      ignoreEvent: true
                    }
                  ];
                }
              });
              window.__SESSION_BG_REGISTERED__ = true;
              post({ debug: 'Session background overlay registered' });
            }
            
            var chart = window.klinecharts.init('k-line-chart');
            try {
              post({ debug: 'Chart init', symbol: SYMBOL, timeframe: TF, hasCustomBars: (CUSTOM_BARS||[]).length, hasCustomData: (CUSTOM_DATA||[]).length });
            } catch(_){ }
            // Default toggles
            if (SHOW_MA) { try { chart.createIndicator && chart.createIndicator('MA', false, { id: 'candle_pane' }); } catch(_){} }
            if (SHOW_VOL) { try { chart.createIndicator && chart.createIndicator('VOL'); } catch(_){} }
            applyChartType(chart, CHART_TYPE);

            // Set symbol and period
            if (typeof chart.setSymbol === 'function') {
              try { chart.setSymbol({ ticker: SYMBOL }); } catch(_){}
            }
            if (typeof chart.setPeriod === 'function') {
              try { chart.setPeriod(mapPeriod(TF)); } catch(_){}
            }

            // Prefer custom bars when provided; otherwise attach Polygon loader
            var hasCustom = (Array.isArray(CUSTOM_BARS) && CUSTOM_BARS.length > 0) || (Array.isArray(CUSTOM_DATA) && CUSTOM_DATA.length > 0);
            if (hasCustom) {
              try {
                var bars = (Array.isArray(CUSTOM_BARS) && CUSTOM_BARS.length > 0) ? CUSTOM_BARS : CUSTOM_DATA;
                try { bars = bars.slice().sort(function(a,b){ return (a.timestamp||0) - (b.timestamp||0); }); } catch(_){ }
                post({ debug: 'Applying custom bars', count: (bars||[]).length, first: bars && bars[0], last: bars && bars[bars.length-1] });
                var applied = false;
                try {
                  if (chart && typeof chart.setData === 'function') {
                    chart.setData(bars);
                    applied = true;
                    post({ debug: 'setData used' });
                  }
                } catch (e1) { post({ warn: 'setData failed', message: String(e1 && e1.message || e1) }); }
                if (!applied) {
                  try {
                    if (chart && typeof chart.applyNewData === 'function') {
                      chart.applyNewData(bars);
                      applied = true;
                      post({ debug: 'applyNewData used' });
                    }
                  } catch (e2) { post({ warn: 'applyNewData failed', message: String(e2 && e2.message || e2) }); }
                }
                if (!applied) {
                  try {
                    if (chart && typeof chart.applyData === 'function') {
                      chart.applyData(bars);
                      applied = true;
                      post({ debug: 'applyData used' });
                    }
                  } catch (e3) { post({ warn: 'applyData failed', message: String(e3 && e3.message || e3) }); }
                }
                if (!applied) {
                  // Last resort: install a data loader that immediately returns our bars
                  try {
                    if (typeof chart.setDataLoader === 'function') {
                      chart.setDataLoader({
                        getBars: function(ctx){
                          try {
                            var cb = (ctx && ctx.callback) ? ctx.callback : function(){};
                            cb(bars);
                          } catch (e4) { post({ error: 'custom_loader_callback_failed', message: String(e4 && e4.message || e4) }); }
                        }
                      });
                      post({ debug: 'setDataLoader(custom) used' });
                      applied = true;
                    }
                  } catch (e5) { post({ error: 'setDataLoader_custom_failed', message: String(e5 && e5.message || e5) }); }
                }
                if (!applied) { post({ error: 'apply_custom_failed', message: 'No supported API to set data' }); }
              } catch(e) {
                post({ error: 'apply_custom_failed', message: String(e && e.message || e) });
              }
              setTimeout(applySessionBackgrounds, 0);
            } else {
              // v10: Use data loader backed by Polygon.io
              if (typeof chart.setDataLoader === 'function') {
                chart.setDataLoader({
                  getBars: function(ctx){
                    try {
                      var callback = ctx && ctx.callback ? ctx.callback : function(){};
                      var p = mapPeriod(TF);
                      var to = Date.now();
                      var from = to - 500 * periodToMs(p);
                      if (!POLY_API_KEY) {
                        post({ warn: 'Missing Polygon API key' });
                        callback([]);
                        setTimeout(applySessionBackgrounds, 0);
                        return;
                      }
                      var url = 'https://api.polygon.io/v2/aggs/ticker/' + encodeURIComponent(SYMBOL) +
                                '/range/' + p.span + '/' + p.type + '/' + from + '/' + to +
                                '?adjusted=true&sort=asc&limit=50000&apiKey=' + encodeURIComponent(POLY_API_KEY);
                      fetch(url)
                        .then(function(res){ return res.json(); })
                        .then(function(result){
                          var list = (result && result.results) || [];
                          var out = list.map(function(d){
                            return { timestamp: d.t, open: d.o, high: d.h, low: d.l, close: d.c, volume: d.v, turnover: d.vw };
                          });
                          callback(out);
                          setTimeout(applySessionBackgrounds, 0);
                        })
                        .catch(function(err){
                          post({ error: 'polygon_load_failed', message: String(err && err.message || err) });
                          callback([]);
                          setTimeout(applySessionBackgrounds, 0);
                        });
                    } catch (e) { post({ error: 'getBars_failed', message: String(e && e.message || e) }); }
                  }
                });
              } else {
                // Fallback: try Polygon once
                (function(){
                  var p = mapPeriod(TF);
                  var to = Date.now();
                  var from = to - 500 * periodToMs(p);
                  if (!POLY_API_KEY) return;
                  var url = 'https://api.polygon.io/v2/aggs/ticker/' + encodeURIComponent(SYMBOL) +
                            '/range/' + p.span + '/' + p.type + '/' + from + '/' + to +
                            '?adjusted=true&sort=asc&limit=50000&apiKey=' + encodeURIComponent(POLY_API_KEY);
                  fetch(url)
                    .then(function(res){ return res.json(); })
                    .then(function(result){
                      var list = (result && result.results) || [];
                      var out = list.map(function(d){ return { timestamp: d.t, open: d.o, high: d.h, low: d.l, close: d.c, volume: d.v, turnover: d.vw }; });
                      try { chart.applyNewData(out || []); } catch(e) { post({ error: 'applyNewData failed', message: String(e && e.message || e) }); }
                      setTimeout(applySessionBackgrounds, 0);
                    })
                    .catch(function(err){
                      post({ error: 'polygon_load_failed', message: String(err && err.message || err) });
                      setTimeout(applySessionBackgrounds, 0);
                    });
                })();
              }
            }

            // Levels overlay helpers
            function clearLevels(){
              try {
                var ids = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.levelOverlayIds) || [];
                if (ids && ids.length && chart && typeof chart.removeOverlay === 'function') {
                  ids.forEach(function(id){ try { chart.removeOverlay(id); } catch(_){} });
                }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.levelOverlayIds = [];
              } catch(_){}
            }
             function addPriceLine(price, color, label, dragHintArrows, isAlert){
              try {
                if (!price || isNaN(price)) return;
                
                // Create appropriate overlay based on type
                
                var overlayId;
                
                if (isAlert) {
                  // For alerts with drag hints, use custom overlay
                  var customOpts = {
                    name: 'labeledHorizontalLine',
                    lock: false,
                    points: [{ value: Number(price) }],
                    extendData: {
                      label: String(label),
                      price: Number(price),
                      color: color,
                      dragHintArrows: !!dragHintArrows
                    }
                  };
                  
                  try {
                    if (chart && typeof chart.createOverlay === 'function') {
                      overlayId = chart.createOverlay(customOpts);
                      // Alert overlay created successfully
                    }
                  } catch(customError) {
                    post({ debug: 'Custom overlay failed', error: String(customError) });
                  }
                } else {
                  // For levels or non-draggable lines, use standard overlay
                  var lineOpts = {
                    name: 'horizontalStraightLine',
                    lock: true,
                    extend: 'none',
                    points: [{ value: Number(price) }],
                    styles: {
                      line: { 
                        color: color, 
                        size: 1, 
                        style: 'dashed', 
                        dashedValue: [10, 6] 
                      },
                      text: { 
                        show: true, 
                        color: '#FFFFFF', 
                        size: 12, 
                        backgroundColor: color, 
                        borderColor: color, 
                        paddingLeft: 6, 
                        paddingRight: 6, 
                        paddingTop: 3, 
                        paddingBottom: 3, 
                        borderRadius: 4, 
                        text: String(label) + ' $' + Number(price).toFixed(2)
                      }
                    }
                  };
                  
                  if (chart && typeof chart.createOverlay === 'function') {
                    overlayId = chart.createOverlay(lineOpts);
                    // Standard line overlay created successfully
                  }
                }
                
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                var ids = [overlayId].filter(function(id) { return id !== undefined; });
                if (isAlert) {
                  window.__SIMPLE_KLINE__.alertOverlayIds = (window.__SIMPLE_KLINE__.alertOverlayIds || []).concat(ids);
                } else {
                  window.__SIMPLE_KLINE__.levelOverlayIds = (window.__SIMPLE_KLINE__.levelOverlayIds || []).concat(ids);
                }
                
              } catch(e){ 
                post({ error: 'addPriceLine failed', message: String(e && e.message || e), stack: e.stack }); 
              }
            }
            function addAlertLine(price, color, label){
              try {
                if (!price || isNaN(price)) return;
                var idCounter = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.overlayIdCounter) || 1;
                var customId = 'alert_line_' + (idCounter++);
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.overlayIdCounter = idCounter;
                var lineId = undefined;
                if (chart && typeof chart.createOverlay === 'function') {
                  try {
                    var overlayCfg = {
                      name: 'priceLine',
                      id: customId,
                      lock: false,
                      extendData: { price: price, label: label },
                      styles: {
                        line: { color: color || '#F59E0B', size: 1, style: 'dashed' },
                        text: { color: color || '#F59E0B', size: 10, backgroundColor: 'rgba(0,0,0,0.4)' }
                      }
                    };
                    lineId = chart.createOverlay(overlayCfg);
                    post({ debug: 'Alert line created', id: lineId || customId, price: price, label: label });
                  } catch(e) { post({ warn: 'createOverlay failed for alert', message: String(e && e.message || e) }); }
                }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                var ids = [lineId, customId].filter(function(id) { return id !== undefined; });
                if (isAlert) {
                  window.__SIMPLE_KLINE__.alertOverlayIds = (window.__SIMPLE_KLINE__.alertOverlayIds || []).concat(ids);
                } else {
                  window.__SIMPLE_KLINE__.levelOverlayIds = (window.__SIMPLE_KLINE__.levelOverlayIds || []).concat(ids);
                }
              } catch(e){ post({ error: 'addPriceLine failed', message: String(e && e.message || e) }); }
            }
            function applyLevels(levels){
              try {
                clearLevels();
                
                // Debug logging
                post({ debug: 'applyLevels called', levels: JSON.stringify(levels) });
                
                // Enhanced level handling with specific labels
                var hasDetailedLevels = levels && (
                  levels.entry !== undefined || levels.lateEntry !== undefined ||
                  levels.exit !== undefined || levels.lateExit !== undefined ||
                  levels.stop !== undefined || (levels.targets && levels.targets.length > 0)
                );
                
                post({ debug: 'hasDetailedLevels', value: hasDetailedLevels });
                
                if (hasDetailedLevels) {
                  // Use detailed level information with specific labels
                  if (levels.entry !== undefined && levels.entry !== null) {
                    addPriceLine(levels.entry, '#10B981', 'Entry', false, false);
                  }
                  if (levels.lateEntry !== undefined && levels.lateEntry !== null) {
                    addPriceLine(levels.lateEntry, '#059669', 'Late Entry', false, false);
                  }
                  if (levels.exit !== undefined && levels.exit !== null) {
                    addPriceLine(levels.exit, '#EF4444', 'Exit', false, false);
                  }
                  if (levels.lateExit !== undefined && levels.lateExit !== null) {
                    addPriceLine(levels.lateExit, '#DC2626', 'Extended Stop', false, false);
                  }
                  if (levels.stop !== undefined && levels.stop !== null) {
                    addPriceLine(levels.stop, '#EF4444', 'Stop', false, false);
                  }
                  if (levels.targets && Array.isArray(levels.targets)) {
                    levels.targets.forEach(function(target, i) {
                      if (target !== undefined && target !== null) {
                        addPriceLine(target, '#3B82F6', 'Target ' + (i + 1), false, false);
                      }
                    });
                  }
                } else {
                  // Fallback to legacy array-based levels
                  var entries = Array.isArray(levels && levels.entries) ? levels.entries : [];
                  var exits = Array.isArray(levels && levels.exits) ? levels.exits : [];
                  var tps = Array.isArray(levels && levels.takeProfits) ? levels.takeProfits : [];
                  
                  // Fallback to dummy placeholder levels around mock data anchor when nothing provided
                  if (!entries.length && !exits.length && !tps.length) {
                    var anchor = 11349.50;
                    entries = [anchor];
                    exits = [anchor - 10];
                    tps = [anchor + 10, anchor + 20];
                  }
                  
                  entries.forEach(function(p, i){ 
                    var label = entries.length === 1 ? 'Entry' : 'Entry ' + (i + 1);
                    addPriceLine(p, '#10B981', label, false, false); 
                  });
                  exits.forEach(function(p, i){ 
                    var label = exits.length === 1 ? 'Exit' : 'Exit ' + (i + 1);
                    addPriceLine(p, '#EF4444', label, false, false); 
                  });
                  tps.forEach(function(p, i){ addPriceLine(p, '#3B82F6', 'TP' + (i+1), false, false); });
                }
              } catch(e){ post({ warn: 'applyLevels failed', message: String(e && e.message || e) }); }
            }

            function clearAlerts(){
              try {
                var ids = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.alertOverlayIds) || [];
                if (ids && ids.length && chart && typeof chart.removeOverlay === 'function') {
                  ids.forEach(function(id){ try { chart.removeOverlay(id); } catch(_){} });
                }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.alertOverlayIds = [];
              } catch(_){}
            }

            function applyAlerts(alerts){
              try {
                clearAlerts();
                if (!alerts || !Array.isArray(alerts) || !chart) return;
                // Keep last set of alerts so selection changes can re-render overlays
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.lastAlerts = alerts.slice();
                // Build a registry so we can detect taps near alert lines later
                var registry = [];
                var selectedId = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.selectedAlertId) || null;
                alerts.forEach(function(alert, i) {
                  if (alert && typeof alert.price === 'number' && alert.isActive) {
                    var color = '#F59E0B';
                    var label = 'Alert ' + (i + 1);
                    var aid = String(alert.id || ('alert_' + (i + 1)));
                    var isSel = selectedId != null && String(selectedId) === aid;
                    addPriceLine(alert.price, color, label, !!isSel, true);
                    registry.push({ id: String(alert.id || ('alert_' + (i + 1))), price: Number(alert.price) });
                  }
                });
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.alertsRegistry = registry;
              } catch(e){ post({ warn: 'applyAlerts failed', message: String(e && e.message || e) }); }
            }

            // Expose applyAlerts so RN can push new alerts in without full reload
            if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
            window.__SIMPLE_KLINE__.applyAlerts = applyAlerts;
            // Preload Material Icons font so canvas text uses the correct glyphs
            try { if (document.fonts && document.fonts.load) { document.fonts.load('16px \"Material Icons\"'); } } catch(_){ }

            // Session background helpers
            function clearSessionBackgrounds(){
              try {
                var ids = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.sessionOverlayIds) || [];
                if (ids && ids.length && chart && typeof chart.removeOverlay === 'function') {
                  ids.forEach(function(id){ try { chart.removeOverlay(id); } catch(_){} });
                }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.sessionOverlayIds = [];
              } catch(_){}
            }
            function applySessionBackgrounds(){
              try {
                clearSessionBackgrounds();
                if (!SHOW_SESSIONS) return;
                var data = chart && typeof chart.getDataList === 'function' ? chart.getDataList() : [];
                if (!data || !data.length) return;
                var first = data[0];
                var last = data[data.length-1];
                var startTs = Number(first.timestamp || first.time || 0);
                var endTs = Number(last.timestamp || last.time || 0);
                if (!startTs || !endTs) return;
                var dayMs = 24*60*60*1000;
                var baseDate = new Date(startTs);
                baseDate.setHours(0,0,0,0);
                var ids = [];
                for (var day = baseDate.getTime(); day <= endTs; day += dayMs) {
                  var preStart = day + 4*60*60*1000;
                  var regStart = day + 9*60*60*1000 + 30*60*1000;
                  var regEnd = day + 16*60*60*1000;
                  var afterEnd = day + 20*60*60*1000;
                  var nextDay = day + dayMs;
                  var sessions = [
                    { start: day, end: preStart, color: 'rgba(100,100,100,0.1)' },
                    { start: preStart, end: regStart, color: 'rgba(151, 151, 151, 0.1)' },
                    { start: regStart, end: regEnd, color: 'rgba(0, 0, 0, 0.1)' },
                    { start: regEnd, end: afterEnd, color: 'rgba(45, 45, 45, 0.18)' },
                    { start: afterEnd, end: nextDay, color: 'rgba(151, 151, 151, 0.1)' }
                  ];
                  sessions.forEach(function(s){
                    if (s.end <= startTs || s.start >= endTs) return;
                    try {
                      var id = chart.createOverlay({
                        name: 'sessionBg',
                        lock: true,
                        // Mark as a non-interactive decoration so it does not
                        // capture touch events and block chart panning
                        mode: 'decoration',
                        points: [
                          { timestamp: s.start, value: 0 },
                          { timestamp: s.end, value: 0 }
                        ],
                        extendData: { color: s.color }
                      });
                      ids.push(id);
                    } catch(_){}
                  });
                }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.sessionOverlayIds = ids;
              } catch(e){ post({ warn: 'applySessionBackgrounds failed', message: String(e && e.message || e) }); }
            }

            // Indicator creation helpers
            function clearAllIndicators(){
              try {
                post({ debug: 'Clearing all indicators' });
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                var ids = window.__SIMPLE_KLINE__.indicatorIds || [];
                if (ids && ids.length && typeof chart.removeIndicator === 'function') {
                  ids.forEach(function(id){
                    try { 
                      chart.removeIndicator(id); 
                      post({ debug: 'Removed indicator by ID', id: id });
                    } catch(_) {}
                  });
                }
                window.__SIMPLE_KLINE__.indicatorIds = [];
                
                // More aggressive fallback: try multiple removal methods
                var commonNames = ['MA', 'EMA', 'SMA', 'BOLL', 'BBI', 'SAR', 'VOL', 'MACD', 'KDJ', 'RSI', 'BIAS', 'BRAR', 'CCI', 'CR', 'DMA', 'DMI', 'KD', 'PSY', 'TRIX', 'VR', 'WR', 'MTM', 'EMV', 'TEMA', 'TRIPLE_EMA', 'VWAP', 'ROC', 'PVT', 'AO'];
                commonNames.forEach(function(name) {
                  try { 
                    chart.removeIndicator(name); 
                    post({ debug: 'Removed indicator by name', name: name });
                  } catch(_) {}
                });
                
                // Try getIndicators and remove everything
                try {
                  if (typeof chart.getIndicators === 'function') {
                    var remaining = chart.getIndicators() || [];
                    post({ debug: 'Found remaining indicators', count: remaining.length });
                    remaining.forEach(function(ind){
                      try {
                        if (ind && ind.id) {
                          chart.removeIndicator(ind.id);
                          post({ debug: 'Removed remaining indicator by ID', id: ind.id });
                        } else if (ind && ind.name) {
                          chart.removeIndicator(ind.name);
                          post({ debug: 'Removed remaining indicator by name', name: ind.name });
                        }
                      } catch(_) {}
                    });
                  }
                } catch(_) {}
                
                post({ debug: 'Indicator clearing completed' });
              } catch(e) {
                post({ warn: 'clearAllIndicators failed', message: String(e && e.message || e) });
              }
            }

            function createIndicatorSafe(cfg){
              try {
                if (!cfg || !cfg.name) return;
                var nm = String(cfg.name).toUpperCase();
                post({ debug: 'Attempting to create indicator', name: nm, config: cfg });
                var overlayCompat = ['BBI','BOLL','EMA','MA','SAR','SMA'];
                var wantsOverlay = !!cfg.overlay || overlayCompat.indexOf(nm) >= 0;
                var options = {};
                if (wantsOverlay) { options.id = 'candle_pane'; }
                
                // Process styles to handle line styles properly
                if (cfg.styles && cfg.styles.lines) {
                  var processedStyles = { lines: [] };
                  cfg.styles.lines.forEach(function(line, index) {
                    var lineStyle = {
                      color: line.color || '#3B82F6',
                      size: line.size || 1,
                      style: line.style || 'solid'
                    };
                    
                    // Convert style to chart library format
                    if (line.style === 'dashed') {
                      lineStyle.style = 'dashed';
                      lineStyle.dashedValue = [5, 3]; // dash pattern
                    } else if (line.style === 'dotted') {
                      lineStyle.style = 'dashed';
                      lineStyle.dashedValue = [1, 2]; // dot pattern
                    } else {
                      lineStyle.style = 'solid';
                    }
                    
                    processedStyles.lines.push(lineStyle);
                  });
                  options.styles = processedStyles;
                } else if (cfg.styles) {
                  options.styles = cfg.styles;
                }
                
                if (cfg.calcParams) { options.calcParams = cfg.calcParams; }

                var created = null;
                try {
                  if (typeof chart.createIndicator === 'function') {
                    // Try signature: (name, isStack, options)
                    created = chart.createIndicator(nm, false, options);
                  }
                } catch(e1) {
                  try {
                    // Try alternate signature: ({ name, id, styles, calcParams })
                    created = chart.createIndicator(Object.assign({ name: nm }, options));
                  } catch(e2) {
                    post({ warn: 'createIndicator failed', name: nm, message: String((e2 && e2.message) || e2) });
                  }
                }
                try {
                  if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                  window.__SIMPLE_KLINE__.indicatorIds = window.__SIMPLE_KLINE__.indicatorIds || [];
                  if (created) { 
                    window.__SIMPLE_KLINE__.indicatorIds.push(created);
                    post({ debug: 'Successfully created indicator', name: nm, id: created });
                  } else {
                    post({ warn: 'Failed to create indicator', name: nm });
                  }
                } catch(_) {}
                return created;
              } catch(err) {
                post({ warn: 'createIndicatorSafe exception', message: String(err && err.message || err) });
              }
            }

            try {
              // Clear all existing indicators first
              clearAllIndicators();
              
              // Then create the new set of indicators
              if (Array.isArray(INDICATORS)) {
                INDICATORS.forEach(function(ic){ createIndicatorSafe(ic); });
              }
            } catch(_) {}

            // Indicator override function
            function overrideIndicator(id, styles, calcParams) {
              try {
                // Check if parameters are swapped (common issue)
                if (typeof id === 'object' && id.styles && typeof styles === 'string') {
                  post({ debug: 'Parameters appear to be swapped, correcting...' });
                  // Extract the actual indicator name and styles from the nested object
                  var actualId = id.name || styles; // Use the name from the object, or fallback to the string
                  var actualStyles = id.styles || id; // Use the styles from the object, or use the whole object
                  var actualCalcParams = id.calcParams || calcParams; // Extract calcParams from object or use parameter
                  id = actualId;
                  styles = actualStyles;
                  calcParams = actualCalcParams;
                  post({ debug: 'Corrected parameters', id: id, styles: styles, calcParams: calcParams });
                }
                
                if (!chart) {
                  post({ error: 'Chart instance not available' });
                  return false;
                }
                
                // Handle different ID formats and extract the indicator name
                var indicatorName = typeof id === 'string' ? id : (id && id.name) || '';
                
                // Get all indicators to find the target
                var allIndicators = [];
                try {
                  if (typeof chart.getIndicators === 'function') {
                    allIndicators = chart.getIndicators() || [];
                  }
                } catch(e) {
                  post({ debug: 'Error getting indicators list', error: String(e) });
                }
                
                var foundIndicator = allIndicators.find(function(ind) {
                  return ind && ind.name === indicatorName;
                });
                
                if (!foundIndicator) {
                  post({ error: 'Indicator not found', name: indicatorName });
                  return false;
                }
                
                // Prepare the override object with both styles and calcParams
                var overrideObject = {
                  id: foundIndicator.id,
                  styles: styles || {}
                };
                
                // Add calcParams if provided
                if (calcParams && Array.isArray(calcParams) && calcParams.length > 0) {
                  overrideObject.calcParams = calcParams;
                  post({ debug: 'Adding calcParams to override', calcParams: calcParams });
                }
                
                // Process styles to handle line styles properly
                if (styles && styles.lines && Array.isArray(styles.lines)) {
                  var processedStyles = { lines: [] };
                  styles.lines.forEach(function(line, index) {
                    var lineStyle = {
                      color: line.color || '#3B82F6',
                      size: line.size || 1,
                      style: line.style || 'solid'
                    };
                    
                    // Convert style to chart library format
                    if (line.style === 'dashed') {
                      lineStyle.style = 'dashed';
                      lineStyle.dashedValue = line.dashedValue || [5, 3];
                    } else if (line.style === 'dotted') {
                      lineStyle.style = 'dashed';
                      lineStyle.dashedValue = [1, 2];
                    } else if (line.style === 'solid') {
                      lineStyle.style = 'solid';
                      delete lineStyle.dashedValue;
                    }
                    
                    processedStyles.lines.push(lineStyle);
                  });
                  overrideObject.styles = processedStyles;
                  post({ debug: 'Processed line styles', processedStyles: processedStyles });
                }
                
                // Call overrideIndicator with the complete object
                if (typeof chart.overrideIndicator === 'function') {
                  post({ debug: 'Calling overrideIndicator', overrideObject: overrideObject });
                  chart.overrideIndicator(overrideObject, 'candle_pane', function() {
                    post({ debug: 'Override callback executed successfully' });
                  });
                } else {
                  post({ error: 'overrideIndicator method not available on chart instance' });
                  return false;
                }
                
                return true;
              } catch(e) {
                post({ error: 'overrideIndicator failed', message: String(e && e.message || e), stack: e.stack });
                return false;
              }
            }

            window.__SIMPLE_KLINE__ = {
              setChartType: function(t){ try { applyChartType(chart, t); } catch(e) {} },
              setLevels: function(lvls){ try { applyLevels(lvls); } catch(_){} },
              setIndicators: function(list){
                try {
                  clearAllIndicators();
                  if (Array.isArray(list)) {
                    list.forEach(function(ic){ createIndicatorSafe(ic); });
                  }
                } catch(e) { post({ warn: 'setIndicators failed', message: String(e && e.message || e) }); }
              },
              overrideIndicator: overrideIndicator,
              levelOverlayIds: [],
              sessionOverlayIds: []
            };

            // Crosshair events: capture price on move and handle feature clicks (alert button)
            (function(){
              try {
                var ActionType = (window.klinecharts && (window.klinecharts.ActionType || window.klinecharts.ProActionType)) || {};
                

                function subscribeActionSafe(name, cb){
                  try {
                    if (typeof chart.subscribeAction === 'function') {
                      chart.subscribeAction(name, cb);
                      post({ debug: 'Subscribed action', name: name });
                      return true;
                    }
                  } catch(e) { post({ warn: 'subscribeAction failed', name: name, message: String(e && e.message || e) }); }
                  return false;
                }

                var CHANGE_EVT = ActionType.OnCrosshairChange || 'onCrosshairChange';
                subscribeActionSafe(CHANGE_EVT, function(param){
                  try {
                    if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                    window.__SIMPLE_KLINE__.lastCrosshair = param;
                    var ptr = window.__SIMPLE_KLINE__.lastPointerPrice;
                    if (typeof ptr === 'number') {
                      window.__SIMPLE_KLINE__.lastCrosshairPrice = ptr;
                    }
                  } catch(_) {}
                });

                var CLICK_EVT = ActionType.OnCrosshairFeatureClick || 'onCrosshairFeatureClick';
                subscribeActionSafe(CLICK_EVT, function(param){
                  try {
                    var fid = (param && (param.featureId || (param.feature && param.feature.id) || param.id)) || '';
                    var price = null;
                    if (window.__SIMPLE_KLINE__) {
                      price = (window.__SIMPLE_KLINE__.lastPointerPrice != null)
                        ? window.__SIMPLE_KLINE__.lastPointerPrice
                        : window.__SIMPLE_KLINE__.lastCrosshairPrice || null;
                    }
                    post({ debug: 'onCrosshairFeatureClick', featureId: fid, price: price });
                    if (fid === 'alert_tool' && typeof price === 'number') {
                      addPriceLine(price, '#F59E0B', 'Alert', false, true);
                      // Call the onAlertClick callback if provided
                      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'alertClick',
                          price: price
                        }));
                      }
                    }
                  } catch(e) { post({ warn: 'onCrosshairFeatureClick handler failed', message: String(e && e.message || e) }); }
                });

                // Track last pointer position over the chart and derive price via convertFromPixel
                try {
                  var container = document.getElementById('k-line-chart');
                  if (container) {
                    var updatePointer = function(e){
                      try {
                        if (!container) return;
                        var rect = container.getBoundingClientRect();
                        var x = (e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX)) - rect.left;
                        var y = (e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY)) - rect.top;
                        if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                        window.__SIMPLE_KLINE__.lastPointer = { x: x, y: y };
                        if (chart && typeof chart.convertFromPixel === 'function') {
                          var converted = chart.convertFromPixel({ x: x, y: y });
                          var val = (converted && (typeof converted.value === 'number' ? converted.value : converted.price));
                          if (typeof val === 'number') {
                            window.__SIMPLE_KLINE__.lastPointerPrice = val;
                            try { post({ type: 'crosshairMove', y: y, price: Number(val) }); } catch(_) {}
                          }
                        }
                      } catch(_) { }
                    };
                    container.addEventListener('pointermove', updatePointer, { passive: true });
                    container.addEventListener('pointerdown', updatePointer, { passive: true });
                    container.addEventListener('touchstart', updatePointer, { passive: true });
                    container.addEventListener('touchmove', updatePointer, { passive: true });

                    var hideOverlay = function(){ try { post({ type: 'crosshairHide' }); } catch(_) {} };
                    container.addEventListener('pointerleave', hideOverlay, { passive: true });
                    container.addEventListener('pointercancel', hideOverlay, { passive: true });

                    // Helper to get pixel Y for a price
                    if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                    window.__SIMPLE_KLINE__.getYForPrice = function(price){
                      try {
                        if (chart && typeof chart.convertToPixel === 'function') {
                          var px = chart.convertToPixel({ value: Number(price) });
                          if (px && typeof px.y === 'number') return px.y;
                        }
                      } catch(_) {}
                      return null;
                    };

                    // Drag state
                    window.__SIMPLE_KLINE__.draggingAlert = null;
                    window.__SIMPLE_KLINE__.dragPreviewId = null;

                    // Start drag or select near alert line
                    var handlePointerDown = function(e){
                      try {
                        var rect = container.getBoundingClientRect();
                        var x = (e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX)) - rect.left;
                        var y = (e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY)) - rect.top;
                        var reg = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.alertsRegistry) || [];
                        // Check for alert line hits
                        if (!reg || !reg.length) return;
                        var best = null;
                        for (var i = 0; i < reg.length; i++) {
                          var r = reg[i];
                          var ay = window.__SIMPLE_KLINE__.getYForPrice ? window.__SIMPLE_KLINE__.getYForPrice(r.price) : null;
                          if (ay == null) continue;
                          var dy = Math.abs(y - ay);
                          if (best == null || dy < best.dy) best = { id: r.id, price: r.price, y: ay, dy: dy };
                        }
                        if (best && best.dy <= 12) {
                          // Mark selection
                          if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                          window.__SIMPLE_KLINE__.selectedAlertId = best.id;
                          try { applyAlerts(window.__SIMPLE_KLINE__.lastAlerts || []); } catch(_){}
                          post({ type: 'alertSelected', id: best.id, price: best.price, y: best.y });
                          // Begin drag
                          window.__SIMPLE_KLINE__.draggingAlert = { id: best.id, startY: y, price: best.price };
                          window.__SIMPLE_KLINE__.draggingCurrentPrice = best.price;
                        } else {
                          // Tap outside: clear selection and hide label
                          if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                          window.__SIMPLE_KLINE__.selectedAlertId = null;
                          try { applyAlerts(window.__SIMPLE_KLINE__.lastAlerts || []); } catch(_){}
                        }
                      } catch(_) {}
                    };
                    container.addEventListener('pointerdown', handlePointerDown, { passive: true });
                    container.addEventListener('touchstart', handlePointerDown, { passive: true });

                    // Move drag
                    var handlePointerMove = function(e){
                      try {
                        var drag = window.__SIMPLE_KLINE__.draggingAlert;
                        if (!drag) return;
                        var rect = container.getBoundingClientRect();
                        var y = (e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY)) - rect.top;
                        if (chart && typeof chart.convertFromPixel === 'function') {
                          var converted = chart.convertFromPixel({ x: 0, y: y });
                          var val = (converted && (typeof converted.value === 'number' ? converted.value : converted.price));
                          if (typeof val === 'number' && isFinite(val)) {
                            window.__SIMPLE_KLINE__.draggingCurrentPrice = val;
                            // Update preview overlay
                            var prevId = window.__SIMPLE_KLINE__.dragPreviewId;
                            try { if (prevId && typeof chart.removeOverlay === 'function') chart.removeOverlay(prevId); } catch(_){ }
                            try {
                              var pid = chart.createOverlay({
                                name: 'horizontalStraightLine',
                                lock: true,
                                points: [{ value: Number(val) }],
                                styles: { line: { color: '#F59E0B', size: 1, style: 'dashed', dashedValue: [6, 4] } }
                              });
                              window.__SIMPLE_KLINE__.dragPreviewId = pid;
                            } catch(_){ }
                          }
                        }
                      } catch(_) {}
                    };
                    container.addEventListener('pointermove', handlePointerMove, { passive: true });
                    container.addEventListener('touchmove', handlePointerMove, { passive: true });

                    // End drag and emit
                    var handlePointerUp = function(e){
                      try {
                        var drag = window.__SIMPLE_KLINE__.draggingAlert;
                        if (!drag) return;
                        // Clean preview
                        try { if (window.__SIMPLE_KLINE__.dragPreviewId && typeof chart.removeOverlay === 'function') chart.removeOverlay(window.__SIMPLE_KLINE__.dragPreviewId); } catch(_){ }
                        var finalPrice = window.__SIMPLE_KLINE__.draggingCurrentPrice;
                        window.__SIMPLE_KLINE__.draggingAlert = null;
                        window.__SIMPLE_KLINE__.dragPreviewId = null;
                        if (typeof finalPrice === 'number') {
                          post({ type: 'alertDragEnd', id: drag.id, price: Number(finalPrice) });
                        }
                      } catch(_) {}
                    };
                    container.addEventListener('pointerup', function(e){ try { handlePointerUp(e); } catch(_) {} try { hideOverlay(); } catch(_) {} }, { passive: true });
                    container.addEventListener('touchend', function(e){ try { handlePointerUp(e); } catch(_) {} try { hideOverlay(); } catch(_) {} }, { passive: true });
                  }
                } catch(_) {}
              } catch(e) { post({ warn: 'crosshair_events_setup_failed', message: String(e && e.message || e) }); }
            })();

            post({ ready: true, symbol: SYMBOL });

              // Apply initial levels if provided
              try { applyLevels(LEVELS); } catch(_){}
              // Initial alerts will be applied via postMessage after ready
              try { applySessionBackgrounds(); } catch(_){}
              return true;
          } catch (err) { post({ error: String(err && err.message || err) }); return false; }
        }

        function init(){ if (!create()) { var tries = 0; var t = setInterval(function(){ tries++; if (create() || tries > 100) clearInterval(t); }, 100); } }
        if (document.readyState === 'complete' || document.readyState === 'interactive') { init(); } else { document.addEventListener('DOMContentLoaded', init); }
      })();
    </script>
  </body>
</html>`;
  }, [
    symbol,
    timeframe,
    height,
    theme,
    chartType,
    showPriceAxisText,
    showTimeAxisText,
    levels,
    // alerts removed from deps to prevent WebView reload
    customBars,
    customData,
    indicatorsKey,
    showSessions,
  ]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webRef}
        key={`${symbol}-${timeframe}-${chartType}-${dataKey}-${indicatorsKey}-${showSessions}`}
        originWhitelist={["*"]}
        source={{ html }}
        style={{ height, width: "100%" }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data || "{}");
            if (data && data.ready) {
              isReadyRef.current = true;
              // Push initial alerts after ready
              try {
                if (webRef.current) {
                  const msg = JSON.stringify({ type: "setAlerts", alerts });
                  webRef.current.postMessage(msg);
                }
              } catch (_) {}
            }
            if (data.type === "crosshairMove") {
              if (typeof data.y === "number") setCrosshairY(Number(data.y));
              if (typeof data.price === "number")
                setCrosshairPrice(Number(data.price));
            } else if (data.type === "crosshairHide") {
              setCrosshairY(null);
              setCrosshairPrice(null);
            }
            if (data.type === "alertClick" && data.price && onAlertClick) {
              onAlertClick(data.price);
            } else if (data.type === "alertSelected" && onAlertSelected) {
              if (
                data &&
                typeof data.id === "string" &&
                typeof data.price === "number"
              ) {
                onAlertSelected({
                  id: data.id,
                  price: data.price,
                  y: Number(data.y || 0),
                });
              }
            } else if (data.type === "alertDragEnd" && onAlertMoved) {
              if (
                data &&
                typeof data.id === "string" &&
                typeof data.price === "number"
              ) {
                onAlertMoved({ id: data.id, price: data.price });
              }
            } else if (data.error) {
              console.warn("[SimpleKLineChart:error]", data);
            } else if (data.warn) {
              console.warn("[SimpleKLineChart:warn]", data);
            } else if (data.debug) {
              console.log("[SimpleKLineChart:debug]", data);
            } else {
              console.log("[SimpleKLineChart:msg]", data);
            }
          } catch (e) {
            console.log("[SimpleKLineChart:raw]", event.nativeEvent.data);
          }
        }}
      />
      {crosshairY != null && (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View
            style={{
              position: "absolute",
              top: Math.max(8, Math.min(height - 44, crosshairY - 16)),
              right: 8,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "transparent",
              gap: 6,
            }}
            pointerEvents="box-none"
          >
            <Pressable
              style={{
                padding: 6,
                borderRadius: 16,
                backgroundColor: theme === "dark" ? "#2B313B" : "#E6E9EE",
                marginLeft: 4,
              }}
              onPress={() => {
                // TODO: hook to your first action
              }}
            >
              <Ionicons name="options-outline" size={16} color="#76808F" />
            </Pressable>
            <Pressable
              style={{
                padding: 6,
                borderRadius: 16,
                backgroundColor: theme === "dark" ? "#2B313B" : "#E6E9EE",
                marginLeft: 4,
              }}
              onPress={() => {
                if (crosshairPrice != null && onAlertClick)
                  onAlertClick(crosshairPrice);
              }}
            >
              <Ionicons
                name="notifications-outline"
                size={16}
                color="#76808F"
              />
            </Pressable>
            <Pressable
              style={{
                padding: 6,
                borderRadius: 16,
                backgroundColor: theme === "dark" ? "#2B313B" : "#E6E9EE",
                marginLeft: 4,
              }}
              onPress={() => {
                // TODO: hook to your third action
              }}
            >
              <Ionicons name="stats-chart-outline" size={16} color="#76808F" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    width: "100%",
  },
});
