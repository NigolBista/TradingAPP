import React, { useMemo, useRef } from "react";
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
  flushRightEdge?: boolean;
  levels?: {
    entries?: number[];
    exits?: number[];
    takeProfits?: number[];
  };
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
  levels,
}: Props) {
  const webRef = useRef<WebView>(null);
  const polygonApiKey: string | undefined = (Constants.expoConfig?.extra as any)
    ?.polygonApiKey;

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
        var LEVELS = ${JSON.stringify(levels || {})};
        var POLY_API_KEY = ${JSON.stringify(polygonApiKey || "")};

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
                    line: { show: SHOW_LAST_PRICE_LABEL },
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
                horizontal: { text: { show: SHOW_TOP_INFO } },
                vertical: { text: { show: SHOW_TOP_INFO } }
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
              }
            };
            if (!SHOW_TOP_INFO) {
              // Hide OHLC/time/volume header tooltip text
              opts.candle.tooltip = { showRule: 'none' };
              // Also hide indicator tooltips if the lib supports it
              opts.indicator = Object.assign({}, (opts.indicator || {}), { tooltip: { showRule: 'none' } });
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
            var chart = window.klinecharts.init('k-line-chart');
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

            // v10: Use data loader backed by Polygon.io
            if (typeof chart.setDataLoader === 'function') {
              chart.setDataLoader({
                getBars: function(ctx){
                  try {
                    var callback = ctx && ctx.callback ? ctx.callback : function(){};
                    var p = mapPeriod(TF);
                    var to = Date.now();
                    var from = to - 500 * periodToMs(p);
                    if (!POLY_API_KEY) { post({ warn: 'Missing Polygon API key' }); callback([]); return; }
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
                      })
                      .catch(function(err){ post({ error: 'polygon_load_failed', message: String(err && err.message || err) }); callback([]); });
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
                  })
                  .catch(function(err){ post({ error: 'polygon_load_failed', message: String(err && err.message || err) }); });
              })();
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
            function addPriceLine(price, color, label){
              try {
                if (!price || isNaN(price)) return;
                var opts = {
                  name: 'horizontalStraightLine',
                  lock: true,
                  extend: 'none',
                  points: [{ value: Number(price) }],
                  styles: {
                    line: { color: color, size: 1, style: 'dashed', dashedValue: [4, 2] },
                    text: { show: true, color: '#FFFFFF', size: 11, backgroundColor: color, borderColor: color, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 3, text: String(label) + ' ' + Number(price).toFixed(2) }
                  }
                };
                var id;
                if (chart && typeof chart.createOverlay === 'function') {
                  id = chart.createOverlay(opts);
                }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.levelOverlayIds = (window.__SIMPLE_KLINE__.levelOverlayIds || []).concat([id]);
              } catch(e){ post({ warn: 'addPriceLine failed', message: String(e && e.message || e) }); }
            }
            function applyLevels(levels){
              try {
                clearLevels();
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
                entries.forEach(function(p){ addPriceLine(p, '#10B981', 'Entry'); });
                exits.forEach(function(p){ addPriceLine(p, '#EF4444', 'Exit'); });
                tps.forEach(function(p, i){ addPriceLine(p, '#3B82F6', 'TP' + (i+1)); });
              } catch(e){ post({ warn: 'applyLevels failed', message: String(e && e.message || e) }); }
            }

            window.__SIMPLE_KLINE__ = {
              setChartType: function(t){ try { applyChartType(chart, t); } catch(e) {} },
              setLevels: function(lvls){ try { applyLevels(lvls); } catch(_){} },
              levelOverlayIds: []
            };

            post({ ready: true, symbol: SYMBOL });

            // Apply initial levels if provided
            try { applyLevels(LEVELS); } catch(_){}
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
  ]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webRef}
        key={`${symbol}-${timeframe}-${chartType}`}
        originWhitelist={["*"]}
        source={{ html }}
        style={{ height, width: "100%" }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled
        onMessage={() => {}}
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
