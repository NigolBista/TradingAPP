import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
} from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { realtimeRouter } from "../../services/realtimeRouter";

export type AmChartsDatum = {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type ChartType = "candlestick" | "area" | "line" | "bar";

type TradeSide = "long" | "short";

export type TradePlanOverlay = {
  side: TradeSide;
  entry?: number;
  lateEntry?: number; // optional secondary/late entry
  exit?: number;
  lateExit?: number; // optional secondary/late exit
  stop?: number;
  targets?: number[];
};

interface Props {
  data: AmChartsDatum[];
  height?: number;
  type?: ChartType;
  theme?: "light" | "dark";
  showVolume?: boolean;
  showMA?: boolean;
  maPeriods?: number[];
  showGrid?: boolean;
  showCrosshair?: boolean;
  // If provided, override chart up/down color choice
  forcePositive?: boolean;
  // Optional trade levels - used to render zones/lines
  levels?: {
    entry?: number;
    entryExtended?: number;
    exit?: number;
    exitExtended?: number;
  };
  // New: richer trade overlay input. If provided, takes precedence over `levels`.
  tradePlan?: TradePlanOverlay;
  // Control initial viewport positioning
  initialPosition?: "start" | "end" | "fit";
  // Notify RN when visible time range changes (ms)
  onVisibleRangeChange?: (range: { fromMs: number; toMs: number }) => void;
  // Infinite history callback: called when more data is needed
  onLoadMoreData?: (numberOfBars: number) => Promise<AmChartsDatum[]>;
  // Notify when the web chart is ready
  onReady?: () => void;
  // Real-time updates
  symbol?: string; // Symbol to subscribe for real-time updates
  timeframe?: string; // Timeframe for real-time candle aggregation
  enableRealtime?: boolean; // Enable real-time updates
}

export type AmChartsCandlesHandle = {
  scrollToRealTime: () => void;
  fitContent: () => void;
  resetView: () => void;
};

const AmChartsCandles = React.forwardRef<AmChartsCandlesHandle, Props>(
  function AmChartsCandles(
    {
      data,
      height = 320,
      type = "candlestick",
      theme = "light",
      showVolume = true,
      showMA = true,
      maPeriods = [20, 50],
      showGrid = true,
      showCrosshair = true,
      forcePositive,
      levels,
      tradePlan,
      initialPosition = "end",
      onVisibleRangeChange,
      onLoadMoreData,
      onReady,
      symbol,
      timeframe = "1m",
      enableRealtime = false,
    }: Props,
    ref
  ) {
    const webRef = useRef<WebView>(null);
    const [isReady, setIsReady] = useState(false);

    useImperativeHandle(ref, () => ({
      scrollToRealTime: () => {
        try {
          (webRef.current as any)?.postMessage?.(
            JSON.stringify({ cmd: "scrollToRealTime" })
          );
        } catch (_) {}
      },
      fitContent: () => {
        try {
          (webRef.current as any)?.postMessage?.(
            JSON.stringify({ cmd: "fitContent" })
          );
        } catch (_) {}
      },
      resetView: () => {
        try {
          (webRef.current as any)?.postMessage?.(
            JSON.stringify({ cmd: "resetView" })
          );
        } catch (_) {}
      },
    }));

    // Optimize series transformation with better memoization and validation
    const series = useMemo(() => {
      if (!data || data.length === 0) return [];

      // Pre-allocate array for better performance
      const result: any[] = [];
      for (let i = 0; i < data.length; i++) {
        const d = data[i];

        // Validate input data
        if (!d || typeof d.time !== "number" || d.time <= 0) {
          console.warn("Invalid candle data - skipping:", d);
          continue;
        }

        const processedCandle = {
          time: Math.floor(d.time / 1000),
          open: Number(d.open) || 0,
          high: Number(d.high) || 0,
          low: Number(d.low) || 0,
          close: Number(d.close) || 0,
          volume: Number(d.volume) || 0,
        };

        // Additional validation for OHLC consistency
        if (processedCandle.high < processedCandle.low) {
          console.warn(
            "🚫 Invalid OHLC data - high < low, skipping:",
            processedCandle
          );
          continue;
        }

        // Validate for reasonable price values
        const prices = [
          processedCandle.open,
          processedCandle.high,
          processedCandle.low,
          processedCandle.close,
        ];
        if (prices.some((p) => !Number.isFinite(p) || p <= 0)) {
          console.warn("🚫 Invalid price values, skipping:", processedCandle);
          continue;
        }

        // Check for extreme price ranges that might indicate bad data
        const priceRange = processedCandle.high - processedCandle.low;
        const avgPrice = (processedCandle.high + processedCandle.low) / 2;
        if (avgPrice > 0 && priceRange / avgPrice > 0.75) {
          console.warn(
            `🚫 Extreme price range detected, skipping:`,
            processedCandle,
            `(${((priceRange / avgPrice) * 100).toFixed(1)}% range)`
          );
          continue;
        }

        // Ensure open/close are within high/low range
        processedCandle.open = Math.max(
          processedCandle.low,
          Math.min(processedCandle.high, processedCandle.open)
        );
        processedCandle.close = Math.max(
          processedCandle.low,
          Math.min(processedCandle.high, processedCandle.close)
        );

        result.push(processedCandle);
      }

      // Ensure strictly increasing time order and remove duplicates
      result.sort((a, b) => a.time - b.time);

      // Remove duplicate timestamps, keeping the last occurrence
      const uniqueResult: any[] = [];
      for (let i = 0; i < result.length; i++) {
        const current = result[i];
        const next = result[i + 1];

        // If next candle has the same time, skip current (keep last occurrence)
        if (!next || current.time !== next.time) {
          uniqueResult.push(current);
        }
      }

      return uniqueResult;
    }, [data]);

    // Performance tracking refs
    const lastPushedTimeRef = useRef<number | null>(null);
    const lastSpacingRef = useRef<number | null>(null);
    const lastLengthRef = useRef<number>(0);
    const lastFirstTimeRef = useRef<number | null>(null);
    const lastUpdateTimeRef = useRef<number>(0);
    const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);

    const html = useMemo(
      () => `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <script src="https://cdn.amcharts.com/lib/5/index.js"></script>
    <script src="https://cdn.amcharts.com/lib/5/xy.js"></script>
    <script src="https://cdn.amcharts.com/lib/5/themes/Animated.js"></script>
    <script src="https://cdn.amcharts.com/lib/5/themes/Dark.js"></script>
    <script src="https://cdn.amcharts.com/lib/5/themes/Responsive.js"></script>
    <style>
      html,body,#wrap{margin:0;padding:0;height:100%;width:100%;background:transparent;overscroll-behavior:none;-webkit-text-size-adjust:100%;}
      body{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}
      #wrap{overflow:hidden;}
      #chartdiv{position:relative;height:100%;width:100%;overflow:hidden;}
      #tooltip{position:absolute;left:12px;top:12px;padding:8px 12px;border-radius:12px;font:13px -apple-system,Segoe UI,Roboto,Helvetica,Arial;background:rgba(17,24,39,.9);color:#ffffff;z-index:10;box-shadow:0 8px 25px rgba(0,0,0,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);display:none;}
    </style>
    </head><body>
    <div id="wrap">
      <div id="chartdiv">
        <div id="tooltip"></div>
      </div>
    </div>
    <script>
      const DEBUG = ${__DEV__ ? "true" : "false"};
      
      function log(msg) {
        try {
          if (DEBUG) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ debug: msg }));
          }
        } catch(e) {}
      }
      
      // Wait for amCharts to load
      function initChart() {
        try {
          log('Script started');
          
          if (!window.am5) {
            log('amCharts not loaded!');
            throw new Error('amCharts library not available');
          }
          
          log('amCharts loaded');
          
          const container = document.getElementById('chartdiv');
          if (!container) {
            throw new Error('Chart container not found');
          }
          
          log('Container found, creating chart');
          
          const dark = ${JSON.stringify(theme)} === 'dark';
          const showVolume = ${JSON.stringify(showVolume)};
          const showGrid = ${JSON.stringify(showGrid)};
          const showCrosshair = ${JSON.stringify(showCrosshair)};
          const chartType = ${JSON.stringify(type)};
          const forced = ${JSON.stringify(forcePositive ?? null)};
          const initialPos = ${JSON.stringify(initialPosition)};
          
          // Create root element
          let root = am5.Root.new("chartdiv");
          
          // Set themes
          if (dark) {
            root.setThemes([am5themes_Animated.new(root), am5themes_Dark.new(root)]);
          } else {
            root.setThemes([am5themes_Animated.new(root)]);
          }
          
          // Create chart
          let chart = root.container.children.push(am5xy.XYChart.new(root, {
            panX: true,
            panY: true,
            wheelX: "panX",
            wheelY: "zoomX",
            pinchZoomX: true,
            paddingLeft: 0,
            paddingRight: 1
          }));
          
          // Add cursor
          let cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
          cursor.lineY.set("visible", false);
          
          // Create axes
          let xAxis = chart.xAxes.push(am5xy.DateAxis.new(root, {
            maxDeviation: 0.2,
            baseInterval: {
              timeUnit: "second",
              count: 1
            },
            renderer: am5xy.AxisRendererX.new(root, {
              minorGridEnabled: true,
              minGridDistance: 50
            }),
            tooltip: am5.Tooltip.new(root, {})
          }));
          
          let yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {
              pan: "zoom"
            })
          }));
          
          // Create series based on type
          let mainSeries;
          let raw = [];
          
          if (chartType === 'candlestick') {
            mainSeries = chart.series.push(am5xy.CandlestickSeries.new(root, {
              name: "Price",
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: "close",
              openValueYField: "open",
              lowValueYField: "low",
              highValueYField: "high",
              valueXField: "date",
              tooltip: am5.Tooltip.new(root, {
                pointerOrientation: "horizontal",
                labelText: "Open: {openValueY}\\nHigh: {highValueY}\\nLow: {lowValueY}\\nClose: {valueY}"
              })
            }));
          } else if (chartType === 'line') {
            mainSeries = chart.series.push(am5xy.LineSeries.new(root, {
              name: "Price",
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: "close",
              valueXField: "date",
              tooltip: am5.Tooltip.new(root, {
                labelText: "{valueY}"
              })
            }));
          } else if (chartType === 'area') {
            mainSeries = chart.series.push(am5xy.LineSeries.new(root, {
              name: "Price",
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: "close",
              valueXField: "date",
              fill: am5.color("#00C805"),
              fillOpacity: 0.3,
              tooltip: am5.Tooltip.new(root, {
                labelText: "{valueY}"
              })
            }));
          } else { // bar
            mainSeries = chart.series.push(am5xy.ColumnSeries.new(root, {
              name: "Price",
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: "close",
              valueXField: "date",
              tooltip: am5.Tooltip.new(root, {
                labelText: "{valueY}"
              })
            }));
          }
          
          // Volume series
          let volumeSeries;
          if (showVolume) {
            let volumeAxisY = chart.yAxes.push(am5xy.ValueAxis.new(root, {
              renderer: am5xy.AxisRendererY.new(root, {
                opposite: true
              }),
              height: am5.percent(20),
              layer: 5
            }));
            
            volumeSeries = chart.series.push(am5xy.ColumnSeries.new(root, {
              name: "Volume",
              xAxis: xAxis,
              yAxis: volumeAxisY,
              valueYField: "volume",
              valueXField: "date",
              tooltip: am5.Tooltip.new(root, {
                labelText: "Volume: {valueY}"
              })
            }));
            
            volumeSeries.columns.template.setAll({
              strokeOpacity: 0,
              fillOpacity: 0.5
            });
          }
          
          // Moving averages
          let ma20Series, ma50Series;
          if (${JSON.stringify(showMA)}) {
            ma20Series = chart.series.push(am5xy.LineSeries.new(root, {
              name: "MA20",
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: "ma20",
              valueXField: "date",
              stroke: am5.color("#f59e0b"),
              strokeWidth: 2
            }));
            
            ma50Series = chart.series.push(am5xy.LineSeries.new(root, {
              name: "MA50",
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: "ma50",
              valueXField: "date",
              stroke: am5.color("#8b5cf6"),
              strokeWidth: 2
            }));
          }
          
          // Calculate moving averages
          function calculateMA(data, period) {
            const result = [];
            for (let i = period - 1; i < data.length; i++) {
              let sum = 0;
              for (let j = i - period + 1; j <= i; j++) {
                sum += data[j].close;
              }
              result.push(sum / period);
            }
            return result;
          }
          
          function applySeriesData(initial) {
            try {
              raw = Array.isArray(initial) ? initial : [];
              if (raw.length === 0) {
                mainSeries.data.clear();
                if (volumeSeries) volumeSeries.data.clear();
                if (ma20Series) ma20Series.data.clear();
                if (ma50Series) ma50Series.data.clear();
                return;
              }
              
              // Convert data format for amCharts
              const seriesData = raw.map(d => ({
                date: d.time * 1000, // Convert to milliseconds
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume || 0
              }));
              
              // Calculate moving averages
              if (${JSON.stringify(showMA)} && seriesData.length >= 50) {
                const ma20Data = calculateMA(seriesData, 20);
                const ma50Data = calculateMA(seriesData, 50);
                
                // Add MA data to series data
                for (let i = 0; i < seriesData.length; i++) {
                  if (i >= 19 && ma20Data[i - 19] !== undefined) {
                    seriesData[i].ma20 = ma20Data[i - 19];
                  }
                  if (i >= 49 && ma50Data[i - 49] !== undefined) {
                    seriesData[i].ma50 = ma50Data[i - 49];
                  }
                }
              }
              
              // Set data
              mainSeries.data.setAll(seriesData);
              if (volumeSeries) volumeSeries.data.setAll(seriesData);
              if (ma20Series) ma20Series.data.setAll(seriesData.filter(d => d.ma20 !== undefined));
              if (ma50Series) ma50Series.data.setAll(seriesData.filter(d => d.ma50 !== undefined));
              
            } catch(e) { 
              log('applySeriesData error: ' + e.message); 
            }
          }
          
          applySeriesData(raw);
          
          // Add price lines for trade levels
          function addPriceLine(price, color, title) {
            if (price == null || !isFinite(price)) return;
            try {
              let range = yAxis.createAxisRange(yAxis.makeDataItem({
                value: price
              }));
              
              range.get("axisFill").setAll({
                fill: am5.color(color),
                fillOpacity: 0.1
              });
              
              range.get("grid").setAll({
                strokeOpacity: 1,
                stroke: am5.color(color),
                strokeDasharray: [2, 2]
              });
              
              range.set("label", am5.Label.new(root, {
                text: title,
                location: 0,
                background: am5.RoundedRectangle.new(root, {
                  fill: am5.color(color)
                })
              }));
            } catch(e) {}
          }
          
          // Add level lines
          const levels = ${JSON.stringify(levels || {})};
          const trade = ${JSON.stringify(tradePlan || null)};
          
          function addLevelLines() {
            try {
              let effectiveLevels = levels;
              if (trade && typeof trade === 'object') {
                effectiveLevels = {};
                if (trade.entry != null) effectiveLevels.entry = Number(trade.entry);
                if (trade.lateEntry != null) effectiveLevels.entryExtended = Number(trade.lateEntry);
                if (trade.exit != null) effectiveLevels.exit = Number(trade.exit);
                if (trade.lateExit != null) effectiveLevels.exitExtended = Number(trade.lateExit);
              }
              
              if (effectiveLevels.entry != null) addPriceLine(effectiveLevels.entry, '#10B981', 'Entry');
              if (effectiveLevels.entryExtended != null) addPriceLine(effectiveLevels.entryExtended, '#14b8a6', 'Late Entry');
              if (effectiveLevels.exit != null) addPriceLine(effectiveLevels.exit, '#EF4444', 'Exit');
              if (effectiveLevels.exitExtended != null) addPriceLine(effectiveLevels.exitExtended, '#F97316', 'Late Exit');
            } catch(_) {}
          }
          
          // Initial positioning
          setTimeout(() => {
            try {
              if (initialPos === "end") {
                xAxis.zoom(0.8, 1);
              } else if (initialPos === "start") {
                xAxis.zoom(0, 0.2);
              } else {
                xAxis.zoomToValues(xAxis.getPrivate("min"), xAxis.getPrivate("max"));
              }
            } catch(_) {}
            addLevelLines();
          }, 100);
          
          // RN -> Web command handler
          function appendSeriesData(items) {
            try {
              if (!Array.isArray(items) || items.length === 0) return;
              
              for (var i = 0; i < items.length; i++) {
                var d = items[i];
                if (!d) continue;
                
                // Maintain raw cache
                if (!Array.isArray(raw) || raw.length === 0) {
                  raw = [d];
                } else {
                  var last = raw[raw.length - 1];
                  if (d.time > last.time) {
                    raw.push(d);
                  } else if (d.time === last.time) {
                    raw[raw.length - 1] = d;
                  } else {
                    // Out-of-order — find/replace by time
                    var idx = raw.findIndex(function(x){ return x && x.time === d.time; });
                    if (idx >= 0) raw[idx] = d; else raw.push(d);
                    raw.sort(function(a,b){ return a.time - b.time; });
                  }
                }
                
                // Add to chart
                const chartData = {
                  date: d.time * 1000,
                  open: d.open,
                  high: d.high,
                  low: d.low,
                  close: d.close,
                  volume: d.volume || 0
                };
                
                mainSeries.data.pushValue(chartData);
                if (volumeSeries) volumeSeries.data.pushValue(chartData);
              }
            } catch(e) { 
              log('appendSeriesData error: ' + e.message); 
            }
          }
          
          window.addEventListener('message', function(event) {
            try {
              const msg = JSON.parse(event.data);
              if (!msg || !msg.cmd) return;
              
              if (msg.cmd === 'setData') {
                const newData = msg.data || [];
                applySeriesData(newData);
              } else if (msg.cmd === 'appendData') {
                appendSeriesData(msg.data || []);
              } else if (msg.cmd === 'updateLastBar') {
                try {
                  const newBar = msg.data;
                  if (!newBar || typeof newBar.time !== 'number') return;
                  
                  // Update the last bar in raw data
                  if (raw && raw.length > 0) {
                    raw[raw.length - 1] = newBar;
                    
                    // Update chart data
                    const chartData = {
                      date: newBar.time * 1000,
                      open: newBar.open,
                      high: newBar.high,
                      low: newBar.low,
                      close: newBar.close,
                      volume: newBar.volume || 0
                    };
                    
                    // Remove last data point and add updated one
                    mainSeries.data.removeIndex(mainSeries.data.length - 1);
                    mainSeries.data.pushValue(chartData);
                    
                    if (volumeSeries) {
                      volumeSeries.data.removeIndex(volumeSeries.data.length - 1);
                      volumeSeries.data.pushValue(chartData);
                    }
                  }
                } catch(e) { 
                  log('updateLastBar error: ' + e.message); 
                }
              } else if (msg.cmd === 'scrollToRealTime') {
                try { 
                  xAxis.zoom(0.8, 1); 
                } catch(_) {}
              } else if (msg.cmd === 'fitContent') {
                try { 
                  xAxis.zoomToValues(xAxis.getPrivate("min"), xAxis.getPrivate("max")); 
                } catch(_) {}
              } else if (msg.cmd === 'resetView') {
                try {
                  xAxis.zoom(0.8, 1);
                } catch(_) {}
              }
            } catch(e) { 
              log('message handler error: ' + e.message); 
            }
          });
          
          // Post ready message
          try {
            const count = Array.isArray(raw) ? raw.length : 0;
            log('Posting ready message');
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ 
              ready: true, 
              count,
              type: chartType
            }));
          } catch (e) {
            log('postMessage error: ' + e.message);
          }
          
        } catch (globalError) {
          log('Global error: ' + globalError.message);
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ 
            error: globalError.message 
          }));
        }
      }
      
      // Try to initialize immediately, or wait for library to load
      if (window.am5) {
        initChart();
      } else {
        // Wait for script to load
        let attempts = 0;
        const checkForLibrary = setInterval(() => {
          attempts++;
          if (window.am5) {
            clearInterval(checkForLibrary);
            initChart();
          } else if (attempts > 50) { // 5 seconds max
            clearInterval(checkForLibrary);
            log('Library load timeout');
          }
        }, 100);
      }
    </script>
  </body></html>`,
      [height, theme, showVolume, showGrid, showCrosshair, type]
    );

    // Push data updates to WebView when RN data changes and web is ready
    // Reset ready state when HTML re-initializes to avoid premature posts
    useEffect(() => {
      setIsReady(false);
      lastPushedTimeRef.current = null;
      lastFirstTimeRef.current = null;
    }, [html]);

    // Optimized data updates with debouncing and performance improvements
    useEffect(() => {
      if (!isReady || !webRef.current) return;
      if (!series || series.length === 0) return;

      // Initial data load (when no data has been pushed yet)
      if (lastPushedTimeRef.current == null) {
        console.log("📊 Initial chart data load:", series.length, "bars");
        (webRef.current as any)?.postMessage?.(
          JSON.stringify({ cmd: "setData", data: series, autoFit: true })
        );

        if (series.length > 0) {
          const latest = series[series.length - 1];
          const newFirst = series[0]?.time ?? null;
          const newSpacing =
            series.length >= 2
              ? series[series.length - 1].time - series[series.length - 2].time
              : null;

          lastPushedTimeRef.current = latest.time;
          lastSpacingRef.current = newSpacing;
          lastLengthRef.current = series.length;
          lastFirstTimeRef.current = newFirst;
          lastUpdateTimeRef.current = Date.now();
        }
        return;
      }

      // Clear any pending updates
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }

      const performUpdate = () => {
        try {
          const lastTime = lastPushedTimeRef.current as number;
          const latest = series[series.length - 1];
          if (!latest) return;

          // Detect significant changes that require full refresh
          const prevLen = lastLengthRef.current || 0;
          const prevSpacing = lastSpacingRef.current;
          const prevFirst = lastFirstTimeRef.current;
          const newFirst = series[0]?.time ?? null;
          const newSpacing =
            series.length >= 2
              ? series[series.length - 1].time - series[series.length - 2].time
              : null;

          // Check if this is completely new data (symbol change)
          const isCompletelyNewData =
            prevFirst != null &&
            newFirst != null &&
            Math.abs(newFirst - prevFirst) > 86400; // More than 1 day difference

          if (isCompletelyNewData) {
            console.log("🔄 Detected symbol change - full chart reset");
            (webRef.current as any)?.postMessage?.(
              JSON.stringify({ cmd: "setData", data: series, autoFit: true })
            );
            lastPushedTimeRef.current = latest.time;
            lastSpacingRef.current = newSpacing;
            lastLengthRef.current = series.length;
            lastFirstTimeRef.current = newFirst;
            lastUpdateTimeRef.current = Date.now();
            return;
          }

          const spacingChanged =
            prevSpacing != null &&
            newSpacing != null &&
            Math.abs(newSpacing - prevSpacing) > Math.max(1, prevSpacing * 0.2);
          const lengthShrank = series.length < prevLen;

          // Handle timeframe changes with full refresh
          if (spacingChanged || lengthShrank) {
            const shouldAutoFit = true;
            (webRef.current as any)?.postMessage?.(
              JSON.stringify({
                cmd: "setData",
                data: series,
                autoFit: shouldAutoFit,
              })
            );
            lastPushedTimeRef.current = latest.time;
            lastSpacingRef.current = newSpacing ?? null;
            lastLengthRef.current = series.length;
            lastFirstTimeRef.current = newFirst;
            lastUpdateTimeRef.current = Date.now();
            return;
          }

          // Handle incremental updates
          if (latest.time === lastTime) {
            // Same candle update (real-time tick)
            (webRef.current as any)?.postMessage?.(
              JSON.stringify({ cmd: "updateLastBar", data: latest })
            );
            return;
          }

          if (latest.time > lastTime) {
            // New bars appended
            const newBars = series.filter((b) => b.time > lastTime);
            if (newBars.length > 0 && newBars.length <= 100) {
              // Batch small updates
              (webRef.current as any)?.postMessage?.(
                JSON.stringify({ cmd: "appendData", data: newBars })
              );
            } else if (newBars.length > 100) {
              // Full refresh for large updates
              (webRef.current as any)?.postMessage?.(
                JSON.stringify({ cmd: "setData", data: series, autoFit: false })
              );
            }
            lastPushedTimeRef.current = latest.time;
            lastSpacingRef.current = newSpacing ?? lastSpacingRef.current;
            lastLengthRef.current = series.length;
            lastFirstTimeRef.current = newFirst ?? lastFirstTimeRef.current;
            lastUpdateTimeRef.current = Date.now();
          }
        } catch (error) {
          console.warn("Chart update error:", error);
        }
      };

      // Determine update strategy based on change magnitude
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      const lengthChange = Math.abs(series.length - lastLengthRef.current);

      // Immediate update for significant changes or first update
      if (
        lengthChange > 50 ||
        timeSinceLastUpdate > 2000 ||
        lastUpdateTimeRef.current === 0
      ) {
        performUpdate();
      } else {
        // Debounce minor updates for smoother performance and reduced bridge overhead
        pendingUpdateRef.current = setTimeout(performUpdate, 200);
      }

      return () => {
        if (pendingUpdateRef.current) {
          clearTimeout(pendingUpdateRef.current);
          pendingUpdateRef.current = null;
        }
      };
    }, [isReady, series]);

    // Real-time candle updates
    useEffect(() => {
      if (!enableRealtime || !symbol || !isReady) return;

      console.log(
        `🔄 Setting up real-time updates for ${symbol} (${timeframe})`
      );

      let candleUnsubscribe: (() => void) | null = null;

      const setupRealtime = async () => {
        try {
          // Subscribe to real-time candle updates
          candleUnsubscribe = realtimeRouter.onCandle(
            (candleSymbol, candle) => {
              if (candleSymbol !== symbol) return;
              if (candle.timeframe !== timeframe) return;

              console.log(`📊 Real-time candle update for ${symbol}:`, candle);

              // Convert to AmChartsDatum format with proper validation
              const amChartsCandle = {
                time: Math.floor(candle.time / 1000), // Convert to seconds for amCharts
                open: Number(candle.open) || 0,
                high: Number(candle.high) || 0,
                low: Number(candle.low) || 0,
                close: Number(candle.close) || 0,
                volume: Number(candle.volume) || 0,
              };

              // Validate candle data before sending to chart
              if (!amChartsCandle.time || amChartsCandle.time <= 0) {
                console.warn(
                  `🚫 Invalid candle time for ${symbol}:`,
                  amChartsCandle
                );
                return;
              }
              if (amChartsCandle.high < amChartsCandle.low) {
                console.warn(
                  `🚫 Invalid candle OHLC for ${symbol}:`,
                  amChartsCandle
                );
                return;
              }

              // Additional validation for reasonable price values
              const prices = [
                amChartsCandle.open,
                amChartsCandle.high,
                amChartsCandle.low,
                amChartsCandle.close,
              ];
              if (prices.some((p) => !Number.isFinite(p) || p <= 0)) {
                console.warn(
                  `🚫 Invalid candle prices for ${symbol}:`,
                  amChartsCandle
                );
                return;
              }

              // Check for extreme price movements that might indicate bad data
              const priceRange = amChartsCandle.high - amChartsCandle.low;
              const avgPrice = (amChartsCandle.high + amChartsCandle.low) / 2;
              if (avgPrice > 0 && priceRange / avgPrice > 0.5) {
                console.warn(
                  `🚫 Extreme price range detected for ${symbol}:`,
                  amChartsCandle,
                  `(${((priceRange / avgPrice) * 100).toFixed(1)}% range)`
                );
                return;
              }

              // Send update to chart
              if (webRef.current) {
                if (candle.isComplete) {
                  // Complete candle - append as new bar
                  (webRef.current as any)?.postMessage?.(
                    JSON.stringify({
                      cmd: "appendData",
                      data: [amChartsCandle],
                    })
                  );
                } else {
                  // Incomplete candle - update current bar
                  (webRef.current as any)?.postMessage?.(
                    JSON.stringify({
                      cmd: "updateLastBar",
                      data: amChartsCandle,
                    })
                  );
                }
              }
            }
          );

          // Subscribe to the symbol for the specific timeframe
          await realtimeRouter.subscribeForTimeframe([symbol], timeframe);
        } catch (error) {
          console.warn("Failed to setup real-time updates:", error);
        }
      };

      setupRealtime();

      return () => {
        console.log(`⏹️ Cleaning up real-time updates for ${symbol}`);
        if (candleUnsubscribe) {
          candleUnsubscribe();
        }
        // Clean up timeframe-specific subscription
        realtimeRouter.unsubscribeTimeframe([symbol], timeframe);
      };
    }, [enableRealtime, symbol, timeframe, isReady]);

    return (
      <View
        style={{
          height,
          width: "100%",
          overflow: "hidden",
          backgroundColor: "transparent",
        }}
      >
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          style={{ height, width: "100%", backgroundColor: "transparent" }}
          containerStyle={{ backgroundColor: "transparent" }}
          /* @ts-expect-error react-native-webview may not expose opaque in types */
          opaque={false}
          javaScriptEnabled={true}
          domStorageEnabled={false}
          bounces={false}
          overScrollMode="never"
          decelerationRate="normal"
          startInLoadingState={false}
          scalesPageToFit={false}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          // Performance optimizations
          cacheEnabled={true}
          incognito={false}
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          // Reduce memory usage
          allowsInlineMediaPlayback={false}
          mediaPlaybackRequiresUserAction={true}
          ref={webRef}
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg?.ready) {
                setIsReady(true);
                if (onReady) onReady();
                try {
                  (webRef.current as any)?.postMessage?.(
                    JSON.stringify({
                      cmd: "setData",
                      data: series,
                      autoFit: true, // Always auto-fit on initial load
                    })
                  );

                  // Initialize last pushed time from the dataset we just sent
                  if (Array.isArray(series) && series.length > 0) {
                    lastPushedTimeRef.current = series[series.length - 1].time;
                    lastSpacingRef.current =
                      series.length >= 2
                        ? series[series.length - 1].time -
                          series[series.length - 2].time
                        : null;
                    lastLengthRef.current = series.length;
                  } else {
                    lastPushedTimeRef.current = null;
                    lastSpacingRef.current = null;
                    lastLengthRef.current = 0;
                  }
                } catch (_) {}
              } else if (msg?.visibleRange && onVisibleRangeChange) {
                onVisibleRangeChange(msg.visibleRange);
              } else if (msg?.loadMoreData && onLoadMoreData) {
                // Defer historical data application to React Native side.
                onLoadMoreData(msg.loadMoreData.numberOfBars).catch((e) =>
                  console.warn("Load more data failed:", e)
                );
              } else {
                console.log("AmChartsCandles WebView message:", msg);
              }
            } catch {
              console.log(
                "AmChartsCandles WebView message:",
                e.nativeEvent.data
              );
            }
          }}
          onError={(e) => {
            console.warn("AmChartsCandles WebView error:", e.nativeEvent);
          }}
        />
      </View>
    );
  }
);

export default AmChartsCandles;
