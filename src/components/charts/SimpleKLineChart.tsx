import React, { useMemo, useRef, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";

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
  showSessions?: boolean;
  levels?: {
    entries?: number[];
    exits?: number[];
    takeProfits?: number[];
    entry?: number;
    lateEntry?: number;
    exit?: number;
    lateExit?: number;
    stop?: number;
    targets?: number[];
  };
  customBars?: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    turnover?: number;
  }>;
  customData?: Array<{ time: number; value: number }>;
  indicators?: IndicatorConfig[];
  onOverrideIndicator?: (
    overrideFn: (
      id: string | { name: string; paneId?: string },
      styles: any,
      calcParams?: any
    ) => void
  ) => void;
  onAlertClick?: (price: number) => void;
  alerts?: Array<{
    id?: string;
    price: number;
    condition: string;
    isActive: boolean;
  }>;
  onAlertSelected?: (payload: { id: string; price: number; y: number }) => void;
  onAlertMoved?: (payload: { id: string; price: number }) => void;
  onMeasureClick?: (price: number) => void;
  onCrosshairClick?: (price: number) => void;
}

export interface IndicatorConfig {
  id?: string;
  name: string;
  overlay?: boolean;
  calcParams?: any;
  styles?: any;
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
  onMeasureClick,
  onCrosshairClick,
}: Props) {
  const webRef = useRef<WebView>(null);
  const isReadyRef = useRef<boolean>(false);

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
        webRef.current.postMessage(message);
      } else {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.log(
            "[SimpleKLineChart] WebView not ready for overrideIndicator",
            { isReady: isReadyRef.current, hasRef: !!webRef.current }
          );
        }
      }
    },
    []
  );

  useEffect(() => {
    if (onOverrideIndicator) onOverrideIndicator(overrideIndicator);
  }, [onOverrideIndicator, overrideIndicator]);

  // Simple alerts key for WebView reload when alerts change
  const alertsKey = useMemo(() => {
    return alerts.map((a) => `${a.id}-${a.price}-${a.isActive}`).join(",");
  }, [alerts]);

  const polygonApiKey: string | undefined = (Constants.expoConfig?.extra as any)
    ?.polygonApiKey;

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
      #k-line-wrap { width: 100%; height: ${height}px; position: relative; }
      #k-line-chart { width: 100%; height: 100%; }
      * { touch-action: none; }

      .custom-crosshair-buttons {
        position: absolute;
        display: none;
        flex-direction: row;
        gap: 8px;
        right: 140px;
        z-index: 1000;
        pointer-events: auto;
      }

      .custom-button {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Material Icons';
        font-size: 18px;
        transition: all 0.2s ease;
        background: ${JSON.stringify(theme === "dark" ? "#2B313B" : "#E6E9EE")};
        color: #76808F;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
      }

      .custom-button:hover {
        background: ${JSON.stringify(theme === "dark" ? "#3A4451" : "#D8DEE6")};
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }

      .custom-button:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
    </style>
  </head>
  <body>
    <div id="k-line-wrap">
      <div id="k-line-chart"></div>
      <div class="custom-crosshair-buttons" id="crosshair-buttons">
        <button class="custom-button" id="btn-alert" title="Add Alert">notifications</button>
        <button class="custom-button" id="btn-measure" title="Measure">straighten</button>
        <button class="custom-button" id="btn-crosshair" title="Crosshair">add</button>
      </div>
    </div>
    <script src="https://unpkg.com/klinecharts@10.0.0-alpha9/dist/umd/klinecharts.min.js"></script>
    <script>
      (function(){
        function post(msg){ try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {} }
        window.onerror = function(m, s, l, c, e){ post({ error: m || (e && e.message) || 'unknown' }); };

        // Simple message bridge for overrideIndicator only
        function handleRNMessage(event){
          try {
            var payload = (event && event.data != null) ? event.data : event;
            var data = {};
            try { data = JSON.parse(payload || '{}'); } catch(_) { data = {}; }
            if (data.type === 'overrideIndicator') {
              if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.overrideIndicator) {
                window.__SIMPLE_KLINE__.overrideIndicator(data.id, data.styles, data.calcParams);
              } else {
                post({ error: 'overrideIndicator function not available in __SIMPLE_KLINE__' });
              }
            }
          } catch(e) {
            post({ error: 'message_handler_failed', message: String(e && e.message || e) });
          }
        }
        document.addEventListener('message', handleRNMessage);
        try { window.addEventListener('message', handleRNMessage); } catch(_){ }

        var SYMBOL = ${JSON.stringify(safeSymbol)};
        var CHART_TYPE = ${JSON.stringify(ct)};
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
        var ALERTS = ${JSON.stringify(alerts || [])};

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
                show: false,
                horizontal: {
                  show: false,
                  line: { style: 'dashed', dashedValue: [4, 2], size: 1, color: '#888888' },
                  text: {
                    show: true,
                    style: 'fill',
                    color: '#FFFFFF',
                    size: 12,
                    family: 'Helvetica Neue',
                    weight: 'normal',
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
                vertical: { show: false, text: { show: true } }
              },
              grid: {
                horizontal: {
                  show: ${JSON.stringify(showGrid)},
                  display: ${JSON.stringify(showGrid)},
                  size: 1,
                  color: ${JSON.stringify(
                    theme === "dark" ? "rgba(255,255,255,0.06)" : "#EDEDED"
                  )},
                  style: 'dashed',
                  dashedValue: [2, 2]
                },
                vertical: {
                  show: ${JSON.stringify(showGrid)},
                  display: ${JSON.stringify(showGrid)},
                  size: 1,
                  color: ${JSON.stringify(
                    theme === "dark" ? "rgba(255,255,255,0.06)" : "#EDEDED"
                  )},
                  style: 'dashed',
                  dashedValue: [2, 2]
                }
              },
              separator: { size: 1, color: ${JSON.stringify(
                theme === "dark" ? "#0a0a0a" : "#ffffff"
              )} }
            };
            if (!SHOW_TOP_INFO) { opts.candle.tooltip = { showRule: 'none' }; }
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

            // Overlays
            if (window.klinecharts.registerOverlay && !window.__LABELED_LINE_REGISTERED__) {
              window.klinecharts.registerOverlay({
                name: 'labeledHorizontalLine',
                totalStep: 1,
                createPointFigures: function({ coordinates, overlay }) {
                  var point = coordinates[0];
                  if (!point) return [];
                  var extendData = overlay.extendData || {};
                  var label = extendData.label || '';
                  var price = extendData.price || 0;
                  var color = extendData.color || '#10B981';
                  var isSelected = !!extendData.dragHintArrows;
                  var figs = [
                    { type: 'line', attrs: { coordinates: [ { x: 0, y: point.y }, { x: 9999, y: point.y } ] }, styles: { color: color, size: 1, style: 'dashed', dashedValue: [10, 6] } }
                  ];
                  if (isSelected) {
                    figs.push({ type: 'text', attrs: { x: 12, y: point.y - 5, text: label + ' $' + Number(price).toFixed(2), baseline: 'bottom', align: 'left' }, styles: { color: '#FFFFFF', size: 11, backgroundColor: color, borderColor: color, borderSize: 1, borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 } });
                    figs.push(
                      { type: 'text', attrs: { x: 6, y: point.y - 8, text: '\u25B2', baseline: 'bottom', align: 'left' }, styles: { color: '#C7CDD7', size: 8, backgroundColor: 'transparent' } },
                      { type: 'text', attrs: { x: 6, y: point.y + 8, text: '\u25BC', baseline: 'top', align: 'left' }, styles: { color: '#C7CDD7', size: 8, backgroundColor: 'transparent' } }
                    );
                  } else {
                    figs.push({ type: 'text', attrs: { x: 8, y: point.y - 6, text: '\uE7F4', baseline: 'bottom', align: 'left' }, styles: { color: color, family: 'Material Icons', size: 16, backgroundColor: 'transparent' } });
                  }
                  return figs;
                }
              });
              window.__LABELED_LINE_REGISTERED__ = true;
            }

            if (window.klinecharts.registerOverlay && !window.__SESSION_BG_REGISTERED__) {
              window.klinecharts.registerOverlay({
                name: 'sessionBg',
                totalStep: 0,
                needDefaultMouseEvent: false,
                needCrosshair: false,
                createPointFigures: function({ coordinates, overlay }) {
                  var start = coordinates[0];
                  var end = coordinates[1];
                  if (!start || !end) return [];
                  var color = (overlay.extendData && overlay.extendData.color) || 'rgba(0,0,0,0.1)';
                  return [ { type: 'rect', attrs: { x: start.x, y: 0, width: end.x - start.x, height: 9999 }, styles: { color: color, style: 'fill' }, ignoreEvent: true } ];
                }
              });
              window.__SESSION_BG_REGISTERED__ = true;
            }

            var chart = window.klinecharts.init('k-line-chart');
            if (SHOW_MA) { try { chart.createIndicator && chart.createIndicator('MA', false, { id: 'candle_pane' }); } catch(_){} }
            if (SHOW_VOL) { try { chart.createIndicator && chart.createIndicator('VOL'); } catch(_){} }
            applyChartType(chart, CHART_TYPE);

            if (typeof chart.setSymbol === 'function') { try { chart.setSymbol({ ticker: SYMBOL }); } catch(_){} }
            if (typeof chart.setPeriod === 'function') { try { chart.setPeriod(mapPeriod(TF)); } catch(_){} }

            var hasCustom = (Array.isArray(CUSTOM_BARS) && CUSTOM_BARS.length > 0) || (Array.isArray(CUSTOM_DATA) && CUSTOM_DATA.length > 0);
            if (hasCustom) {
              try {
                var bars = (Array.isArray(CUSTOM_BARS) && CUSTOM_BARS.length > 0) ? CUSTOM_BARS : CUSTOM_DATA;
                try { bars = bars.slice().sort(function(a,b){ return (a.timestamp||0) - (b.timestamp||0); }); } catch(_){ }
                var applied = false;
                try { if (chart && typeof chart.setData === 'function') { chart.setData(bars); applied = true; } } catch(_){ }
                if (!applied) { try { if (chart && typeof chart.applyNewData === 'function') { chart.applyNewData(bars); applied = true; } } catch(_){ } }
                if (!applied) {
                  try {
                    if (typeof chart.setDataLoader === 'function') {
                      chart.setDataLoader({ getBars: function(ctx){ try { (ctx && ctx.callback ? ctx.callback : function(){}) (bars); } catch (e4) { post({ error: 'custom_loader_callback_failed', message: String(e4 && e4.message || e4) }); } } });
                      applied = true;
                    }
                  } catch(_){ }
                }
                if (!applied) { post({ error: 'apply_custom_failed', message: 'No supported API to set data' }); }
              } catch(e) { post({ error: 'apply_custom_failed', message: String(e && e.message || e) }); }
              setTimeout(applySessionBackgrounds, 0);
            } else {
              if (typeof chart.setDataLoader === 'function') {
                chart.setDataLoader({
                  getBars: function(ctx){
                    try {
                      var callback = ctx && ctx.callback ? ctx.callback : function(){};
                      var p = mapPeriod(TF);
                      var to = Date.now();
                      var from = to - 500 * periodToMs(p);
                      if (!POLY_API_KEY) { post({ warn: 'Missing Polygon API key' }); callback([]); setTimeout(applySessionBackgrounds, 0); return; }
                      var url = 'https://api.polygon.io/v2/aggs/ticker/' + encodeURIComponent(SYMBOL) + '/range/' + p.span + '/' + p.type + '/' + from + '/' + to + '?adjusted=true&sort=asc&limit=50000&apiKey=' + encodeURIComponent(POLY_API_KEY);
                      fetch(url)
                        .then(function(res){ return res.json(); })
                        .then(function(result){
                          var list = (result && result.results) || [];
                          var out = list.map(function(d){ return { timestamp: d.t, open: d.o, high: d.h, low: d.l, close: d.c, volume: d.v, turnover: d.vw }; });
                          callback(out);
                          setTimeout(applySessionBackgrounds, 0);
                        })
                        .catch(function(err){ post({ error: 'polygon_load_failed', message: String(err && err.message || err) }); callback([]); setTimeout(applySessionBackgrounds, 0); });
                    } catch (e) { post({ error: 'getBars_failed', message: String(e && e.message || e) }); }
                  }
                });
              } else {
                (function(){
                  var p = mapPeriod(TF);
                  var to = Date.now();
                  var from = to - 500 * periodToMs(p);
                  if (!POLY_API_KEY) return;
                  var url = 'https://api.polygon.io/v2/aggs/ticker/' + encodeURIComponent(SYMBOL) + '/range/' + p.span + '/' + p.type + '/' + from + '/' + to + '?adjusted=true&sort=asc&limit=50000&apiKey=' + encodeURIComponent(POLY_API_KEY);
                  fetch(url)
                    .then(function(res){ return res.json(); })
                    .then(function(result){
                      var list = (result && result.results) || [];
                      var out = list.map(function(d){ return { timestamp: d.t, open: d.o, high: d.h, low: d.l, close: d.c, volume: d.v, turnover: d.vw }; });
                      try { chart.applyNewData(out || []); } catch(e) { post({ error: 'applyNewData failed', message: String(e && e.message || e) }); }
                      setTimeout(applySessionBackgrounds, 0);
                    })
                    .catch(function(err){ post({ error: 'polygon_load_failed', message: String(err && err.message || err) }); setTimeout(applySessionBackgrounds, 0); });
                })();
              }
            }

            // Levels
            function clearLevels(){
              try {
                var ids = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.levelOverlayIds) || [];
                if (ids && ids.length && chart && typeof chart.removeOverlay === 'function') { ids.forEach(function(id){ try { chart.removeOverlay(id); } catch(_){} }); }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.levelOverlayIds = [];
              } catch(_){ }
            }

            function addPriceLine(price, color, label, dragHintArrows, isAlert){
              try {
                if (price == null || isNaN(price)) return;
                var overlayId;
                if (isAlert) {
                  var customOpts = { name: 'labeledHorizontalLine', lock: false, points: [{ value: Number(price) }], extendData: { label: String(label), price: Number(price), color: color, dragHintArrows: !!dragHintArrows } };
                  try { if (chart && typeof chart.createOverlay === 'function') { overlayId = chart.createOverlay(customOpts); } } catch(_) { }
                } else {
                  var lineOpts = {
                    name: 'horizontalStraightLine', lock: true, extend: 'none', points: [{ value: Number(price) }],
                    styles: { line: { color: color, size: 1, style: 'dashed', dashedValue: [10, 6] }, text: { show: true, color: '#FFFFFF', size: 12, backgroundColor: color, borderColor: color, paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: 4, text: String(label) + ' $' + Number(price).toFixed(2) } }
                  };
                  if (chart && typeof chart.createOverlay === 'function') { overlayId = chart.createOverlay(lineOpts); }
                }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                var ids = [overlayId].filter(function(id) { return id !== undefined; });
                if (isAlert) { window.__SIMPLE_KLINE__.alertOverlayIds = (window.__SIMPLE_KLINE__.alertOverlayIds || []).concat(ids); }
                else { window.__SIMPLE_KLINE__.levelOverlayIds = (window.__SIMPLE_KLINE__.levelOverlayIds || []).concat(ids); }
              } catch(e){ post({ error: 'addPriceLine failed', message: String(e && e.message || e), stack: e.stack }); }
            }

            function applyLevels(levels){
              try {
                clearLevels();
                var hasDetailedLevels = levels && (
                  levels.entry !== undefined || levels.lateEntry !== undefined ||
                  levels.exit !== undefined || levels.lateExit !== undefined ||
                  levels.stop !== undefined || (levels.targets && levels.targets.length > 0)
                );

                if (hasDetailedLevels) {
                  if (levels.entry != null) addPriceLine(levels.entry, '#10B981', 'Entry', false, false);
                  if (levels.lateEntry != null) addPriceLine(levels.lateEntry, '#059669', 'Late Entry', false, false);
                  if (levels.exit != null) addPriceLine(levels.exit, '#EF4444', 'Exit', false, false);
                  if (levels.lateExit != null) addPriceLine(levels.lateExit, '#DC2626', 'Extended Stop', false, false);
                  if (levels.stop != null) addPriceLine(levels.stop, '#EF4444', 'Stop', false, false);
                  if (levels.targets && Array.isArray(levels.targets)) {
                    levels.targets.forEach(function(target, i) { if (target != null) addPriceLine(target, '#3B82F6', 'Target ' + (i + 1), false, false); });
                  }
                } else {
                  var entries = Array.isArray(levels && levels.entries) ? levels.entries : [];
                  var exits = Array.isArray(levels && levels.exits) ? levels.exits : [];
                  var tps = Array.isArray(levels && levels.takeProfits) ? levels.takeProfits : [];
                  entries.forEach(function(p, i){ addPriceLine(p, '#10B981', entries.length === 1 ? 'Entry' : 'Entry ' + (i + 1), false, false); });
                  exits.forEach(function(p, i){ addPriceLine(p, '#EF4444', exits.length === 1 ? 'Exit' : 'Exit ' + (i + 1), false, false); });
                  tps.forEach(function(p, i){ addPriceLine(p, '#3B82F6', 'TP' + (i+1), false, false); });
                }
              } catch(e){ post({ warn: 'applyLevels failed', message: String(e && e.message || e) }); }
            }

            function clearAlerts(){
              try {
                var ids = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.alertOverlayIds) || [];
                if (ids && ids.length && chart && typeof chart.removeOverlay === 'function') { ids.forEach(function(id){ try { chart.removeOverlay(id); } catch(_){} }); }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.alertOverlayIds = [];
              } catch(_){ }
            }

            function applyAlerts(alerts){
              try {
                clearAlerts();
                if (!alerts || !Array.isArray(alerts) || !chart) return;
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.lastAlerts = alerts.slice();
                var registry = [];
                var selectedId = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.selectedAlertId) || null;
                alerts.forEach(function(alert, i) {
                  if (alert && typeof alert.price === 'number' && alert.isActive) {
                    var color = '#F59E0B';
                    var label = 'Alert ' + (i + 1);
                    var aid = String(alert.id || ('alert_' + (i + 1)));
                    var isSel = selectedId != null && String(selectedId) === aid;
                    addPriceLine(alert.price, color, label, !!isSel, true);
                    registry.push({ id: aid, price: Number(alert.price) });
                  }
                });
                window.__SIMPLE_KLINE__.alertsRegistry = registry;
              } catch(e){ post({ warn: 'applyAlerts failed', message: String(e && e.message || e) }); }
            }

            if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
            window.__SIMPLE_KLINE__.applyAlerts = applyAlerts;
            try { if (document.fonts && document.fonts.load) { document.fonts.load('16px "Material Icons"'); } } catch(_){ }

            // Apply initial alerts snapshot passed from React Native
            try { applyAlerts(Array.isArray(ALERTS) ? ALERTS : []); } catch(_){ }
            try { if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function(){ try { applyAlerts(Array.isArray(ALERTS) ? ALERTS : []); } catch(_){ } }); } } catch(_){ }

            // Sessions
            function clearSessionBackgrounds(){
              try {
                var ids = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.sessionOverlayIds) || [];
                if (ids && ids.length && chart && typeof chart.removeOverlay === 'function') { ids.forEach(function(id){ try { chart.removeOverlay(id); } catch(_){} }); }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.sessionOverlayIds = [];
              } catch(_){ }
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
                        mode: 'decoration',
                        points: [ { timestamp: s.start, value: 0 }, { timestamp: s.end, value: 0 } ],
                        extendData: { color: s.color }
                      });
                      ids.push(id);
                    } catch(_){ }
                  });
                }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.sessionOverlayIds = ids;
              } catch(e){ post({ warn: 'applySessionBackgrounds failed', message: String(e && e.message || e) }); }
            }

            // Indicators
            function clearAllIndicators(){
              try {
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                var ids = window.__SIMPLE_KLINE__.indicatorIds || [];
                if (ids && ids.length && typeof chart.removeIndicator === 'function') {
                  ids.forEach(function(id){ try { chart.removeIndicator(id); } catch(_) {} });
                }
                window.__SIMPLE_KLINE__.indicatorIds = [];
                try {
                  if (typeof chart.getIndicators === 'function') {
                    var remaining = chart.getIndicators() || [];
                    remaining.forEach(function(ind){
                      try {
                        if (ind && ind.id) chart.removeIndicator(ind.id);
                        else if (ind && ind.name) chart.removeIndicator(ind.name);
                      } catch(_) {}
                    });
                  }
                } catch(_) {}
              } catch(e) { post({ warn: 'clearAllIndicators failed', message: String(e && e.message || e) }); }
            }

            function createIndicatorSafe(cfg){
              try {
                if (!cfg || !cfg.name) return;
                var nm = String(cfg.name).toUpperCase();
                var overlayCompat = ['BBI','BOLL','EMA','MA','SAR','SMA'];
                var wantsOverlay = !!cfg.overlay || overlayCompat.indexOf(nm) >= 0;
                var options = {};
                if (wantsOverlay) { options.id = 'candle_pane'; }
                if (cfg.styles && cfg.styles.lines) {
                  var processedStyles = { lines: [] };
                  cfg.styles.lines.forEach(function(line){
                    var lineStyle = { color: line.color || '#3B82F6', size: line.size || 1, style: line.style || 'solid' };
                    if (line.style === 'dashed') { lineStyle.style = 'dashed'; lineStyle.dashedValue = [5, 3]; }
                    else if (line.style === 'dotted') { lineStyle.style = 'dashed'; lineStyle.dashedValue = [1, 2]; }
                    else { lineStyle.style = 'solid'; }
                    processedStyles.lines.push(lineStyle);
                  });
                  options.styles = processedStyles;
                } else if (cfg.styles) { options.styles = cfg.styles; }
                if (cfg.calcParams) { options.calcParams = cfg.calcParams; }

                var created = null;
                try { if (typeof chart.createIndicator === 'function') { created = chart.createIndicator(nm, false, options); } }
                catch(e1) { try { created = chart.createIndicator(Object.assign({ name: nm }, options)); } catch(_) { post({ warn: 'createIndicator failed', name: nm }); } }

                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.indicatorIds = window.__SIMPLE_KLINE__.indicatorIds || [];
                if (created) { window.__SIMPLE_KLINE__.indicatorIds.push(created); } else { post({ warn: 'Failed to create indicator', name: nm }); }
                return created;
              } catch(err) { post({ warn: 'createIndicatorSafe exception', message: String(err && err.message || err) }); }
            }

            try {
              clearAllIndicators();
              if (Array.isArray(INDICATORS)) { INDICATORS.forEach(function(ic){ createIndicatorSafe(ic); }); }
            } catch(_) {}

            function overrideIndicator(id, styles, calcParams) {
              try {
                if (!chart) { post({ error: 'Chart instance not available' }); return false; }
                var indicatorName = typeof id === 'string' ? id : (id && id.name) || '';
                var allIndicators = [];
                try { if (typeof chart.getIndicators === 'function') { allIndicators = chart.getIndicators() || []; } } catch(_) {}
                var foundIndicator = allIndicators.find(function(ind) { return ind && ind.name === indicatorName; });
                if (!foundIndicator) { post({ error: 'Indicator not found', name: indicatorName }); return false; }

                var overrideObject = { id: foundIndicator.id, styles: styles || {} };
                if (calcParams && Array.isArray(calcParams) && calcParams.length > 0) { overrideObject.calcParams = calcParams; }
                if (styles && styles.lines && Array.isArray(styles.lines)) {
                  var processedStyles = { lines: [] };
                  styles.lines.forEach(function(line){
                    var lineStyle = { color: line.color || '#3B82F6', size: line.size || 1, style: line.style || 'solid' };
                    if (line.style === 'dashed') { lineStyle.style = 'dashed'; lineStyle.dashedValue = line.dashedValue || [5, 3]; }
                    else if (line.style === 'dotted') { lineStyle.style = 'dashed'; lineStyle.dashedValue = [1, 2]; }
                    else if (line.style === 'solid') { lineStyle.style = 'solid'; }
                    processedStyles.lines.push(lineStyle);
                  });
                  overrideObject.styles = processedStyles;
                }

                if (typeof chart.overrideIndicator === 'function') { chart.overrideIndicator(overrideObject, 'candle_pane', function(){}); }
                else { post({ error: 'overrideIndicator method not available on chart instance' }); return false; }
                return true;
              } catch(e) { post({ error: 'overrideIndicator failed', message: String(e && e.message || e), stack: e.stack }); return false; }
            }

            window.__SIMPLE_KLINE__ = {
              setChartType: function(t){ try { applyChartType(chart, t); } catch(e) {} },
              setLevels: function(lvls){ try { applyLevels(lvls); } catch(_){} },
              setIndicators: function(list){ try { clearAllIndicators(); if (Array.isArray(list)) { list.forEach(function(ic){ createIndicatorSafe(ic); }); } } catch(e) { post({ warn: 'setIndicators failed', message: String(e && e.message || e) }); } },
              overrideIndicator: overrideIndicator,
              levelOverlayIds: [],
              sessionOverlayIds: []
            };

            // Custom buttons
            (function(){
              try {
                var alertBtn = document.getElementById('btn-alert');
                var measureBtn = document.getElementById('btn-measure');
                var crosshairBtn = document.getElementById('btn-crosshair');
                if (alertBtn) {
                  alertBtn.addEventListener('click', function(e) {
                    e.preventDefault(); e.stopPropagation();
                    try {
                      var price = window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.lastCrosshairPrice;
                      if (typeof price === 'number') {
                        // Just notify React Native - WebView will reload with new alerts
                        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'alertClick', price: price }));
                        }
                      }
                    } catch(err) { post({ error: 'Alert button click failed', message: String(err) }); }
                  });
                }
                if (measureBtn) {
                  measureBtn.addEventListener('click', function(e) {
                    e.preventDefault(); e.stopPropagation();
                    try {
                      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'measureClick', price: window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.lastCrosshairPrice }));
                      }
                    } catch(err) { post({ error: 'Measure button click failed', message: String(err) }); }
                  });
                }
                if (crosshairBtn) {
                  crosshairBtn.addEventListener('click', function(e) {
                    e.preventDefault(); e.stopPropagation();
                    try {
                      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'crosshairClick', price: window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.lastCrosshairPrice }));
                      }
                    } catch(err) { post({ error: 'Crosshair button click failed', message: String(err) }); }
                  });
                }
              } catch(e) { post({ warn: 'Custom button setup failed', message: String(e && e.message || e) }); }
            })();

            // Crosshair + interactions
            (function(){
              try {
                var ActionType = (window.klinecharts && (window.klinecharts.ActionType || window.klinecharts.ProActionType)) || {};
                var buttonsVisible = false;
                var hideButtonsTimeout = null;
                var buttonsShownByLongPress = false;
                var lastLongPressTime = null;
                var longPressTimer = null;
                var longPressStartPos = null;
                var longPressFired = false;
                var LONG_PRESS_MS = 700;
                var LONG_PRESS_MOVE_TOLERANCE = 2;
                var movedBeyondTolerance = false;

                function updateCursorVisibility() {
                  if (chart && typeof chart.setStyles === 'function') {
                    chart.setStyles({ crosshair: { show: buttonsVisible, horizontal: { show: buttonsVisible }, vertical: { show: buttonsVisible } } });
                  }
                }
                function showButtons(y, isFromLongPress) {
                  try {
                    var buttonsContainer = document.getElementById('crosshair-buttons');
                    if (buttonsContainer && typeof y === 'number') {
                      buttonsContainer.style.display = 'flex';
                      buttonsContainer.style.top = (y - 18) + 'px';
                      buttonsVisible = true;
                      if (isFromLongPress) buttonsShownByLongPress = true;
                      updateCursorVisibility();
                      if (hideButtonsTimeout) { clearTimeout(hideButtonsTimeout); hideButtonsTimeout = null; }
                    }
                  } catch(_) {}
                }
                function hideButtons() {
                  try {
                    var buttonsContainer = document.getElementById('crosshair-buttons');
                    if (buttonsContainer) {
                      buttonsContainer.style.display = 'none';
                      buttonsVisible = false;
                      buttonsShownByLongPress = false;
                      updateCursorVisibility();
                    }
                  } catch(_) {}
                }
                function hideButtonsDelayed(delay) {
                  delay = delay || 150;
                  if (hideButtonsTimeout) { clearTimeout(hideButtonsTimeout); }
                  hideButtonsTimeout = setTimeout(function() { hideButtons(); hideButtonsTimeout = null; }, delay);
                }

                function subscribeActionSafe(name, cb){
                  try { if (typeof chart.subscribeAction === 'function') { chart.subscribeAction(name, cb); return true; } }
                  catch(e) { post({ warn: 'subscribeAction failed', name: name, message: String(e && e.message || e) }); }
                  return false;
                }

                var CHANGE_EVT = ActionType.OnCrosshairChange || 'onCrosshairChange';
                subscribeActionSafe(CHANGE_EVT, function(param){
                  try {
                    if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                    window.__SIMPLE_KLINE__.lastCrosshair = param;
                    var ptr = window.__SIMPLE_KLINE__.lastPointerPrice;
                    if (typeof ptr === 'number') { window.__SIMPLE_KLINE__.lastCrosshairPrice = ptr; }
                    if (buttonsShownByLongPress && param && typeof param.y === 'number') { showButtons(param.y, false); }
                  } catch(_) {}
                });

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
                          if (typeof val === 'number') { window.__SIMPLE_KLINE__.lastPointerPrice = val; }
                        }
                        if (longPressStartPos) {
                          var dx = Math.abs(x - longPressStartPos.x);
                          var dy = Math.abs(y - longPressStartPos.y);
                          if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
                            try { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } } catch(_) {}
                            movedBeyondTolerance = true;
                          }
                        }
                        if (buttonsShownByLongPress && typeof y === 'number') { showButtons(y); }
                      } catch(_) { }
                    };

                    var touchStartTime = null;
                    var handlePointerStart = function(e) {
                      try {
                        touchStartTime = Date.now();
                        updatePointer(e);
                        if (buttonsShownByLongPress) { hideButtons(); }
                        try { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } } catch(_) {}
                        longPressFired = false;
                        longPressStartPos = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.lastPointer) ? { x: window.__SIMPLE_KLINE__.lastPointer.x, y: window.__SIMPLE_KLINE__.lastPointer.y } : null;
                        movedBeyondTolerance = false;
                        longPressTimer = setTimeout(function(){
                          try {
                            if (touchStartTime !== null) {
                              var targetY = null;
                              var lastCrosshair = window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.lastCrosshair;
                              if (lastCrosshair && typeof lastCrosshair.y === 'number') targetY = lastCrosshair.y;
                              else if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.lastPointer) targetY = window.__SIMPLE_KLINE__.lastPointer.y;
                              if (!movedBeyondTolerance && typeof targetY === 'number') { showButtons(targetY, true); longPressFired = true; lastLongPressTime = Date.now(); }
                            }
                          } catch(_) {}
                        }, LONG_PRESS_MS);
                      } catch(_) {}
                    };

                    container.addEventListener('pointermove', updatePointer, { passive: true });
                    container.addEventListener('pointerdown', handlePointerStart, { passive: true });
                    container.addEventListener('touchstart', handlePointerStart, { passive: true });
                    container.addEventListener('touchmove', updatePointer, { passive: true });

                    container.addEventListener('pointerleave', function() {
                      if (!buttonsShownByLongPress) { hideButtonsDelayed(50); }
                      touchStartTime = null;
                      movedBeyondTolerance = false;
                      try { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } } catch(_) {}
                    }, { passive: true });

                    var handlePointerEnd = function(e) {
                      try {
                        var touchEndTime = Date.now();
                        var touchDuration = touchStartTime ? (touchEndTime - touchStartTime) : 0;
                        if (touchDuration >= LONG_PRESS_MS && (longPressFired || !movedBeyondTolerance)) {
                          lastLongPressTime = touchEndTime;
                          var lastCrosshair = window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.lastCrosshair;
                          if (lastCrosshair && typeof lastCrosshair.y === 'number') { showButtons(lastCrosshair.y, true); }
                          else if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.lastPointer) {
                            var lastY = window.__SIMPLE_KLINE__.lastPointer.y; if (typeof lastY === 'number') { showButtons(lastY, true); }
                          }
                        } else if (touchStartTime !== null) {
                          var timeSinceLastLongPress = lastLongPressTime ? (touchEndTime - lastLongPressTime) : Infinity;
                          var cooldownPeriod = 500;
                          if (timeSinceLastLongPress < cooldownPeriod) {
                            // ignore
                          } else {
                            if (buttonsShownByLongPress) { hideButtons(); }
                            else { hideButtonsDelayed(100); }
                          }
                        }
                        touchStartTime = null;
                        movedBeyondTolerance = false;
                        try { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } } catch(_) {}
                      } catch(_) {}
                    };

                    container.addEventListener('pointerup', handlePointerEnd, { passive: true });
                    container.addEventListener('touchend', handlePointerEnd, { passive: true });

                    container.addEventListener('touchcancel', function() {
                      hideButtons();
                      touchStartTime = null;
                      movedBeyondTolerance = false;
                      try { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } } catch(_) {}
                    }, { passive: true });

                    document.addEventListener('pointermove', function(e) {
                      try {
                        if (!buttonsVisible || !container) return;
                        var rect = container.getBoundingClientRect();
                        var x = e.clientX; var y = e.clientY;
                        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                          if (!buttonsShownByLongPress) { hideButtonsDelayed(50); }
                        }
                      } catch(_) {}
                    }, { passive: true });

                    if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                    window.__SIMPLE_KLINE__.getYForPrice = function(price){
                      try { if (chart && typeof chart.convertToPixel === 'function') { var px = chart.convertToPixel({ value: Number(price) }); if (px && typeof px.y === 'number') return px.y; } } catch(_) {}
                      return null;
                    };

                    window.__SIMPLE_KLINE__.draggingAlert = null;
                    window.__SIMPLE_KLINE__.dragPreviewId = null;

                    var handlePointerDown = function(e){
                      try {
                        var rect = container.getBoundingClientRect();
                        var x = (e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX)) - rect.left;
                        var y = (e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY)) - rect.top;
                        var reg = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.alertsRegistry) || [];
                        var best = null;
                        if (reg && reg.length) {
                          for (var i = 0; i < reg.length; i++) {
                            var r = reg[i];
                            var ay = window.__SIMPLE_KLINE__.getYForPrice ? window.__SIMPLE_KLINE__.getYForPrice(r.price) : null;
                            if (ay == null) continue;
                            var dy = Math.abs(y - ay);
                            if (best == null || dy < best.dy) best = { id: r.id, price: r.price, y: ay, dy: dy };
                          }
                        }
                        if (best && best.dy <= 12) {
                          if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                          window.__SIMPLE_KLINE__.selectedAlertId = best.id;
                          try { applyAlerts(window.__SIMPLE_KLINE__.lastAlerts || []); } catch(_){ }
                          post({ type: 'alertSelected', id: best.id, price: best.price, y: best.y });
                          window.__SIMPLE_KLINE__.draggingAlert = { id: best.id, startY: y, price: best.price };
                          window.__SIMPLE_KLINE__.draggingCurrentPrice = best.price;
                        } else {
                          if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                          window.__SIMPLE_KLINE__.selectedAlertId = null;
                          try { applyAlerts(window.__SIMPLE_KLINE__.lastAlerts || []); } catch(_){ }
                          if (buttonsShownByLongPress) { hideButtons(); }
                        }
                      } catch(_) {}
                    };
                    container.addEventListener('pointerdown', handlePointerDown, { passive: true });
                    container.addEventListener('touchstart', handlePointerDown, { passive: true });

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
                            var prevId = window.__SIMPLE_KLINE__.dragPreviewId;
                            try { if (prevId && typeof chart.removeOverlay === 'function') chart.removeOverlay(prevId); } catch(_){ }
                            try {
                              var pid = chart.createOverlay({ name: 'horizontalStraightLine', lock: true, points: [{ value: Number(val) }], styles: { line: { color: '#F59E0B', size: 1, style: 'dashed', dashedValue: [6, 4] } } });
                              window.__SIMPLE_KLINE__.dragPreviewId = pid;
                            } catch(_){ }
                          }
                        }
                      } catch(_) {}
                    };
                    container.addEventListener('pointermove', handlePointerMove, { passive: true });
                    container.addEventListener('touchmove', handlePointerMove, { passive: true });

                    var handlePointerUp = function(e){
                      try {
                        var drag = window.__SIMPLE_KLINE__.draggingAlert;
                        if (!drag) return;
                        try { if (window.__SIMPLE_KLINE__.dragPreviewId && typeof chart.removeOverlay === 'function') chart.removeOverlay(window.__SIMPLE_KLINE__.dragPreviewId); } catch(_){ }
                        var finalPrice = window.__SIMPLE_KLINE__.draggingCurrentPrice;
                        window.__SIMPLE_KLINE__.draggingAlert = null;
                        window.__SIMPLE_KLINE__.dragPreviewId = null;
                        if (typeof finalPrice === 'number') { post({ type: 'alertDragEnd', id: drag.id, price: Number(finalPrice) }); }
                      } catch(_) {}
                    };
                    container.addEventListener('pointerup', handlePointerUp, { passive: true });
                    container.addEventListener('touchend', handlePointerUp, { passive: true });
                  }
                } catch(_) {}
              } catch(e) { post({ warn: 'crosshair_events_setup_failed', message: String(e && e.message || e) }); }
            })();

            post({ ready: true, symbol: SYMBOL });
            try { applyLevels(LEVELS); } catch(_){ }
            try { applySessionBackgrounds(); } catch(_){ }
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
    customBars,
    customData,
    indicatorsKey,
    showSessions,
    alertsKey,
  ]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webRef}
        key={`${symbol}-${timeframe}-${chartType}-${dataKey}-${indicatorsKey}-${showSessions}-${alertsKey}`}
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
            } else if (data.type === "measureClick" && onMeasureClick) {
              if (data && typeof data.price === "number")
                onMeasureClick(data.price);
            } else if (data.type === "crosshairClick" && onCrosshairClick) {
              if (data && typeof data.price === "number")
                onCrosshairClick(data.price);
            } else if (data.error) {
              console.warn("[SimpleKLineChart:error]", data);
            } else if (data.warn) {
              console.warn("[SimpleKLineChart:warn]", data);
            }
          } catch (e) {
            console.log("[SimpleKLineChart:raw]", event.nativeEvent.data);
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
