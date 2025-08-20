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
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,body,#wrap{margin:0;padding:0;height:100%;width:100%;}
      #c{position:relative;height:100%;width:100%;}
      #t{position:absolute;left:12px;top:12px;padding:8px 12px;border-radius:12px;font:13px -apple-system,Segoe UI,Roboto,Helvetica,Arial;background:rgba(17,24,39,.9);color:#ffffff;z-index:10;box-shadow:0 8px 25px rgba(0,0,0,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);}
      #controls{position:absolute;right:12px;top:12px;z-index:10;display:flex;gap:8px;}
      .btn{padding:6px 12px;border:none;border-radius:8px;font:12px -apple-system,Segoe UI,Roboto,Helvetica,Arial;cursor:pointer;background:rgba(17,24,39,.8);color:#ffffff;transition:all 0.2s;}
      .btn:hover{background:rgba(37,99,235,.8);}
      .btn.active{background:#2563eb;}
      #debug{position:absolute;bottom:10px;left:10px;background:rgba(255,0,0,0.8);color:white;padding:5px;font-size:10px;z-index:100;}
      #zones{position:absolute;left:0;right:0;top:0;bottom:0;pointer-events:none;z-index:50;}
      .zone{position:absolute;left:0;right:0;opacity:.22;border:1px solid rgba(255,255,255,0.35);z-index:51;} 
      .zone-label{position:absolute;right:8px;top:4px;font:11px -apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#fff;padding:2px 6px;border-radius:6px;background:rgba(0,0,0,0.35);} 
    </style>
    </head><body>
    <div id="wrap">
      <div id="c">
        <div id="t" style="display:none"></div>
        <div id="zones"></div>
        <div id="controls">
          <button class="btn" onclick="chart.timeScale().fitContent()">Fit</button>
          <button class="btn" onclick="resetZoom()">Reset</button>
        </div>
      </div>
      <div id="debug">Loading...</div>
    </div>
    <script src="https://unpkg.com/lightweight-charts@5.0.0/dist/lightweight-charts.standalone.production.js"></script>
    <script>
      const debugEl = document.getElementById('debug');
      function log(msg) {
        debugEl.textContent = msg;
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
          background: { type: 'solid', color: dark ? '#111827' : '#ffffff' },
          fontSize: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
        },
        rightPriceScale: { 
          borderVisible: false,
          entireTextOnly: true,
          scaleMargins: { top: 0.1, bottom: showVolume ? 0.3 : 0.1 }
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
      
      // Render fallback price lines immediately if we have levels
      try {
        const lv = ${JSON.stringify(levels || {})};
        if (lv.entry) addPriceLine(lv.entry, '#10B981', 'TP');
        if (lv.entryExtended) addPriceLine(lv.entryExtended, '#14b8a6', 'TP Ext');
        if (lv.exit) addPriceLine(lv.exit, '#EF4444', 'SL');
        if (lv.exitExtended) addPriceLine(lv.exitExtended, '#F97316', 'SL Ext');
        // Also show the assumed entry at the latest close
        try {
          const last = Array.isArray(raw) && raw.length > 0 ? raw[raw.length - 1] : null;
          const lastClose = last && typeof last.close === 'number' ? last.close : null;
          if (lastClose != null) addPriceLine(lastClose, '#0ea5e9', 'Entry');
        } catch(_inner) {}
      } catch(_){ }

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
      chart.subscribeCrosshairMove(param => {
        if (!param || !param.time || !param.point) { 
          tooltip.style.display = 'none'; 
          return; 
        }
        
        const price = param.seriesPrices.get(mainSeries);
        if (price == null) { 
          tooltip.style.display = 'none'; 
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
      });

      // Utility functions
      function resetZoom() {
        chart.timeScale().resetTimeScale();
      }

      // Trade levels zones/lines
      const levels = ${JSON.stringify(levels || {})};
      const zonesRoot = document.getElementById('zones');
      function ensureZone(id, color, labelText) {
        let el = document.getElementById(id);
        if (!el) {
          el = document.createElement('div');
          el.id = id;
          el.className = 'zone';
          el.style.background = color;
          const lab = document.createElement('div');
          lab.className = 'zone-label';
          lab.textContent = labelText;
          el.appendChild(lab);
          zonesRoot.appendChild(el);
        }
        return el;
      }

      function px(v){return Math.max(0, Math.round(v || 0));}
      function updateZones(){
        if (!mainSeries || !levels) return;
        const h = container.clientHeight;
        const priceToY = (p) => mainSeries.priceToCoordinate(p);

        // Take Profit zone
        if (levels.entry) {
          const p1 = priceToY(levels.entry);
          const p2 = levels.entryExtended ? priceToY(levels.entryExtended) : p1;
          if (p1 != null && p2 != null) {
            const top = Math.min(p1, p2);
            const bottom = Math.max(p1, p2);
            const el = ensureZone('tp-zone', 'rgba(16,185,129,0.25)', 'Take Profit');
            el.style.top = px(top - (top===bottom ? 8 : 0)) + 'px';
            el.style.height = px((bottom - top) || 16) + 'px';
          }
        }

        // Stop Loss zone
        if (levels.exit) {
          const p1 = priceToY(levels.exit);
          const p2 = levels.exitExtended ? priceToY(levels.exitExtended) : p1;
          if (p1 != null && p2 != null) {
            const top = Math.min(p1, p2);
            const bottom = Math.max(p1, p2);
            const el = ensureZone('sl-zone', 'rgba(239,68,68,0.28)', 'Stop Loss');
            el.style.top = px(top - (top===bottom ? 8 : 0)) + 'px';
            el.style.height = px((bottom - top) || 16) + 'px';
          }
        }
      }

      // Ensure width and fit on load
      setTimeout(() => {
        log('Applying width: ' + container.clientWidth);
        chart.applyOptions({ width: container.clientWidth });
        chart.timeScale().fitContent();
        log('Chart fitted and ready');
        // Re-append zones to ensure they are on top of chart internal nodes
        try { container.appendChild(zonesRoot); } catch(e) {}
        updateZones();
      }, 100);

      // Handle window resize
      function handleResize() {
        chart.applyOptions({ width: container.clientWidth });
        updateZones();
      }
      
      window.addEventListener('resize', handleResize);
      
      // Recompute zones when price scale changes or time range changes
      const ps = mainSeries.priceScale && mainSeries.priceScale();
      if (ps && ps.subscribeVisiblePriceRangeChange) {
        ps.subscribeVisiblePriceRangeChange(() => updateZones());
      }
      if (chart.timeScale && chart.timeScale().subscribeVisibleTimeRangeChange) {
        chart.timeScale().subscribeVisibleTimeRangeChange(() => updateZones());
      }
      chart.subscribeCrosshairMove(() => updateZones());
      
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
      style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }}
    >
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ height, width: "100%" }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
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
