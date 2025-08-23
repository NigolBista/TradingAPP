import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";

type SupportedTimeframe =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "45m"
  | "1h"
  | "2h"
  | "4h"
  | "1d"
  | "1w"
  | "1M"
  | "3M"
  | "6M"
  | "1Y"
  | "5Y"
  | "ALL";

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  locale?: "en-US" | "zh-CN";
  theme?: "dark" | "light";
  market?: "stocks" | "crypto" | "forex"; // Polygon market routing
  minimalUi?: boolean;
  lineOnly?: boolean;
}

function mapTimeframeToPeriod(tf: string | undefined): {
  multiplier: number;
  timespan: string;
  text: string;
} {
  const raw = (tf || "1d") as string;
  const lower = raw.toLowerCase();

  // Handle minute timeframes (1m, 3m, 5m, etc.)
  if (lower.endsWith("m") && !/[a-z]$/.test(raw.replace(/[0-9]/g, ""))) {
    const n = parseInt(lower.replace("m", "")) || 1;
    return { multiplier: n, timespan: "minute", text: `${n}m` };
  }

  // Handle hour timeframes (1h, 2h, 4h, etc.)
  if (lower.endsWith("h")) {
    const n = parseInt(lower.replace("h", "")) || 1;
    return { multiplier: n, timespan: "hour", text: `${n}h` };
  }

  // Handle day/week timeframes
  if (lower === "1d") return { multiplier: 1, timespan: "day", text: "1D" };
  if (lower === "1w") return { multiplier: 1, timespan: "week", text: "1W" };

  // Handle month/year timeframes (uppercase M and Y)
  if (raw === "1M") return { multiplier: 1, timespan: "month", text: "1M" };
  if (raw === "3M") return { multiplier: 3, timespan: "month", text: "3M" };
  if (raw === "6M") return { multiplier: 6, timespan: "month", text: "6M" };
  if (raw === "1Y") return { multiplier: 1, timespan: "year", text: "1Y" };
  if (raw === "5Y") return { multiplier: 5, timespan: "year", text: "5Y" };

  // Handle ALL timeframe (use monthly for maximum range)
  if (raw === "ALL") return { multiplier: 1, timespan: "month", text: "ALL" };

  // Default fallback
  return { multiplier: 1, timespan: "day", text: "1D" };
}

const DEFAULT_PERIODS = [
  { multiplier: 1, timespan: "minute", text: "1m" },
  { multiplier: 3, timespan: "minute", text: "3m" },
  { multiplier: 5, timespan: "minute", text: "5m" },
  { multiplier: 15, timespan: "minute", text: "15m" },
  { multiplier: 1, timespan: "hour", text: "1h" },
  { multiplier: 4, timespan: "hour", text: "4h" },
  { multiplier: 1, timespan: "day", text: "1D" },
  { multiplier: 1, timespan: "week", text: "1W" },
  { multiplier: 1, timespan: "month", text: "1M" },
  { multiplier: 3, timespan: "month", text: "3M" },
  { multiplier: 1, timespan: "year", text: "1Y" },
  { multiplier: 5, timespan: "year", text: "5Y" },
];

export default function KLineProChart({
  symbol,
  timeframe = "1d",
  height = 280,
  locale = "en-US",
  theme = "dark",
  market = "stocks",
  minimalUi = false,
  lineOnly = false,
}: Props) {
  const polygonApiKey: string | undefined = (Constants.expoConfig?.extra as any)
    ?.polygonApiKey;

  const period = useMemo(
    () => mapTimeframeToPeriod(timeframe as SupportedTimeframe),
    [timeframe]
  );

  const html = useMemo(() => {
    const compactUi = minimalUi || lineOnly;
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
      ${
        compactUi
          ? `
      /* Minimal UI mode: hide all pro UI layers */
      .klinecharts-pro-header,
      .klinecharts-pro-toolbar,
      .klinecharts-pro-symbol-info,
      .klinecharts-pro-period-selector,
      .klinecharts-pro-left-panel,
      .klinecharts-pro-right-panel,
      .klinecharts-pro-volume-pane,
      .klinecharts-pro-indicator-pane,
      .klinecharts-pro-drawing-toolbar,
      .klinecharts-pro-settings-button,
      .klinecharts-pro-timeline,
      .klinecharts-pro-navbar,
      .klinecharts-pro-title-bar,
      [class*="header"],
      [class*="toolbar"],
      [class*="symbol"],
      [class*="period"],
      [class*="timeframe"],
      [class*="timeline"],
      [class*="nav"],
      [class*="topbar"],
      [class*="volume"],
      [class*="indicator"],
      [class*="legend"],
      [class*="left-panel"],
      [class*="drawing"],
      [class*="menu"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
      }
      #app > *:not([class*="main"]):not([class*="chart"]) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        overflow: hidden !important;
      }
      `
          : ""
      }
      
      /* Ensure main chart takes full space */
      .klinecharts-pro-main,
      .klinecharts-pro-chart,
      [class*="main"],
      [class*="chart-container"] {
        width: 100% !important;
        height: 100% !important;
      }
      /* Collapse any pane separators and empty panes */
      .klinecharts-pro-pane-separator,
      [class*="pane-separator"] {
        display: none !important;
        height: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }
      /* If supported, hide wrapper panes that contain volume/indicator */
      .klinecharts-pro [class*="pane"]:has([class*="volume"]),
      .klinecharts-pro [class*="pane"]:has([class*="indicator"]) {
        display: none !important;
        height: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
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
        function create(){
          try {
            if (!window.klinechartspro) { return false; }
            const { KLineChartPro, DefaultDatafeed } = window.klinechartspro;
            if (!${JSON.stringify(
              !!apiKey
            )}) { post({ warn: 'Missing POLYGON_API_KEY (extra.polygonApiKey)' }); }
            const datafeed = new DefaultDatafeed(${JSON.stringify(apiKey)});
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
              ${lineOnly ? `mainChartType: 'timeLine',` : ""}
              period: ${JSON.stringify(period)},
              periods: ${JSON.stringify(DEFAULT_PERIODS)},
              datafeed,
              ${
                compactUi
                  ? `layout: {
                showVolumePane: false,
                showIndicatorPane: false,
                showLeftPanel: false,
                showRightPanel: false,
                showHeader: false,
                showToolbar: false,
                showTimeline: false,
                showPriceScale: false,
                showSymbolInfo: false,
                showPeriodSelector: false,
                showDrawingToolbar: false,
                showSettingsButton: false
              },`
                  : ""
              }
            });
            
            ${
              compactUi
                ? `// Robustly hide any remaining UI elements
            (function(){
              const selectors = [
                '.klinecharts-pro-header',
                '.klinecharts-pro-toolbar',
                '.klinecharts-pro-symbol-info',
                '.klinecharts-pro-period-selector',
                '.klinecharts-pro-left-panel',
                '.klinecharts-pro-right-panel',
                '.klinecharts-pro-volume-pane',
                '.klinecharts-pro-indicator-pane',
                '.klinecharts-pro-drawing-toolbar',
                '.klinecharts-pro-settings-button',
                '.klinecharts-pro-timeline',
                '.klinecharts-pro-navbar',
                '.klinecharts-pro-title-bar',
                '.klinecharts-pro-watermark',
                '.klinecharts-watermark',
                '.klinecharts-pro-logo',
                '[class*="header"]',
                '[class*="toolbar"]',
                '[class*="symbol"]',
                '[class*="period"]',
                '[class*="timeframe"]',
                '[class*="timeline"]',
                '[class*="nav"]',
                '[class*="topbar"]',
                '[class*="volume"]',
                '[class*="indicator"]',
                '[class*="left-panel"]',
                '[class*="drawing"]',
                '[class*="menu"]',
                '[class*="watermark"]',
                '[class*="logo"]',
                '[class*="brand"]'
              ];
              function hideAll(){
                try {
                  selectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                      el.style.display = 'none';
                      el.style.visibility = 'hidden';
                      el.style.opacity = '0';
                      el.style.height = '0';
                      el.style.width = '0';
                      el.style.overflow = 'hidden';
                    });
                  });
                  // Hide any direct children that are not main chart containers
                  try {
                    const app = document.getElementById('app');
                    if (app) {
                      Array.from(app.children).forEach(ch => {
                        const c = ch.className || '';
                        if (typeof c === 'string' && !c.includes('main') && !c.includes('chart')) {
                          ch.style.display = 'none';
                          ch.style.visibility = 'hidden';
                          ch.style.opacity = '0';
                          ch.style.height = '0';
                          ch.style.width = '0';
                          ch.style.overflow = 'hidden';
                        }
                      });
                    }
                  } catch (e) {}
                } catch (e) {}
              }
              hideAll();
              setTimeout(hideAll, 100);
              setTimeout(hideAll, 300);
              setTimeout(hideAll, 600);
              try {
                const root = document.getElementById('app');
                if (root && window.MutationObserver) {
                  const mo = new MutationObserver(() => hideAll());
                  mo.observe(root, { childList: true, subtree: true });
                }
              } catch (e) {}
            })();`
                : ""
            }

            ${
              compactUi
                ? `// Force remove volume/indicator panes and reclaim space
            (function(){
              function removeWrapperPane(el){
                try {
                  if (!el) return;
                  var pane = el.closest && el.closest('[class*="pane"]');
                  if (pane && pane.parentNode) {
                    try { pane.parentNode.removeChild(pane); } catch(_) {}
                  } else if (el.parentNode) {
                    try { el.parentNode.removeChild(el); } catch(_) {}
                  }
                } catch(_) {}
              }
              function expandMainPane(){
                try {
                  var root = document.querySelector('.klinecharts-pro-chart') || document.getElementById('app');
                  if (!root) return;
                  var panes = Array.from(root.querySelectorAll('[class*="pane"]'));
                  // Filter out any hidden/collapsed panes
                  panes = panes.filter(function(p){
                    var style = window.getComputedStyle ? window.getComputedStyle(p) : (p.style || {});
                    return style && style.display !== 'none' && style.height !== '0px';
                  });
                  if (panes.length > 0) {
                    var main = panes.find(function(p){ return (p.className+"").includes('main'); }) || panes[0];
                    try { main.style.height = '100%'; main.style.minHeight = '100%'; } catch(_) {}
                  }
                } catch(_) {}
              }
              function collapse(){
                try {
                  var sel = [
                    '.klinecharts-pro-volume-pane',
                    '.klinecharts-pro-indicator-pane',
                    '[class*="volume-pane"]',
                    '[class*="indicator-pane"]',
                    '[class*="volume"]',
                    '[class*="indicator"]'
                  ];
                  sel.forEach(function(s){
                    try {
                      var nodes = document.querySelectorAll(s);
                      nodes.forEach(function(n){ removeWrapperPane(n); });
                    } catch(_) {}
                  });
                } catch(_) {}
                expandMainPane();
                try { if (chart && typeof chart.setLayout === 'function') { chart.setLayout({ showVolumePane: false, showIndicatorPane: false }); } } catch(_) {}
                try { if (chart && typeof chart.resize === 'function') { chart.resize(); } } catch(_) {}
                try { if (chart && chart.chart && typeof chart.chart.resize === 'function') { chart.chart.resize(); } } catch(_) {}
              }
              collapse();
              setTimeout(collapse, 50);
              setTimeout(collapse, 150);
              setTimeout(collapse, 350);
              try {
                var root = document.getElementById('app');
                if (root && window.MutationObserver) {
                  var mo = new MutationObserver(function(){ collapse(); });
                  mo.observe(root, { childList: true, subtree: true, attributes: true });
                }
              } catch(_) {}
            })();`
                : ""
            }

            ${
              lineOnly
                ? `// Switch to simple line style if supported
            (function(){
              function toLine(){
                try { if (chart && typeof chart.setMainChartType === 'function') { chart.setMainChartType('timeLine'); } } catch(e) {}
                try { if (chart && typeof chart.setStyleOptions === 'function') { chart.setStyleOptions({ candle: { type: 'line' } }); } } catch(e) {}
                try { if (chart && chart.chart && typeof chart.chart.setStyles === 'function') { chart.chart.setStyles({ candle: { type: 'line' } }); } } catch(e) {}
                try { if (chart && typeof chart.setChartType === 'function') { chart.setChartType('line'); } } catch(e) {}
                try { if (chart && typeof chart.setStyles === 'function') { chart.setStyles({ candle: { type: 'line' } }); } } catch(e) {}
                // Apply minimalist styles: no grid/axes/crosshair/tooltip/marks, area line only
                var styleCfg = {
                  grid: { show: false, horizontal: { show: false }, vertical: { show: false } },
                  candle: {
                    type: 'area',
                    area: {
                      lineSize: 2,
                      lineColor: '#00D4AA',
                      smooth: true,
                      value: 'close',
                      backgroundColor: [{ offset: 0, color: 'rgba(0,0,0,0)' }, { offset: 1, color: 'rgba(0,0,0,0)' }],
                      point: { show: false }
                    },
                    priceMark: { show: false },
                    tooltip: { showRule: 'none' }
                  },
                  indicator: {
                    lastValueMark: { show: false },
                    tooltip: { showRule: 'none' },
                    ohlc: { upColor: 'transparent', downColor: 'transparent', noChangeColor: 'transparent' },
                    bars: [{ style: 'fill', borderStyle: 'solid', borderSize: 0, upColor: 'transparent', downColor: 'transparent', noChangeColor: 'transparent' }],
                    lines: [
                      { style: 'solid', smooth: false, size: 0, color: 'transparent' },
                      { style: 'solid', smooth: false, size: 0, color: 'transparent' },
                      { style: 'solid', smooth: false, size: 0, color: 'transparent' },
                      { style: 'solid', smooth: false, size: 0, color: 'transparent' },
                      { style: 'solid', smooth: false, size: 0, color: 'transparent' }
                    ],
                    circles: [{ style: 'fill', borderStyle: 'solid', borderSize: 0, upColor: 'transparent', downColor: 'transparent', noChangeColor: 'transparent' }]
                  },
                  xAxis: { show: false },
                  yAxis: { show: false },
                  separator: { size: 0, color: 'transparent', fill: false },
                  crosshair: { show: false }
                };
                try { if (chart && typeof chart.setStyles === 'function') { chart.setStyles(styleCfg); } } catch(e) {}
                try { if (chart && typeof chart.setStyleOptions === 'function') { chart.setStyleOptions(styleCfg); } } catch(e) {}
                // Attempt to remove common indicators like EMA/MA/VOL on all panes
                try {
                  var names = ['EMA', 'MA', 'VOL', 'VOLUME', 'VOL(Volume)'];
                  if (typeof chart.removeIndicator === 'function') {
                    names.forEach(function(n){ try { chart.removeIndicator('candle_pane', n); } catch(_) {} });
                    try { var panes = (typeof chart.getPaneIds === 'function') ? chart.getPaneIds() : []; } catch(_) { panes = []; }
                    if (Array.isArray(panes)) {
                      panes.forEach(function(pid){ names.forEach(function(n){ try { chart.removeIndicator(pid, n); } catch(_) {} }); });
                    }
                  }
                  if (chart.chart && typeof chart.chart.removeIndicator === 'function') {
                    names.forEach(function(n){ try { chart.chart.removeIndicator('candle_pane', n); } catch(_) {} });
                  }
                } catch(_) {}
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
        function init(){ if (!create()) { var tries = 0; var t = setInterval(function(){ tries++; if (create() || tries>50) clearInterval(t); }, 100); } }
        if (document.readyState === 'complete' || document.readyState === 'interactive') { init(); } else { document.addEventListener('DOMContentLoaded', init); }
      })();
    </script>
  </body>
</html>`;
  }, [height, locale, market, period, polygonApiKey, symbol, theme]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
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
