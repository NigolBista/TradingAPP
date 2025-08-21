import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
} from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

export type LWCDatum = {
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
  data: LWCDatum[];
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
  // Notify RN when visible time range changes (ms)
  onVisibleRangeChange?: (range: { fromMs: number; toMs: number }) => void;
  // Notify when the web chart is ready
  onReady?: () => void;
}

export type LightweightCandlesHandle = {
  scrollToRealTime: () => void;
};

const LightweightCandles = React.forwardRef<LightweightCandlesHandle, Props>(
  function LightweightCandles(
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
      onVisibleRangeChange,
      onReady,
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
    }));
    const series = useMemo(
      () =>
        data.map((d) => ({
          time: Math.floor(d.time / 1000),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume ?? 0,
        })),
      [data]
    );

    // Track last pushed bar time to prefer append over full set
    const lastPushedTimeRef = useRef<number | null>(null);
    // Track last dataset spacing and length to detect timeframe changes
    const lastSpacingRef = useRef<number | null>(null);
    const lastLengthRef = useRef<number>(0);
    // Track first time seen to detect left-side extensions
    const lastFirstTimeRef = useRef<number | null>(null);

    // Resolve local lightweight-charts asset stored as .txt (so Metro treats as asset)
    const [inlineLibText, setInlineLibText] = useState<string | null>(null);
    useEffect(() => {
      (async () => {
        try {
          console.log("LightweightCandles: Starting to load local asset...");
          const lib = Asset.fromModule(
            require("../../../assets/js/lightweight-charts.txt")
          );
          await lib.downloadAsync();
          const uri = lib.localUri || lib.uri;
          console.log("LightweightCandles: Asset URI:", uri);
          if (uri) {
            const content = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            console.log("LightweightCandles: Content length:", content?.length);
            console.log(
              "LightweightCandles: Contains LightweightCharts:",
              content?.includes("LightweightCharts")
            );
            if (content && content.includes("LightweightCharts")) {
              console.log("LightweightCandles: Using local asset");
              setInlineLibText(content);
            } else {
              console.log(
                "LightweightCandles: Local asset invalid, falling back to CDN"
              );
              setInlineLibText(null);
            }
          }
        } catch (e) {
          console.log("LightweightCandles: Error loading local asset:", e);
          setInlineLibText(null);
        }
      })();
    }, []);
    // Only use CDN as fallback; local is injected inline from .txt asset
    const libSrc =
      "https://unpkg.com/lightweight-charts@5.0.0/dist/lightweight-charts.standalone.production.js";
    const scriptLoader = inlineLibText
      ? `<script>console.log('LightweightCandles: Using inline script');(function(){try{var s=document.createElement('script');s.type='text/javascript';s.text=${JSON.stringify(
          inlineLibText
        )};document.head.appendChild(s);}catch(e){console.log('LightweightCandles: Error injecting inline script:', e);}})();</script>`
      : `<script>console.log('LightweightCandles: Using CDN script');</script><script src="${libSrc}"></script>`;

    const html = useMemo(
      () => `<!doctype html><html><head>
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
    ${scriptLoader}
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
        autoSize: true,
        layout: { 
          textColor: dark ? '#e5e7eb' : '#374151', 
          background: { type: 'solid', color: 'transparent' },
          fontSize: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          attributionLogo: false
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
      const forced = ${JSON.stringify(forcePositive ?? null)};
      let raw = [];
      
      // Determine if price is up or down based on first and last prices
      // Use a more robust approach: if we have enough data, compare recent vs earlier prices
      let isPositive = true;
      if (typeof forced === 'boolean') {
        isPositive = forced;
      } else if (raw.length > 1) {
        const firstPrice = raw[0].close;
        const lastPrice = raw[raw.length - 1].close;
        isPositive = lastPrice >= firstPrice;
      }
      const lineColor = isPositive ? '#16a34a' : '#dc2626'; // Green for up, red for down
      
      if (type === 'area') {
        mainSeries = addSeriesCompat('area', { 
          lineColor: lineColor, 
          topColor: isPositive ? 'rgba(22,163,74,0.4)' : 'rgba(220,38,38,0.4)', 
          bottomColor: isPositive ? 'rgba(22,163,74,0.05)' : 'rgba(220,38,38,0.05)',
          lineWidth: 2
        });
      } else if (type === 'line') {
        mainSeries = addSeriesCompat('line', { 
          color: lineColor, 
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
      
      function applySeriesData(initial){
        try {
          raw = Array.isArray(initial) ? initial : [];
          const seriesData = (type === 'area' || type === 'line')
            ? raw.map(d => ({ time: d.time, value: d.close }))
            : raw;
          mainSeries.setData(seriesData);
          try { updateSeriesColorByData(); } catch(_) {}
        } catch(e) { log('applySeriesData error: ' + e.message); }
      }
      applySeriesData(raw);
      
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

      // Moving averages computed within webview on updates
      const showMAs = ${JSON.stringify(showMA)};
      let ma20Series = null;
      let ma50Series = null;
      function calculateMAForRaw(source, period) {
        try {
          if (!Array.isArray(source) || source.length === 0 || period <= 1) return [];
          const result = [];
          for (let i = 0; i < source.length; i++) {
            if (i < period - 1) continue;
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) sum += Number(source[j].close || 0);
            result.push({ time: source[i].time, value: sum / period });
          }
          return result;
        } catch(_) { return []; }
      }
      function updateMovingAverages(){
        if (!showMAs) return;
        try {
          const ma20Data = calculateMAForRaw(raw, ${maPeriods[0] || 20});
          const ma50Data = calculateMAForRaw(raw, ${maPeriods[1] || 50});
          if (ma20Data.length > 0) {
            if (!ma20Series) {
              ma20Series = chart.addLineSeries({
                color: '#f59e0b',
                lineWidth: 2,
                title: 'MA20',
                priceLineVisible: false,
                crosshairMarkerVisible: false
              });
            }
            ma20Series.setData(ma20Data);
          }
          if (ma50Data.length > 0) {
            if (!ma50Series) {
              ma50Series = chart.addLineSeries({
                color: '#8b5cf6',
                lineWidth: 2,
                title: 'MA50',
                priceLineVisible: false,
                crosshairMarkerVisible: false
              });
            }
            ma50Series.setData(ma50Data);
          }
        } catch(_) {}
      }

      // Volume histogram (use forced up/down for consistency)
      ${
        showVolume
          ? `
        const volumeSeries = addSeriesCompat('histogram', {
          color: '#94a3b8',
          priceFormat: { type: 'volume' },
          priceScaleId: '',
          scaleMargins: { top: 0.7, bottom: 0 }
        });
        
        function setVolumeData(){
          try {
            const volumeData = raw.map(d => ({
              time: d.time,
              value: d.volume,
              color: (d.close >= d.open) ? 'rgba(22,163,74,0.5)' : 'rgba(220,38,38,0.5)'
            }));
            volumeSeries.setData(volumeData);
          } catch(_) {}
        }
        setVolumeData();
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
      const trade = ${JSON.stringify(tradePlan || null)};
      function computeEffective() {
        try {
          if (trade && typeof trade === 'object') {
            const lv = {};
            if (trade.entry != null) lv.entry = Number(trade.entry);
            if (trade.lateEntry != null) lv.entryExtended = Number(trade.lateEntry);
            if (trade.exit != null) lv.exit = Number(trade.exit);
            if (trade.lateExit != null) lv.exitExtended = Number(trade.lateExit);
            return { levels: lv, side: (trade.side === 'short' ? 'short' : 'long') };
          }
        } catch(_) {}
        return { levels: levels || {}, side: 'long' };
      }
      function addLevelLines() {
        try {
          const eff = computeEffective();
          const lv = eff.levels || {};
          // Titles are consistent regardless of side for clarity
          if (lv.entry != null) addPriceLine(lv.entry, '#10B981', 'Entry');
          if (lv.entryExtended != null) addPriceLine(lv.entryExtended, '#14b8a6', 'Late Entry');
          if (lv.exit != null) addPriceLine(lv.exit, '#EF4444', 'Exit');
          if (lv.exitExtended != null) addPriceLine(lv.exitExtended, '#F97316', 'Late Exit');
        } catch(_) {}
      }

      // Placeholder for any future overlays (no-op)
      function updateZones(){}

      // Update line/area colors based on data or forced flag
      function updateSeriesColorByData(){
        try {
          if (!(type === 'area' || type === 'line')) return;
          let positive = true;
          if (typeof forced === 'boolean') {
            positive = forced;
          } else if (Array.isArray(raw) && raw.length > 1) {
            const firstPrice = Number(raw[0]?.close || 0);
            const lastPrice = Number(raw[raw.length - 1]?.close || 0);
            positive = lastPrice >= firstPrice;
          }
          const lc = positive ? '#16a34a' : '#dc2626';
          if (type === 'area') {
            mainSeries.applyOptions({
              lineColor: lc,
              topColor: positive ? 'rgba(22,163,74,0.4)' : 'rgba(220,38,38,0.4)',
              bottomColor: positive ? 'rgba(22,163,74,0.05)' : 'rgba(220,38,38,0.05)'
            });
          } else if (type === 'line') {
            mainSeries.applyOptions({ color: lc });
          }
        } catch(_) {}
      }

      // Initial fit on load
      setTimeout(() => {
        try { chart.timeScale().fitContent(); } catch(_) {}
        addLevelLines();
      }, 100);
      
      // No overlay sync needed for price lines
      
      // Initial draw and a couple of delayed retries in case scale isn't ready yet
      updateZones();
      setTimeout(updateZones, 250);
      setTimeout(updateZones, 800);
      
      // RN -> Web command handler
      function appendSeriesData(items){
        try {
          if (!Array.isArray(items) || items.length === 0) return;
          for (var i=0;i<items.length;i++) {
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
                // Rare: out-of-order — find/replace by time
                var idx = raw.findIndex(function(x){ return x && x.time === d.time; });
                if (idx >= 0) raw[idx] = d; else raw.push(d);
                raw.sort(function(a,b){ return a.time - b.time; });
              }
            }
            if (type === 'area' || type === 'line') {
              mainSeries.update({ time: d.time, value: d.close });
            } else {
              mainSeries.update(d);
            }
          }
          try { if (typeof setVolumeData === 'function') setVolumeData(); } catch(_) {}
          try { if (typeof updateMovingAverages === 'function') updateMovingAverages(); } catch(_) {}
          try { updateSeriesColorByData(); } catch(_) {}
        } catch(e) { log('appendSeriesData error: ' + e.message); }
      }
      window.addEventListener('message', function(event){
        try {
          const msg = JSON.parse(event.data);
          if (!msg || !msg.cmd) return;
          if (msg.cmd === 'setData') {
            let preserve = null;
            try { preserve = chart.timeScale().getVisibleLogicalRange && chart.timeScale().getVisibleLogicalRange(); } catch(_) {}
            applySeriesData(msg.data || []);
            try { if (typeof setVolumeData === 'function') setVolumeData(); } catch(_) {}
            try { if (typeof updateMovingAverages === 'function') updateMovingAverages(); } catch(_) {}
            try { if (preserve && chart.timeScale().setVisibleLogicalRange) chart.timeScale().setVisibleLogicalRange(preserve); } catch(_) {}
          } else if (msg.cmd === 'appendData') {
            appendSeriesData(msg.data || []);
          } else if (msg.cmd === 'scrollToRealTime') {
            try { chart.timeScale().scrollToRealTime(); } catch(_) {}
          }
        } catch(e) { log('message handler error: ' + e.message); }
      });

      // Forward visible range changes to RN
      try {
        chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
          if (!range || range.from == null || range.to == null) return;
          const fromMs = Math.round(range.from * 1000);
          const toMs = Math.round(range.to * 1000);
          try {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              visibleRange: { fromMs, toMs }
            }));
          } catch(_) {}
        });
      } catch(_) {}

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
  </body></html>`,
      [inlineLibText, height, theme, showVolume, showGrid, showCrosshair, type]
    );

    // Push data updates to WebView when RN data changes and web is ready
    // Reset ready state when HTML re-initializes to avoid premature posts
    useEffect(() => {
      setIsReady(false);
      lastPushedTimeRef.current = null;
      lastFirstTimeRef.current = null;
    }, [html]);

    // Prefer incremental appends to avoid viewport resets
    useEffect(() => {
      if (!isReady || !webRef.current) return;
      if (!series || series.length === 0) return;
      // If we haven't pushed initial data via onReady yet, wait
      if (lastPushedTimeRef.current == null) return;
      try {
        const lastTime = lastPushedTimeRef.current as number;
        const latest = series[series.length - 1];
        if (!latest) return;
        // Detect spacing change or shrink (e.g., timeframe switch)
        const prevLen = lastLengthRef.current || 0;
        const prevSpacing = lastSpacingRef.current;
        const prevFirst = lastFirstTimeRef.current;
        const newFirst = series[0]?.time ?? null;
        const newSpacing =
          series.length >= 2
            ? series[series.length - 1].time - series[series.length - 2].time
            : null;
        const spacingChanged =
          prevSpacing != null &&
          newSpacing != null &&
          Math.abs(newSpacing - prevSpacing) > Math.max(1, prevSpacing * 0.2);
        const lengthShrank = series.length < prevLen;
        const extendedLeft =
          newFirst != null && prevFirst != null && newFirst < prevFirst;

        if (spacingChanged || lengthShrank || extendedLeft) {
          (webRef.current as any)?.postMessage?.(
            JSON.stringify({ cmd: "setData", data: series })
          );
          lastPushedTimeRef.current = latest.time;
          lastSpacingRef.current = newSpacing ?? null;
          lastLengthRef.current = series.length;
          lastFirstTimeRef.current = newFirst;
          return;
        }

        // Case 1: same candle is being updated (e.g., in-progress bar)
        if (latest.time === lastTime) {
          (webRef.current as any)?.postMessage?.(
            JSON.stringify({ cmd: "appendData", data: [latest] })
          );
          return;
        }

        // Case 2: new bars appended
        if (latest.time > lastTime) {
          const newBars = series.filter((b) => b.time > lastTime);
          if (newBars.length > 0 && newBars.length <= 500) {
            (webRef.current as any)?.postMessage?.(
              JSON.stringify({ cmd: "appendData", data: newBars })
            );
          } else {
            (webRef.current as any)?.postMessage?.(
              JSON.stringify({ cmd: "setData", data: series })
            );
          }
          lastPushedTimeRef.current = latest.time;
          lastSpacingRef.current = newSpacing ?? lastSpacingRef.current;
          lastLengthRef.current = series.length;
          lastFirstTimeRef.current = newFirst ?? lastFirstTimeRef.current;
          return;
        }

        // Case 3: no change or older data -> do nothing to preserve viewport
      } catch (_) {}
    }, [isReady, series]);

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
          domStorageEnabled={true}
          bounces={false}
          overScrollMode="never"
          decelerationRate="normal"
          startInLoadingState={false}
          scalesPageToFit={false}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          ref={webRef}
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg?.ready) {
                setIsReady(true);
                if (onReady) onReady();
                try {
                  (webRef.current as any)?.postMessage?.(
                    JSON.stringify({ cmd: "setData", data: series })
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
              } else {
                console.log("LightweightCandles WebView message:", msg);
              }
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
);

export default LightweightCandles;
