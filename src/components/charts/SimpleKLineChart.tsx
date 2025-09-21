import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  theme?: "dark" | "light";
  chartType?:
    | "candle"
    | "line"
    | "area"
    | "bar"
    | "candle_solid"
    | "candle_stroke"
    | "candle_up_stroke"
    | "candle_down_stroke"
    | "ohlc";
  tooltipRule?: "always" | "follow_cross" | "none";
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
  mockRealtime?: boolean;
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
  onChartBridge?: (bridge: {
    updateTimeframe: (timeframe: string) => void;
    updateChartType: (chartType: string) => void;
    updateIndicators: (indicators: IndicatorConfig[]) => void;
    updateDisplayOptions: (options: any) => void;
    updateTheme: (theme: string) => void;
    updateAlerts: (alerts: any[]) => void;
    updateLevels: (levels: any) => void;
  }) => void;
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
  onChartReady?: () => void;
  onDataApplied?: () => void;
  etOffsetMinutes?: number; // Polygon server ET offset from UTC (e.g., -240 or -300)
  serverOffsetMs?: number; // Polygon serverTimeMs - Date.now()
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
  tooltipRule = "always",
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
  mockRealtime = true,
  levels,
  customBars,
  customData,
  indicators = [],
  onOverrideIndicator,
  onChartBridge,
  onAlertClick,
  alerts = [],
  onAlertSelected,
  onAlertMoved,
  onMeasureClick,
  onCrosshairClick,
  onChartReady,
  onDataApplied,
  etOffsetMinutes,
  serverOffsetMs,
}: Props) {
  const webRef = useRef<WebView>(null);
  const isReadyRef = useRef<boolean>(false);
  const [libCode, setLibCode] = useState<string | null>(null);

  // Create stable initial alerts reference seeded with current alerts
  const initialAlertsRef = useRef<typeof alerts>(alerts);
  useEffect(() => {
    // Only update initial alerts when symbol changes (for HTML generation)
    initialAlertsRef.current = alerts;
  }, [symbol]);

  // Bridge methods to update chart without re-rendering WebView
  const sendToWebView = useCallback((message: any) => {
    if (webRef.current && isReadyRef.current) {
      webRef.current.postMessage(JSON.stringify(message));
    }
  }, []);

  const updateTimeframe = useCallback(
    (newTimeframe: string) => {
      sendToWebView({ type: "updateTimeframe", timeframe: newTimeframe });
    },
    [sendToWebView]
  );

  const updateChartType = useCallback(
    (newChartType: string) => {
      sendToWebView({ type: "updateChartType", chartType: newChartType });
    },
    [sendToWebView]
  );

  const updateIndicators = useCallback(
    (newIndicators: IndicatorConfig[]) => {
      sendToWebView({ type: "updateIndicators", indicators: newIndicators });
    },
    [sendToWebView]
  );

  const updateDisplayOptions = useCallback(
    (options: any) => {
      sendToWebView({ type: "updateDisplayOptions", options });
    },
    [sendToWebView]
  );

  const updateTheme = useCallback(
    (newTheme: string) => {
      sendToWebView({ type: "updateTheme", theme: newTheme });
    },
    [sendToWebView]
  );

  const updateAlerts = useCallback(
    (newAlerts: any[]) => {
      sendToWebView({ type: "updateAlerts", alerts: newAlerts });
    },
    [sendToWebView]
  );

  const updateLevels = useCallback(
    (newLevels: any) => {
      sendToWebView({ type: "updateLevels", levels: newLevels });
    },
    [sendToWebView]
  );

  // Expose bridge methods to parent component
  useEffect(() => {
    if (onChartBridge) {
      onChartBridge({
        updateTimeframe,
        updateChartType,
        updateIndicators,
        updateDisplayOptions,
        updateTheme,
        updateAlerts,
        updateLevels,
      });
    }
  }, [
    onChartBridge,
    updateTimeframe,
    updateChartType,
    updateIndicators,
    updateDisplayOptions,
    updateTheme,
    updateAlerts,
    updateLevels,
  ]);

  // Handle timeframe changes via bridge after initial load and immediately re-apply alerts/levels
  useEffect(() => {
    if (isReadyRef.current) {
      updateTimeframe(timeframe);
      // Ensure alerts/levels are promptly re-applied on TF change for instant visibility
      try {
        if (alerts) updateAlerts(alerts);
        if (levels) updateLevels(levels);
      } catch (_) {}
    }
  }, [timeframe, updateTimeframe]);

  // Handle chart type changes via bridge after initial load
  useEffect(() => {
    if (isReadyRef.current) {
      updateChartType(chartType);
    }
  }, [chartType, updateChartType]);

  // Handle theme changes via bridge after initial load
  useEffect(() => {
    if (isReadyRef.current) {
      updateTheme(theme);
    }
  }, [theme, updateTheme]);

  // Handle indicators changes via bridge after initial load
  useEffect(() => {
    if (isReadyRef.current) {
      updateIndicators(indicators);
    }
  }, [indicators, updateIndicators]);

  // Handle display options changes via bridge after initial load
  useEffect(() => {
    if (isReadyRef.current) {
      updateDisplayOptions({ showSessions, tooltipRule });
    }
  }, [showSessions, tooltipRule, updateDisplayOptions]);

  // Handle alerts changes via bridge after initial load
  useEffect(() => {
    if (isReadyRef.current) {
      updateAlerts(alerts);
    }
  }, [alerts, updateAlerts]);

  // Handle levels changes via bridge after initial load
  useEffect(() => {
    if (isReadyRef.current) {
      updateLevels(levels);
    }
  }, [levels, updateLevels]);

  // Load klinecharts library from bundled asset (with CDN fallback)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const mod = require("../../../assets/web/klinecharts.min.txt");
        const asset = Asset.fromModule(mod);
        if (!asset.downloaded) {
          await asset.downloadAsync();
        }
        const uri = asset.localUri || asset.uri;
        if (uri) {
          try {
            const text = await FileSystem.readAsStringAsync(uri, {
              encoding: "utf8",
            });
            if (isMounted && text && text.trim().length > 0) {
              setLibCode(text);
              return;
            }
          } catch (_) {
            // If FileSystem read fails, try fetch as a fallback (mainly web)
            try {
              const res = await fetch(uri);
              const text = await res.text();
              if (isMounted && text && text.trim().length > 0) {
                setLibCode(text);
                return;
              }
            } catch (_) {}
          }
        }
      } catch (_) {
        // ignore and fallback to CDN
      }
      if (isMounted) setLibCode(null);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const polygonApiKey: string | undefined = (Constants.expoConfig?.extra as any)
    ?.polygonApiKey;
  const realtimeProvider: string | undefined = (
    Constants.expoConfig?.extra as any
  )?.realtimeProvider;

  const html = useMemo(() => {
    const safeSymbol = (symbol || "AAPL").toUpperCase();
    const ct = chartType;
    const showYAxisText =
      typeof showPriceAxisText === "boolean" ? showPriceAxisText : true;
    const showXAxisText =
      typeof showTimeAxisText === "boolean" ? showTimeAxisText : true;

    // Prefer local asset script; fallback to CDN
    const libraryTag = (() => {
      try {
        if (libCode && libCode.trim().length > 0) {
          const safe = libCode
            .replace(/<\\\/?script>/gi, (m) => m.replace("/", "\\/"))
            .replace(/<\/(script)>/gi, "<\\/$1>");
          return `<script>\n${safe}\n</script>`;
        }
      } catch (_) {}
      return '<script src="https://unpkg.com/klinecharts@10.0.0-alpha9/dist/umd/klinecharts.min.js"></script>';
    })();

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

      /* Make the alert button circular and match the alert line color */
      #btn-alert {
        background: #F59E0B;
        color: #FFFFFF;
        border-radius: 50%;
      }
      #btn-alert:hover { background: #F59E0B; }
      #btn-alert:active { background: #F59E0B; }

      #btn-measure {
        background: #10B981;
        color: #FFFFFF;
        border-radius: 50%;
      }
      #btn-measure:hover { background: #10B981; }
      #btn-measure:active { background: #10B981; }

      #btn-crosshair {
        background: #10B981;
        color: #FFFFFF;
        border-radius: 50%;
      }
      #btn-crosshair:hover { background: #10B981; }
      #btn-crosshair:active { background: #10B981; }

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
    ${libraryTag}
    <script>
      (function(){
        function post(msg){ try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch(e) {} }
        window.onerror = function(m, s, l, c, e){ post({ error: m || (e && e.message) || 'unknown' }); };

        // Enhanced message bridge for all chart operations
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
            } else if (data.type === 'updateTimeframe') {
              TF = data.timeframe;
              if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart) {
                try {
                  var period = mapPeriod(data.timeframe);
                  window.__SIMPLE_KLINE__.chart.setPeriod(period);
                  // Reapply alerts after timeframe change
                  if (window.__SIMPLE_KLINE__.applyAlerts && window.__SIMPLE_KLINE__.lastAlerts) {
                    window.__SIMPLE_KLINE__.applyAlerts(window.__SIMPLE_KLINE__.lastAlerts);
                  }
                  // Reapply session backgrounds after timeframe change
                  setTimeout(applySessionBackgrounds, 100);
                  post({ success: 'timeframe_updated', timeframe: data.timeframe });
                  // Re-subscribe live Polygon stream with the new timeframe if active
                  try { if (window.__SIMPLE_KLINE__ && typeof window.__SIMPLE_KLINE__.resubscribeLive === 'function') { window.__SIMPLE_KLINE__.resubscribeLive(); } } catch(_){}
                } catch(e) {
                  post({ error: 'timeframe_update_failed', message: String(e && e.message || e) });
                }
              } else {
                post({ error: 'chart_not_ready_for_timeframe_update', hasSimpleKline: !!window.__SIMPLE_KLINE__, hasChart: !!(window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart) });
              }
            } else if (data.type === 'updateChartType') {
              CHART_TYPE = data.chartType;
              if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart) {
                try {
                  applyChartType(window.__SIMPLE_KLINE__.chart, data.chartType);
                  post({ success: 'chart_type_updated', chartType: data.chartType });
                } catch(e) {
                  post({ error: 'chart_type_update_failed', message: String(e && e.message || e) });
                }
              }
            } else if (data.type === 'updateIndicators') {
              INDICATORS = data.indicators || [];
              if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart) {
                try {
                  // Prefer the internal helper which targets overlay indicators to the main candle pane
                  if (window.__SIMPLE_KLINE__.setIndicators) {
                    window.__SIMPLE_KLINE__.setIndicators(INDICATORS);
                  } else {
                    // Fallback: clear and add with candle pane targeting for overlays
                    try {
                      var existingIndicators = window.__SIMPLE_KLINE__.chart.getIndicators() || [];
                      existingIndicators.forEach(function(ind) {
                        try { window.__SIMPLE_KLINE__.chart.removeIndicator(ind.name || ind.id); } catch(_) {}
                      });
                    } catch(_) {}

                    var overlayCompat = ['BBI','BOLL','EMA','MA','SAR','SMA'];
                    INDICATORS.forEach(function(indicator) {
                      try {
                        var nm = String(indicator && indicator.name || '').toUpperCase();
                        var wantsOverlay = !!(indicator && indicator.overlay) || overlayCompat.indexOf(nm) >= 0;
                        var opts = {};
                        if (indicator && indicator.calcParams) opts.calcParams = indicator.calcParams;
                        if (indicator && indicator.styles) opts.styles = indicator.styles;
                        if (wantsOverlay) opts.id = 'candle_pane';
                        if (typeof window.__SIMPLE_KLINE__.chart.createIndicator === 'function') {
                          window.__SIMPLE_KLINE__.chart.createIndicator(nm, false, opts);
                        }
                      } catch(e) {
                        post({ warn: 'indicator_add_failed', indicator: indicator && indicator.name, message: String(e && e.message || e) });
                      }
                    });
                  }
                  post({ success: 'indicators_updated', count: INDICATORS.length });
                } catch(e) {
                  post({ error: 'indicators_update_failed', message: String(e && e.message || e) });
                }
              } else {
                post({ error: 'indicators_chart_not_available', hasSimpleKline: !!window.__SIMPLE_KLINE__, hasChart: !!(window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart) });
              }
            } else if (data.type === 'updateDisplayOptions') {
              var options = data.options || {};
              if (typeof options.showVolume === 'boolean') SHOW_VOL = options.showVolume;
              if (typeof options.showMA === 'boolean') SHOW_MA = options.showMA;
              if (typeof options.showGrid === 'boolean') SHOW_GRID = options.showGrid;
              if (typeof options.showSessions === 'boolean') SHOW_SESSIONS = options.showSessions;
              if (typeof options.tooltipRule === 'string') TOOLTIP_RULE = options.tooltipRule;
              
              if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart) {
                try {
                  // Update chart styles based on new options
                  applyChartType(window.__SIMPLE_KLINE__.chart, CHART_TYPE);
                  // Reapply session backgrounds when showSessions option changes
                  setTimeout(applySessionBackgrounds, 100);
                  post({ success: 'display_options_updated', options: options });
                } catch(e) {
                  post({ error: 'display_options_update_failed', message: String(e && e.message || e) });
                }
              }
            } else if (data.type === 'updateTheme') {
              THEME = data.theme;
              if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart) {
                try {
                  // Update chart theme
                  applyChartType(window.__SIMPLE_KLINE__.chart, CHART_TYPE);
                  post({ success: 'theme_updated', theme: data.theme });
                } catch(e) {
                  post({ error: 'theme_update_failed', message: String(e && e.message || e) });
                }
              }
            } else if (data.type === 'updateAlerts') {
              ALERTS = data.alerts || [];
              if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.applyAlerts && window.__SIMPLE_KLINE__.chart) {
                try {
                  window.__SIMPLE_KLINE__.applyAlerts(ALERTS);
                  post({ success: 'alerts_updated', count: ALERTS.length });
                } catch(e) {
                  post({ error: 'alerts_update_failed', message: String(e && e.message || e) });
                }
              } else {
                post({ error: 'applyAlerts_not_available', hasSimpleKline: !!window.__SIMPLE_KLINE__, hasApplyAlerts: !!(window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.applyAlerts), hasChart: !!(window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart) });
              }
            } else if (data.type === 'updateLevels') {
              LEVELS = data.levels || {};
              if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.applyLevels && window.__SIMPLE_KLINE__.chart) {
                try {
                  window.__SIMPLE_KLINE__.applyLevels(LEVELS);
                  post({ success: 'levels_updated' });
                } catch(e) {
                  post({ error: 'levels_update_failed', message: String(e && e.message || e) });
                }
              } else {
                post({ error: 'applyLevels_not_available', hasSimpleKline: !!window.__SIMPLE_KLINE__, hasApplyLevels: !!(window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.applyLevels), hasChart: !!(window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart) });
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
        var ALERTS = ${JSON.stringify(initialAlertsRef.current || [])};
        var POLY_API_KEY = ${JSON.stringify(polygonApiKey || "")};
        var REALTIME_PROVIDER = ${JSON.stringify(
          realtimeProvider || "polygon"
        )};
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
        var THEME = ${JSON.stringify(theme)};
        var MOCK_REALTIME = ${JSON.stringify(mockRealtime)};
        var TOOLTIP_RULE = ${JSON.stringify(tooltipRule)};
        var ET_OFFSET_MINUTES = ${JSON.stringify(
          typeof etOffsetMinutes === "number" ? etOffsetMinutes : null
        )};
        var SERVER_OFFSET_MS = ${JSON.stringify(
          typeof serverOffsetMs === "number" ? serverOffsetMs : 0
        )};

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
            var SUPPORTED_TYPES = ['candle_solid','candle_stroke','candle_up_stroke','candle_down_stroke','ohlc','area'];
            var type;
            if (t === 'candlestick' || t === 'candle') {
              type = 'candle_solid';
            } else if (t === 'bar') {
              type = 'ohlc';
            } else if (SUPPORTED_TYPES.indexOf(t) >= 0) {
              type = t;
            } else if (t === 'line') {
              // map "line" to area rendering for now
              type = 'area';
            } else {
              type = 'candle_solid';
            }
            var opts = {
              candle: {
                type: type,
                tooltip: { showRule: (TOOLTIP_RULE || 'follow_cross') },
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
            // Apply indicator tooltip rule to all panes if API exists
            try {
              var rule = (TOOLTIP_RULE || 'follow_cross');
              opts.indicator = opts.indicator || {};
              opts.indicator.tooltip = { showRule: rule };
            } catch(_) {}
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
                  var showArrows = !!extendData.dragHintArrows;
                  var figs = [
                    { type: 'line', attrs: { coordinates: [ { x: 0, y: point.y }, { x: 9999, y: point.y } ] }, styles: { color: color, size: 1, style: 'dashed', dashedValue: [10, 6] } }
                  ];
                  if (showArrows) {
                    figs.push(
                      { type: 'text', attrs: { x: 6, y: point.y - 2, text: '\u25B2', baseline: 'bottom', align: 'left' }, styles: { color: '#C7CDD7', size: 8, backgroundColor: 'transparent' } },
                      { type: 'text', attrs: { x: 6, y: point.y + 2, text: '\u25BC', baseline: 'top', align: 'left' }, styles: { color: '#C7CDD7', size: 8, backgroundColor: 'transparent' } }
                    );
                  } else {
                    // Alert icon centered on the line with circular background matching the line color
                    figs.push({ type: 'text', attrs: { x: 8, y: point.y, text: '\uE7F4', baseline: 'middle', align: 'left' }, styles: { color: '#FFFFFF', family: 'Material Icons', size: 12, backgroundColor: color, borderColor: color, borderSize: 1, borderRadius: 999, paddingLeft: 3, paddingRight: 3, paddingTop: 3, paddingBottom: 3 } });
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

            // Note: setDataLoader must be configured before triggering getBars via setSymbol/setPeriod.

            function genData(ts, length, stepMs){
              try {
                var now = (typeof ts === 'number' ? ts : Date.now());
                var p = mapPeriod(TF);
                var step = (typeof stepMs === 'number' && stepMs > 0) ? stepMs : periodToMs(p);
                var basePrice = 5000;
                var start = Math.floor(now / step) * step - (length * step);
                var list = [];
                for (var i = 0; i < length; i++) {
                  var prices = [];
                  for (var j = 0; j < 4; j++) { prices.push(basePrice + Math.random() * 60 - 30); }
                  prices.sort(function(a,b){ return a - b; });
                  var open = Number(prices[Math.round(Math.random() * 3)].toFixed(2));
                  var high = Number(prices[3].toFixed(2));
                  var low = Number(prices[0].toFixed(2));
                  var close = Number(prices[Math.round(Math.random() * 3)].toFixed(2));
                  var volume = Math.round(Math.random() * 100) + 10;
                  var turnover = (open + high + low + close) / 4 * volume;
                  list.push({ timestamp: start, open: open, high: high, low: low, close: close, volume: volume, turnover: turnover });
                  basePrice = close;
                  start += step;
                }
                return list;
              } catch(_) { return []; }
            }

            // After data loader is configured, trigger initial data load and subscription.
            try { if (typeof chart.setSymbol === 'function') { chart.setSymbol({ ticker: SYMBOL }); } } catch(_){ }
            try { if (typeof chart.setPeriod === 'function') { chart.setPeriod(mapPeriod(TF)); } } catch(_){ }

            var hasCustom = (Array.isArray(CUSTOM_BARS) && CUSTOM_BARS.length > 0) || (Array.isArray(CUSTOM_DATA) && CUSTOM_DATA.length > 0);
            if (hasCustom) {
              try {
                var bars = (Array.isArray(CUSTOM_BARS) && CUSTOM_BARS.length > 0) ? CUSTOM_BARS : CUSTOM_DATA;
                try { bars = bars.slice().sort(function(a,b){ return (a.timestamp||0) - (b.timestamp||0); }); } catch(_){ }
                var applied = false;
                try {
                  if (chart && typeof chart.setDataLoader === 'function') {
                    chart.setDataLoader({
                      getBars: function(ctx){
                        try {
                          var cb = ctx && ctx.callback ? ctx.callback : function(){};
                          cb(bars);
                          try { post({ type: 'dataApplied' }); } catch(_){ }
                        } catch (e4) { post({ error: 'custom_loader_callback_failed', message: String(e4 && e4.message || e4) }); }
                      },
                      subscribeBar: function(params){},
                      unsubscribeBar: function(params){},
                      // backward compatibility if library accepts these keys
                      subscribe: function(params){},
                      unsubscribe: function(params){}
                    });
                    // Ensure loader is active by (re)setting symbol/period AFTER loader assignment
                    try { if (typeof chart.setSymbol === 'function') { chart.setSymbol({ ticker: SYMBOL }); } } catch(_){ }
                    try { if (typeof chart.setPeriod === 'function') { chart.setPeriod(mapPeriod(TF)); } } catch(_){ }
                    applied = true;
                  }
                } catch(_){ }
                if (!applied) {
                  try { if (chart && typeof chart.setData === 'function') { chart.setData(bars); applied = true; try { post({ type: 'dataApplied' }); } catch(_){ } } } catch(_){ }
                }
                if (!applied) { post({ error: 'apply_custom_failed', message: 'No supported API to set data' }); }
              } catch(e) { post({ error: 'apply_custom_failed', message: String(e && e.message || e) }); }
              setTimeout(applySessionBackgrounds, 0);
            } else {
              if (typeof chart.setDataLoader === 'function') {
                if (MOCK_REALTIME) {
                  // Mock realtime via generator
                  var mockBars = genData(Date.now(), 800);
                  if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                  window.__SIMPLE_KLINE__.mockBars = mockBars.slice();
                  window.__SIMPLE_KLINE__.mockTimer = null;
                  chart.setDataLoader({
                    getBars: function(ctx){
                      try {
                        var callback = ctx && ctx.callback ? ctx.callback : function(){};
                        callback(window.__SIMPLE_KLINE__.mockBars || []);
                        try { post({ type: 'dataApplied' }); } catch(_){ }
                        setTimeout(applySessionBackgrounds, 0);
                      } catch (e) { post({ error: 'mock_getBars_failed', message: String(e && e.message || e) }); }
                    },
                    subscribeBar: function(params){
                      try {
                        var step = periodToMs(mapPeriod(TF));
                        if (window.__SIMPLE_KLINE__.mockTimer) { try { clearInterval(window.__SIMPLE_KLINE__.mockTimer); } catch(_){} }
                        function deliver(bar){
                          try {
                            if (params && typeof params.callback === 'function') { params.callback(bar); return; }
                            if (params && typeof params.onData === 'function') { params.onData(bar); return; }
                            if (params && typeof params.emit === 'function') { params.emit(bar); return; }
                          } catch(_) {}
                        }
                        window.__SIMPLE_KLINE__.mockTimer = setInterval(function(){
                          try {
                            var list = window.__SIMPLE_KLINE__.mockBars || [];
                            if (!Array.isArray(list) || list.length === 0) return;
                            var last = list[list.length - 1];
                            var now = Date.now();
                            var needNew = (now - Number(last.timestamp || 0)) >= step;
                            if (needNew) {
                              // create new bar based on last close
                              var basePrice = Number(last.close || last.open || 5000);
                              var prices = [];
                              for (var j = 0; j < 4; j++) { prices.push(basePrice + Math.random() * 60 - 30); }
                              prices.sort(function(a,b){ return a - b; });
                              var open = Number(prices[Math.round(Math.random() * 3)].toFixed(2));
                              var high = Number(prices[3].toFixed(2));
                              var low = Number(prices[0].toFixed(2));
                              var close = Number(prices[Math.round(Math.random() * 3)].toFixed(2));
                              var volume = Math.round(Math.random() * 100) + 10;
                              var turnover = (open + high + low + close) / 4 * volume;
                              var nb = { timestamp: Math.floor(now / step) * step, open: open, high: high, low: low, close: close, volume: volume, turnover: turnover };
                              list.push(nb);
                              deliver(nb);
                            } else {
                              // update last bar
                              var delta = (Math.random() * 20 - 10);
                              last.close = Number((last.close + delta).toFixed(2));
                              last.high = Math.max(last.high, last.close);
                              last.low = Math.min(last.low, last.close);
                              last.volume = Number((last.volume + Math.round(Math.random() * 10)).toFixed(0));
                              last.turnover = Number(((last.open + last.high + last.low + last.close) / 4 * last.volume).toFixed(2));
                              deliver(Object.assign({}, last));
                            }
                          } catch(_){ }
                        }, 600);
                      } catch(e) { post({ error: 'mock_subscribe_failed', message: String(e && e.message || e) }); }
                    },
                    unsubscribeBar: function(params){
                      try { if (window.__SIMPLE_KLINE__.mockTimer) { clearInterval(window.__SIMPLE_KLINE__.mockTimer); window.__SIMPLE_KLINE__.mockTimer = null; } } catch(_){ }
                    },
                    // backward compatibility if library accepts these keys
                    subscribe: function(params){ return this.subscribeBar && this.subscribeBar(params); },
                    unsubscribe: function(params){ return this.unsubscribeBar && this.unsubscribeBar(params); }
                  });
                  // Ensure loader is active by (re)setting symbol/period AFTER loader assignment
                  try { if (typeof chart.setSymbol === 'function') { chart.setSymbol({ ticker: SYMBOL }); } } catch(_){ }
                  try { if (typeof chart.setPeriod === 'function') { chart.setPeriod(mapPeriod(TF)); } } catch(_){ }
                } else {
                  // Live data via Polygon
                  chart.setDataLoader({
                    getBars: function(ctx){
                      try {
                        var callback = ctx && ctx.callback ? ctx.callback : function(){};
                        var p = mapPeriod(TF);
                        var to = Date.now() + (Number(SERVER_OFFSET_MS) || 0);
                        var from = to - 500 * periodToMs(p);
                        if (!POLY_API_KEY) { post({ warn: 'Missing Polygon API key' }); callback([]); setTimeout(applySessionBackgrounds, 0); return; }
                        var url = 'https://api.polygon.io/v2/aggs/ticker/' + encodeURIComponent(SYMBOL) + '/range/' + p.span + '/' + p.type + '/' + from + '/' + to + '?adjusted=true&sort=asc&limit=50000&apiKey=' + encodeURIComponent(POLY_API_KEY);
                        fetch(url)
                          .then(function(res){ return res.json(); })
                          .then(function(result){
                            var list = (result && result.results) || [];
                            var out = list.map(function(d){ return { timestamp: d.t, open: d.o, high: d.h, low: d.l, close: d.c, volume: d.v, turnover: d.vw }; });
                            callback(out);
                            try { post({ type: 'dataApplied' }); } catch(_){ }
                            setTimeout(applySessionBackgrounds, 0);
                          })
                          .catch(function(err){ post({ error: 'polygon_load_failed', message: String(err && err.message || err) }); callback([]); setTimeout(applySessionBackgrounds, 0); });
                      } catch (e) { post({ error: 'getBars_failed', message: String(e && e.message || e) }); }
                    },
                    subscribeBar: function(params){
                      try {
                        if (!POLY_API_KEY) { post({ warn: 'Missing Polygon API key for realtime' }); return; }
                        if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                        // Clean up any existing ws
                        try { if (window.__SIMPLE_KLINE__.polyWS) { window.__SIMPLE_KLINE__.polyWS.close(); } } catch(_){ }

                        var p = mapPeriod(TF);
                        var step = periodToMs(p);

                        function deliver(bar){
                          try {
                            if (params && typeof params.callback === 'function') { params.callback(bar); return; }
                            if (params && typeof params.onData === 'function') { params.onData(bar); return; }
                            if (params && typeof params.emit === 'function') { params.emit(bar); return; }
                          } catch(_){}
                        }

                        function align(ts){ try { return Math.floor(Number(ts) / step) * step; } catch(_) { return Number(ts) || Date.now(); } }

                        var lastBar = null;
                        function upsertFromAggregate(msg){
                          try {
                            var ts = (msg && (msg.t != null ? msg.t : (msg.s != null ? msg.s : msg.e)));
                            var t = align(ts);
                            var vwap = (msg && (msg.vw != null ? msg.vw : msg.a));
                            var bar = { timestamp: t, open: Number(msg.o), high: Number(msg.h), low: Number(msg.l), close: Number(msg.c), volume: Number(msg.v), turnover: Number(vwap || 0) };
                            lastBar = bar;
                            deliver(bar);
                          } catch(_){}
                        }

                        function updateFromTrade(msg){
                          try {
                            var price = Number(msg.p);
                            var ts = (msg && (msg.t != null ? msg.t : (msg.s != null ? msg.s : msg.e))) || Date.now();
                            var t = align(ts);
                            if (!lastBar || lastBar.timestamp !== t) {
                              // start a new bar using last known close as open if available
                              var openPrice = (lastBar && typeof lastBar.close === 'number') ? Number(lastBar.close) : price;
                              lastBar = { timestamp: t, open: openPrice, high: price, low: price, close: price, volume: 1, turnover: price };
                            } else {
                              lastBar.close = price;
                              lastBar.high = Math.max(lastBar.high, price);
                              lastBar.low = Math.min(lastBar.low, price);
                              lastBar.volume = Number((Number(lastBar.volume || 0) + 1).toFixed(0));
                              lastBar.turnover = Number(((Number(lastBar.turnover || 0)) + price).toFixed(2));
                            }
                            deliver(Object.assign({}, lastBar));
                          } catch(_){}
                        }

                        function getAggChannel(){
                          try {
                            var t = (p && p.type) || 'minute';
                            if (t === 'minute') return 'AM.' + SYMBOL;
                            if (t === 'hour') return 'AH.' + SYMBOL;
                            if (t === 'day' || t === 'week' || t === 'month' || t === 'year') return 'AD.' + SYMBOL;
                            return 'AM.' + SYMBOL;
                          } catch(_) { return 'AM.' + SYMBOL; }
                        }

                        var hosts = ['wss://socket.polygon.io/stocks', 'wss://delayed.polygon.io/stocks'];
                        var hostIndex = (String(REALTIME_PROVIDER || '').toLowerCase().includes('delayed') ? 1 : 0);
                        var ws = null;
                        var dataTimer = null;
                        var dataTimeoutMs = 12000;
                        function clearDataTimer(){ try { if (dataTimer) { clearTimeout(dataTimer); dataTimer = null; } } catch(_){} }
                        function startDataTimer(){
                          clearDataTimer();
                          dataTimer = setTimeout(function(){
                            try {
                              // No data received shortly after subscribe; fallback to delayed if not already
                              if (hostIndex === 0) { try { switchToHost(1); } catch(_){} }
                            } catch(_){}
                          }, dataTimeoutMs);
                        }

                        function switchToHost(index){
                          try {
                            hostIndex = index;
                            try { if (ws && ws.readyState <= 1) ws.close(); } catch(_){}
                          } catch(_){}
                          openSocket();
                        }

                        function openSocket(){
                          try {
                            var host = hosts[Math.max(0, Math.min(hostIndex, hosts.length - 1))];
                            ws = new WebSocket(host);
                            window.__SIMPLE_KLINE__.polyWS = ws;
                            window.__SIMPLE_KLINE__.polyWSHost = host;
                            window.__SIMPLE_KLINE__.liveParams = params;
                            window.__SIMPLE_KLINE__.liveSymbol = SYMBOL;
                          } catch(_){}

                          if (!ws) return;

                          ws.onopen = function(){
                            try { ws.send(JSON.stringify({ action: 'auth', params: POLY_API_KEY })); } catch(_){}
                          };

                          ws.onmessage = function(ev){
                            try {
                              var payload = null;
                              try { payload = JSON.parse(ev.data); } catch(_) { payload = ev && ev.data ? [ev.data] : []; }
                              var msgs = Array.isArray(payload) ? payload : [payload];
                              for (var i = 0; i < msgs.length; i++) {
                                var m = msgs[i] || {};
                                var evName = m.ev || m.event;
                                if (evName === 'status') {
                                  if (m.status === 'auth_success' || m.message === 'authenticated') {
                                    try {
                                      // Subscribe to trades, second-level aggregates, and timeframe aggregate
                                      var agg = getAggChannel();
                                      var chans = ['T.' + SYMBOL, 'A.' + SYMBOL, agg];
                                      try { ws.send(JSON.stringify({ action: 'subscribe', params: chans.join(',') })); } catch(_){}
                                      try { post({ info: 'ws_subscribed', host: (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.polyWSHost) || 'unknown', channels: chans }); } catch(_){ }
                                      startDataTimer();
                                    } catch(_){}
                                  } else if ((m.status && String(m.status).includes('auth')) || (m.message && String(m.message).toLowerCase().includes('auth'))) {
                                    // Auth failed, try delayed host
                                    if (hostIndex === 0) { try { switchToHost(1); return; } catch(_){} }
                                  }
                                  continue;
                                }
                                if (evName === 'AM' || evName === 'AH' || evName === 'AD' || evName === 'A') { clearDataTimer(); upsertFromAggregate(m); continue; }
                                if (evName === 'T') { clearDataTimer(); updateFromTrade(m); continue; }
                              }
                            } catch(_){}
                          };

                          ws.onerror = function(){ /* noop */ };
                          ws.onclose = function(){ try { window.__SIMPLE_KLINE__.polyWS = null; clearDataTimer(); } catch(_){} };
                        }

                        openSocket();

                        // expose resubscribe helper
                        window.__SIMPLE_KLINE__.resubscribeLive = function(){
                          try {
                            p = mapPeriod(TF);
                            step = periodToMs(p);
                            lastBar = null;
                            clearDataTimer();
                            try { if (ws && ws.readyState <= 1) { ws.close(); } } catch(_){}
                            setTimeout(function(){ openSocket(); }, 200);
                          } catch(_){}
                        };
                      } catch(e) { post({ error: 'subscribeBar_failed', message: String(e && e.message || e) }); }
                    },
                    unsubscribeBar: function(params){
                      try {
                        if (window.__SIMPLE_KLINE__) {
                          try { if (window.__SIMPLE_KLINE__.polyWS) { try { window.__SIMPLE_KLINE__.polyWS.close(); } catch(_){} } } catch(_){}
                          window.__SIMPLE_KLINE__.polyWS = null;
                        }
                        try { if (dataTimer) { clearTimeout(dataTimer); dataTimer = null; } } catch(_){}
                      } catch(_){ }
                    },
                    // backward compatibility if library accepts these keys
                    subscribe: function(params){ return this.subscribeBar && this.subscribeBar(params); },
                    unsubscribe: function(params){ return this.unsubscribeBar && this.unsubscribeBar(params); }
                  });
                  // Ensure loader is active by (re)setting symbol/period AFTER loader assignment
                  try { if (typeof chart.setSymbol === 'function') { chart.setSymbol({ ticker: SYMBOL }); } } catch(_){ }
                  try { if (typeof chart.setPeriod === 'function') { chart.setPeriod(mapPeriod(TF)); } } catch(_){ }
                }
              }
            }

            // Levels helpers
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

            function clearAlerts(){
              try {
                var chart = window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart;
                var ids = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.alertOverlayIds) || [];
                if (ids && ids.length && chart && typeof chart.removeOverlay === 'function') { ids.forEach(function(id){ try { chart.removeOverlay(id); } catch(_){} }); }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.alertOverlayIds = [];
              } catch(_){ }
            }

            function applyAlerts(alerts){
              try {
                clearAlerts();
                var chart = window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart;
                if (!alerts || !Array.isArray(alerts) || !chart) return;
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.lastAlerts = alerts.slice();
                var registry = [];
                var editId = (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.editModeAlertId) || null;
                alerts.forEach(function(alert, i) {
                  if (alert && typeof alert.price === 'number' && alert.isActive) {
                    var color = '#F59E0B';
                    var label = 'Alert ' + (i + 1);
                    var aid = String(alert.id || ('alert_' + (i + 1)));
                    var showArrows = editId != null && String(editId) === aid;
                    addPriceLine(alert.price, color, label, !!showArrows, true);
                    registry.push({ id: aid, price: Number(alert.price) });
                  }
                });
                window.__SIMPLE_KLINE__.alertsRegistry = registry;
              } catch(e){ post({ warn: 'applyAlerts failed', message: String(e && e.message || e) }); }
            }

            // Define applyLevels function (final implementation)
            function applyLevels(levels) {
              try {
                var chart = window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.chart;
                if (!levels || typeof levels !== 'object' || !chart) return;
                // Clear existing level overlays
                if (window.__SIMPLE_KLINE__ && window.__SIMPLE_KLINE__.levelOverlayIds) {
                  window.__SIMPLE_KLINE__.levelOverlayIds.forEach(function(id) {
                    try { chart.removeOverlay(id); } catch(_) {}
                  });
                }
                if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                window.__SIMPLE_KLINE__.levelOverlayIds = [];
                
                // Apply new levels
                var colors = {
                  entry: '#10B981',
                  lateEntry: '#059669', 
                  exit: '#EF4444',
                  lateExit: '#DC2626',
                  stop: '#F59E0B',
                  targets: '#8B5CF6'
                };
                
                Object.keys(levels).forEach(function(key) {
                  var value = levels[key];
                  if (Array.isArray(value)) {
                    // Handle arrays (like targets)
                    value.forEach(function(price, i) {
                      if (typeof price === 'number') {
                        var id = chart.createOverlay({
                          name: 'horizontalStraightLine',
                          lock: true,
                          points: [{ value: price }],
                          styles: { line: { color: colors[key] || '#6B7280', size: 1, style: 'dashed' } }
                        });
                        if (id) window.__SIMPLE_KLINE__.levelOverlayIds.push(id);
                      }
                    });
                  } else if (typeof value === 'number') {
                    // Handle single values
                    var id = chart.createOverlay({
                      name: 'horizontalStraightLine',
                      lock: true,
                      points: [{ value: value }],
                      styles: { line: { color: colors[key] || '#6B7280', size: 1, style: 'solid' } }
                    });
                    if (id) window.__SIMPLE_KLINE__.levelOverlayIds.push(id);
                  }
                });
              } catch(e) {
                post({ warn: 'applyLevels failed', message: String(e && e.message || e) });
              }
            }

            if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
            window.__SIMPLE_KLINE__.applyAlerts = applyAlerts;
            window.__SIMPLE_KLINE__.applyLevels = applyLevels;
            try { if (document.fonts && document.fonts.load) { document.fonts.load('16px "Material Icons"'); } } catch(_){ }

            // Apply initial alerts and levels snapshot passed from React Native
            try { applyAlerts(Array.isArray(ALERTS) ? ALERTS : []); } catch(_){ }
            try { applyLevels(LEVELS); } catch(_){ }
            try { if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function(){ try { applyAlerts(Array.isArray(ALERTS) ? ALERTS : []); applyLevels(LEVELS); } catch(_){ } }); } } catch(_){ }

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
                // Only apply on intraday timeframes
                var p = mapPeriod(TF);
                var typ = (p && p.type) || 'day';
                if (typ !== 'minute' && typ !== 'hour') return;

                var data = chart && typeof chart.getDataList === 'function' ? chart.getDataList() : [];
                if (!data || !data.length) return;
                var first = data[0];
                var last = data[data.length - 1];
                var startTs = Number(first.timestamp || first.time || 0);
                var endTs = Number(last.timestamp || last.time || 0);
                if (!startTs || !endTs) return;

                // Use dynamic ET offset if provided (minutes, e.g. -240/-300)
                var OFFSET_MIN = (typeof ET_OFFSET_MINUTES === 'number' && isFinite(ET_OFFSET_MINUTES)) ? ET_OFFSET_MINUTES : -300;
                var MIN = 60 * 1000;
                var HR = 60 * MIN;
                var DAY = 24 * HR;

                // Determine bucket size based on timeframe
                var stepMs = 0;
                if (p && p.type === 'minute') stepMs = Math.max(1, Number(p.span || 1)) * MIN;
                else if (p && p.type === 'hour') stepMs = Math.max(1, Number(p.span || 1)) * HR;
                if (!stepMs || !isFinite(stepMs)) stepMs = MIN; // fallback 1m

                function toEtEpoch(tsUtc){ return Number(tsUtc) + OFFSET_MIN * MIN; }
                function toUtcEpoch(tsEt){ return Number(tsEt) - OFFSET_MIN * MIN; }
                function etStartOfDay(tsUtc){ var etTs = toEtEpoch(tsUtc); return Math.floor(etTs / DAY) * DAY; }
                function ceilAfter(tsEt, step, anchor){
                  try {
                    var base = (typeof anchor === 'number') ? anchor : (Math.floor(tsEt / DAY) * DAY);
                    var off = (tsEt - base) % step;
                    if (off === 0) return tsEt + step; // strictly greater than tsEt
                    return tsEt + (step - off);
                  } catch(_) { return tsEt; }
                }

                var startDayEt = etStartOfDay(startTs);
                var endDayEt = etStartOfDay(endTs);
                var ids = [];

                for (var dayEt = startDayEt; dayEt <= endDayEt; dayEt += DAY) {
                  var preStartEt = dayEt + 4 * HR;
                  var regStartEt = dayEt + 9 * HR + 30 * MIN;
                  var regEndEt = dayEt + 16 * HR;
                  var afterEndEt = dayEt + 20 * HR;
                  var nextDayEt = dayEt + DAY;

                  // Extend regular close and after-hours end to next bucket boundary
                  var regEndEtExt = ceilAfter(regEndEt, stepMs, dayEt);
                  var afterEndEtExt = ceilAfter(afterEndEt, stepMs, dayEt);
                  if (afterEndEtExt > nextDayEt) afterEndEtExt = nextDayEt; // clamp to midnight to avoid overlap

                  var sessions = [
                    // midnight -> 4:00 ET (night)
                    { start: toUtcEpoch(dayEt),       end: toUtcEpoch(preStartEt),   color: 'rgba(100,100,100,0.1)' },
                    // 4:00 -> 9:30 ET (premarket)
                    { start: toUtcEpoch(preStartEt),  end: toUtcEpoch(regStartEt),   color: 'rgba(151, 151, 151, 0.1)' },
                    // 9:30 -> extended close (day; keep transparent)
                    { start: toUtcEpoch(regStartEt),  end: toUtcEpoch(regEndEtExt),  color: 'rgba(0, 0, 0, 0.0)' },
                    // extended close -> extended after-hours end (after hours; darker)
                    { start: toUtcEpoch(regEndEtExt), end: toUtcEpoch(afterEndEtExt), color: 'rgba(45, 45, 45, 0.18)' },
                    // extended after-hours end -> midnight (night)
                    { start: toUtcEpoch(afterEndEtExt), end: toUtcEpoch(nextDayEt),  color: 'rgba(100, 100, 100, 0.1)' }
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

            if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
            window.__SIMPLE_KLINE__.chart = chart; // Add chart reference for bridge operations
            window.__SIMPLE_KLINE__.setChartType = function(t){ try { applyChartType(chart, t); } catch(e) {} };
            window.__SIMPLE_KLINE__.setLevels = function(lvls){ try { applyLevels(lvls); } catch(_){} };
            window.__SIMPLE_KLINE__.setIndicators = function(list){ try { clearAllIndicators(); if (Array.isArray(list)) { list.forEach(function(ic){ createIndicatorSafe(ic); }); } } catch(e) { post({ warn: 'setIndicators failed', message: String(e && e.message || e) }); } };
            window.__SIMPLE_KLINE__.overrideIndicator = overrideIndicator;
            window.__SIMPLE_KLINE__.levelOverlayIds = window.__SIMPLE_KLINE__.levelOverlayIds || [];
            window.__SIMPLE_KLINE__.sessionOverlayIds = window.__SIMPLE_KLINE__.sessionOverlayIds || [];

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
                          var now = Date.now();
                          var lastTap = window.__SIMPLE_KLINE__.lastAlertTap || null;
                          var isDoubleTap = !!(lastTap && lastTap.id === best.id && (now - lastTap.time) < 350);

                          if (isDoubleTap) {
                            var currentEdit = window.__SIMPLE_KLINE__.editModeAlertId || null;
                            window.__SIMPLE_KLINE__.editModeAlertId = (currentEdit === best.id) ? null : best.id;
                            try { applyAlerts(window.__SIMPLE_KLINE__.lastAlerts || []); } catch(_){ }
                            window.__SIMPLE_KLINE__.lastDoubleTapTime = now;
                            // On double tap, toggle edit mode but do not start dragging in the same gesture
                          } else {
                            window.__SIMPLE_KLINE__.selectedAlertId = best.id;
                            try { applyAlerts(window.__SIMPLE_KLINE__.lastAlerts || []); } catch(_){ }
                            post({ type: 'alertSelected', id: best.id, price: best.price, y: best.y });
                            var allowDrag = (window.__SIMPLE_KLINE__.editModeAlertId === best.id) && (!(window.__SIMPLE_KLINE__.lastDoubleTapTime) || ((now - window.__SIMPLE_KLINE__.lastDoubleTapTime) > 250));
                            if (allowDrag) {
                              window.__SIMPLE_KLINE__.draggingAlert = { id: best.id, startY: y, price: best.price };
                              window.__SIMPLE_KLINE__.draggingCurrentPrice = best.price;
                            } else {
                              window.__SIMPLE_KLINE__.draggingAlert = null;
                            }
                          }
                          window.__SIMPLE_KLINE__.lastAlertTap = { id: best.id, time: now };
                        } else {
                          if (!window.__SIMPLE_KLINE__) window.__SIMPLE_KLINE__ = {};
                          window.__SIMPLE_KLINE__.selectedAlertId = null;
                          window.__SIMPLE_KLINE__.editModeAlertId = null;
                          window.__SIMPLE_KLINE__.draggingAlert = null;
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
    // timeframe removed - handled via bridge after initial load
    height,
    showPriceAxisText,
    showTimeAxisText,
    customBars,
    customData,
    // theme, chartType, indicatorsKey, showSessions, alertsKey, levels - handled via bridge after initial load
  ]);

  return (
    <View
      style={[
        styles.container,
        { height, backgroundColor: theme === "dark" ? "#0a0a0a" : "#ffffff" },
      ]}
    >
      <WebView
        ref={webRef}
        key={`chart-${symbol}`}
        originWhitelist={["*"]}
        source={{ html }}
        style={{
          height,
          width: "100%",
          backgroundColor: theme === "dark" ? "#0a0a0a" : "#ffffff",
        }}
        containerStyle={{
          backgroundColor: theme === "dark" ? "#0a0a0a" : "#ffffff",
        }}
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
              // Push current props immediately on ready to avoid waiting for state changes
              try {
                updateTimeframe(timeframe);
                updateChartType(chartType);
                updateTheme(theme);
                // Apply global display options before creating indicators to avoid style resets
                updateDisplayOptions({ showSessions });
                // Now add indicators so their custom styles persist
                updateIndicators(indicators);
                if (alerts) updateAlerts(alerts);
                if (levels) updateLevels(levels);
              } catch (_) {}
              if (onChartReady) {
                try {
                  onChartReady();
                } catch (_) {}
              }
            }
            if (data && data.type === "dataApplied") {
              // Data finished applying on the chart; ensure alerts/levels are applied immediately
              try {
                if (alerts) updateAlerts(alerts);
                if (levels) updateLevels(levels);
              } catch (_) {}
              if (onDataApplied) {
                try {
                  onDataApplied();
                } catch (_) {}
              }
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
