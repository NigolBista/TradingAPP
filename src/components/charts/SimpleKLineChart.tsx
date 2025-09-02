import React, { useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  theme?: "dark" | "light";
  chartType?: "candle" | "line" | "area";
  showVolume?: boolean;
  showMA?: boolean;
  showAxisText?: boolean;
  showTopInfo?: boolean;
  showGrid?: boolean;
}

export default function SimpleKLineChart({
  symbol,
  timeframe = "1D",
  height = 280,
  theme = "dark",
  chartType = "candle",
  showVolume = true,
  showMA = true,
  showAxisText = true,
  showTopInfo = true,
  showGrid = true,
}: Props) {
  const webRef = useRef<WebView>(null);

  const html = useMemo(() => {
    const safeSymbol = (symbol || "AAPL").toUpperCase();
    const ct = chartType;
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
        var SHOW_AXIS_TEXT = ${JSON.stringify(showAxisText)};
        var SHOW_TOP_INFO = ${JSON.stringify(showTopInfo)};
        var SHOW_GRID = ${JSON.stringify(showGrid)};

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
              candle: { type: type },
              xAxis: { tickText: { show: SHOW_AXIS_TEXT } },
              yAxis: { tickText: { show: SHOW_AXIS_TEXT } },
              crosshair: {
                horizontal: { text: { show: SHOW_TOP_INFO } },
                vertical: { text: { show: SHOW_TOP_INFO } }
              },
              grid: {
                horizontal: { show: SHOW_GRID, display: SHOW_GRID },
                vertical: { show: SHOW_GRID, display: SHOW_GRID }
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

            // v10: Use data loader for demo data
            if (typeof chart.setDataLoader === 'function') {
              chart.setDataLoader({
                getBars: function(ctx){
                  try {
                    var callback = ctx && ctx.callback ? ctx.callback : function(){};
                    fetch('https://klinecharts.com/datas/kline.json')
                      .then(function(res){ return res.json(); })
                      .then(function(list){
                        // Ensure field names match expected schema
                        var out = Array.isArray(list) ? list.map(function(d){
                          if (d.timestamp) return d;
                          // Map common aliases if needed
                          return {
                            timestamp: d.time || d.t || 0,
                            open: d.open || d.o,
                            high: d.high || d.h,
                            low: d.low || d.l,
                            close: d.close || d.c,
                            volume: d.volume || d.v || 0
                          };
                        }) : [];
                        callback(out);
                      })
                      .catch(function(err){ post({ error: 'data_load_failed', message: String(err && err.message || err) }); });
                  } catch (e) { post({ error: 'getBars_failed', message: String(e && e.message || e) }); }
                }
              });
            } else {
              // Fallback to immediate apply if loader not available
              fetch('https://klinecharts.com/datas/kline.json')
                .then(function(res){ return res.json(); })
                .then(function(list){
                  try { chart.applyNewData(list || []); } catch(e) { post({ error: 'applyNewData failed', message: String(e && e.message || e) }); }
                })
                .catch(function(err){ post({ error: 'data_load_failed', message: String(err && err.message || err) }); });
            }

            window.__SIMPLE_KLINE__ = {
              setChartType: function(t){ try { applyChartType(chart, t); } catch(e) {} }
            };

            post({ ready: true, symbol: SYMBOL });
            return true;
          } catch (err) { post({ error: String(err && err.message || err) }); return false; }
        }

        function init(){ if (!create()) { var tries = 0; var t = setInterval(function(){ tries++; if (create() || tries > 100) clearInterval(t); }, 100); } }
        if (document.readyState === 'complete' || document.readyState === 'interactive') { init(); } else { document.addEventListener('DOMContentLoaded', init); }
      })();
    </script>
  </body>
</html>`;
  }, [symbol, timeframe, height, theme, chartType]);

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
