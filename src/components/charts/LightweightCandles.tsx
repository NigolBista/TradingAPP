import React, { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

export type LWCDatum = {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type ChartType = "candlestick" | "area" | "line" | "bar";

interface Props {
  data: LWCDatum[];
  height?: number;
  type?: ChartType;
  theme?: "light" | "dark";
  showVolume?: boolean;
  showMA?: boolean;
  maPeriods?: number[];
  showGrid?: boolean;
  showCrosshair?: boolean;
  // Optional trade levels - used to render zones/lines
  levels?: {
    entry?: number;
    entryExtended?: number;
    exit?: number;
    exitExtended?: number;
  };
}

export default function LightweightCandles({
  data,
  height = 320,
  type = "candlestick",
  theme = "light",
  showVolume = true,
  showMA = true,
  maPeriods = [20, 50],
  showGrid = true,
  showCrosshair = true,
  levels,
}: Props) {
  const series = useMemo(
    () =>
      data.map((d) => ({
        time: Math.floor(d.time / 1000),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume || Math.random() * 1000000, // Generate random volume if not provided
      })),
    [data]
  );

  // Calculate moving averages
  const calculateMA = (data: any[], period: number) => {
    const result: any[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const sum = data
          .slice(i - period + 1, i + 1)
          .reduce((acc, item) => acc + item.close, 0);
        result.push({ time: data[i].time, value: sum / period });
      }
    }
    return result.filter((item) => item !== null);
  };

  const ma20 = calculateMA(series, maPeriods[0] || 20);
  const ma50 = calculateMA(series, maPeriods[1] || 50);

  const html = `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <style>
      html,body,#wrap{margin:0;padding:0;height:100%;width:100%;background:transparent;overscroll-behavior:none;-webkit-text-size-adjust:100%;}
      body{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}
      #wrap{overflow:hidden;}
      #c{position:relative;height:100%;width:100%;overflow:hidden;}
      #t{position:absolute;left:12px;top:12px;padding:8px 12px;border-radius:12px;font:13px -apple-system,Segoe UI,Roboto,Helvetica,Arial;background:rgba(17,24,39,.9);color:#ffffff;z-index:10;box-shadow:0 8px 25px rgba(0,0,0,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);}
      
    </style>
    </head><body>
    <div id="wrap">
      <div id="c">
        <div id="t" style="display:none"></div>
      </div>
    </div>
    <script src="https://unpkg.com/lightweight-charts@5.0.0/dist/lightweight-charts.standalone.production.js"></script>
    <script>
      // Prevent page-level pinch-zoom while allowing chart pinch
      (function(){
        try {
          document.addEventListener('gesturestart', function(e){ e.preventDefault(); }, { passive: false });
          document.addEventListener('gesturechange', function(e){ e.preventDefault(); }, { passive: false });
          document.addEventListener('gestureend', function(e){ e.preventDefault(); }, { passive: false });
        } catch(_) {}
      })();
      function log(msg) {
        try {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ debug: msg }));
        } catch(e) {}
      }
      
      // Wait for library to load
      function initChart() {
        try {
          log('Script started');
          
          if (!window.LightweightCharts) {
            log('LightweightCharts not loaded!');
            throw new Error('LightweightCharts library not available');
          }
          
          log('LightweightCharts loaded');
          
          const container = document.getElementById('c');
          if (!container) {
            throw new Error('Chart container not found');
          }
          
          log('Container found, creating chart');
      const dark = ${JSON.stringify(theme)} === 'dark';
      const showVolume = ${JSON.stringify(showVolume)};
      const showGrid = ${JSON.stringify(showGrid)};
      const showCrosshair = ${JSON.stringify(showCrosshair)};
      const chartOptions = {
        height: ${height},
        layout: { 
          textColor: dark ? '#e5e7eb' : '#374151', 
          background: { type: 'solid', color: 'transparent' },
          fontSize: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
        },
        rightPriceScale: { 
          borderVisible: false,
          entireTextOnly: true,
          scaleMargins: { top: 0.1, bottom: 0.1 }
        },
        timeScale: { 
          borderVisible: false, 
          timeVisible: true, 
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: 6,
          minBarSpacing: 3
        },
        grid: { 
          horzLines: { color: showGrid ? (dark ? '#1f2937' : '#f3f4f6') : 'transparent' }, 
          vertLines: { color: showGrid ? (dark ? '#1f2937' : '#f3f4f6') : 'transparent' } 
        },
        crosshair: { 
          mode: showCrosshair ? LightweightCharts.CrosshairMode.Normal : LightweightCharts.CrosshairMode.Hidden,
          vertLine: {
            width: 1,
            color: dark ? '#6b7280' : '#9ca3af',
            style: LightweightCharts.LineStyle.Dashed
          },
          horzLine: {
            width: 1,
            color: dark ? '#6b7280' : '#9ca3af',
            style: LightweightCharts.LineStyle.Dashed
          }
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true
        }
      };

      log('Creating chart with options');
      const chart = LightweightCharts.createChart(container, chartOptions);
      
      if (!chart) {
        throw new Error('Failed to create chart instance');
      }
      
      log('Chart created successfully');
      
      // Compatibility layer for Lightweight Charts v5 (addSeries) and v4 (addXSeries)
      function addSeriesCompat(kind, options){
        const hasNewApi = typeof chart.addSeries === 'function' && window.LightweightCharts && (
          window.LightweightCharts.CandlestickSeries || window.LightweightCharts.LineSeries
        );
        if (hasNewApi) {
          switch(kind){
            case 'area':
              return chart.addSeries(window.LightweightCharts.AreaSeries, options);
            case 'line':
              return chart.addSeries(window.LightweightCharts.LineSeries, options);
            case 'bar':
              return chart.addSeries(window.LightweightCharts.BarSeries, options);
            case 'candlestick':
              return chart.addSeries(window.LightweightCharts.CandlestickSeries, options);
            case 'histogram':
              return chart.addSeries(window.LightweightCharts.HistogramSeries, options);
            default:
              return chart.addSeries(window.LightweightCharts.LineSeries, options);
          }
        }
        // Fallback to legacy methods
        switch(kind){
          case 'area':
            return chart.addAreaSeries(options);
          case 'line':
            return chart.addLineSeries(options);
          case 'bar':
            return chart.addBarSeries(options);
          case 'candlestick':
            return chart.addCandlestickSeries(options);
          case 'histogram':
            return chart.addHistogramSeries(options);
          default:
            return chart.addLineSeries(options);
        }
      }

      let mainSeries;
      const type = ${JSON.stringify(type)};
      
      if (type === 'area') {
        mainSeries = addSeriesCompat('area', { 
          lineColor: '#2563eb', 
          topColor: 'rgba(37,99,235,0.4)', 
          bottomColor: 'rgba(37,99,235,0.05)',
          lineWidth: 2
        });
      } else if (type === 'line') {
        mainSeries = addSeriesCompat('line', { 
          color: '#2563eb', 
          lineWidth: 3,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 6
        });
      } else if (type === 'bar') {
        mainSeries = addSeriesCompat('bar', { 
          upColor: '#16a34a', 
          downColor: '#dc2626',
          openVisible: true,
          thinBars: false
        });
      } else {
        mainSeries = addSeriesCompat('candlestick', { 
          upColor: '#16a34a', 
          downColor: '#dc2626', 
          wickUpColor: '#16a34a', 
          wickDownColor: '#dc2626', 
          borderVisible: false 
        });
      }
      
      const raw = ${JSON.stringify(series)};
      log('Raw data length: ' + raw.length);
      const seriesData = (type === 'area' || type === 'line') 
        ? raw.map(d => ({ time: d.time, value: d.close }))
        : raw;
      log('Setting data on main series');
      mainSeries.setData(seriesData);
      log('Data set on main series');
      
      // Add price lines as a fallback so levels are always visible
      function addPriceLine(price, color, title){
        if (price == null || !isFinite(price)) return;
        try { 
          mainSeries.createPriceLine({
            price: Number(price),
            color: color,
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dotted,
            axisLabelVisible: true,
            title
          });
        } catch(e) {}
      }
      
      // Level lines are added after initial fit via addLevelLines()

      // Add Moving Averages
      ${
        showMA
          ? `
        const ma20Data = ${JSON.stringify(ma20)};
        const ma50Data = ${JSON.stringify(ma50)};
        
        if (ma20Data.length > 0) {
          const ma20Series = chart.addLineSeries({
            color: '#f59e0b',
            lineWidth: 2,
            title: 'MA20',
            priceLineVisible: false,
            crosshairMarkerVisible: false
          });
          ma20Series.setData(ma20Data);
        }
        
        if (ma50Data.length > 0) {
          const ma50Series = chart.addLineSeries({
            color: '#8b5cf6',
            lineWidth: 2,
            title: 'MA50',
            priceLineVisible: false,
            crosshairMarkerVisible: false
          });
          ma50Series.setData(ma50Data);
        }
      `
          : ""
      }

      // Volume histogram
      ${
        showVolume
          ? `
        const volumeSeries = addSeriesCompat('histogram', {
          color: '#94a3b8',
          priceFormat: { type: 'volume' },
          priceScaleId: '',
          scaleMargins: { top: 0.7, bottom: 0 }
        });
        
        const volumeData = raw.map(d => ({
          time: d.time,
          value: d.volume,
          color: (d.close >= d.open) ? 'rgba(22,163,74,0.5)' : 'rgba(220,38,38,0.5)'
        }));
        
        volumeSeries.setData(volumeData);
      `
          : ""
      }

      // Enhanced crosshair tooltip
      const tooltip = document.getElementById('t');
      let crosshairRaf = null;
      let lastParam = null;
      function renderTooltip(){
        const param = lastParam;
        if (!param || !param.time || !param.point) { 
          tooltip.style.display = 'none'; 
          crosshairRaf = null;
          return; 
        }
        
        const price = param.seriesPrices.get(mainSeries);
        if (price == null) { 
          tooltip.style.display = 'none'; 
          crosshairRaf = null;
          return; 
        }
        
        ${
          showVolume
            ? `
          const volume = param.seriesPrices.get(volumeSeries);
        `
            : "const volume = null;"
        }
        
        const date = new Date(param.time * 1000);
        const dateStr = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        
        let content = '<div style="font-weight: 600; margin-bottom: 4px;">' + dateStr + '</div>';
        
        if (typeof price === 'number') {
          content += '<div>Price: <span style="color: #2563eb;">$' + price.toFixed(2) + '</span></div>';
        } else {
          const changePercent = price.open ? ((price.close - price.open) / price.open * 100).toFixed(2) : '0';
          const isPositive = price.close >= price.open;
          const changeColor = isPositive ? '#16a34a' : '#dc2626';
          
          content += '<div>Open: <span style="color: #6b7280;">$' + price.open.toFixed(2) + '</span></div>';
          content += '<div>High: <span style="color: #6b7280;">$' + price.high.toFixed(2) + '</span></div>';
          content += '<div>Low: <span style="color: #6b7280;">$' + price.low.toFixed(2) + '</span></div>';
          content += '<div>Close: <span style="color: ' + changeColor + ';">$' + price.close.toFixed(2) + '</span>';
          content += ' <span style="color: ' + changeColor + '; font-size: 11px;">(' + (isPositive ? '+' : '') + changePercent + '%)</span></div>';
        }
        
        if (volume) {
          const vol = volume > 1000000 ? (volume/1000000).toFixed(1) + 'M' : 
                     volume > 1000 ? (volume/1000).toFixed(1) + 'K' : 
                     Math.round(volume).toString();
          content += '<div style="margin-top: 4px; font-size: 11px; color: #9ca3af;">Volume: ' + vol + '</div>';
        }
        
        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        crosshairRaf = null;
      }
      chart.subscribeCrosshairMove(param => {
        lastParam = param;
        if (!crosshairRaf) crosshairRaf = requestAnimationFrame(renderTooltip);
        if (!param || !param.time || !param.point) { 
          tooltip.style.display = 'none'; 
          return; 
        }
        
      });

      // Trade levels as native price lines (keeps them pinned in-canvas)
      const levels = ${JSON.stringify(levels || {})};
      function addLevelLines() {
        try {
          if (!levels) return;
          if (levels.entry) addPriceLine(levels.entry, '#10B981', 'Take Profit');
          if (levels.entryExtended) addPriceLine(levels.entryExtended, '#14b8a6', 'TP Ext');
          if (levels.exit) addPriceLine(levels.exit, '#EF4444', 'Stop Loss');
          if (levels.exitExtended) addPriceLine(levels.exitExtended, '#F97316', 'SL Ext');
        } catch(_) {}
      }

      // Ensure width and fit on load
      setTimeout(() => {
        log('Applying width: ' + container.clientWidth);
        chart.applyOptions({ width: container.clientWidth });
        chart.timeScale().fitContent();
        log('Chart fitted and ready');
        addLevelLines();
      }, 100);

      // Handle window resize
      function handleResize() {
        chart.applyOptions({ width: container.clientWidth });
      }
      
      window.addEventListener('resize', handleResize);
      
      // No overlay sync needed since lines are native to the series
      
      // Initial draw and a couple of delayed retries in case scale isn't ready yet
      updateZones();
      setTimeout(updateZones, 250);
      setTimeout(updateZones, 800);
      
      // Post ready message
      try {
        const count = Array.isArray(raw) ? raw.length : 0;
        log('Posting ready message');
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ 
          ready: true, 
          count,
          type
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
      if (window.LightweightCharts) {
        initChart();
      } else {
        // Wait for script to load
        let attempts = 0;
        const checkForLibrary = setInterval(() => {
          attempts++;
          if (window.LightweightCharts) {
            clearInterval(checkForLibrary);
            initChart();
          } else if (attempts > 50) { // 5 seconds max
            clearInterval(checkForLibrary);
            log('Library load timeout');
          }
        }, 100);
      }
    </script>
  </body></html>`;

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
        opaque={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        bounces={false}
        overScrollMode="never"
        decelerationRate="normal"
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            console.log("LightweightCandles WebView message:", msg);
          } catch {
            console.log(
              "LightweightCandles WebView message:",
              e.nativeEvent.data
            );
          }
        }}
        onError={(e) => {
          console.warn("LightweightCandles WebView error:", e.nativeEvent);
        }}
      />
    </View>
  );
}
