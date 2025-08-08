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
      html,body,#wrap{margin:0;padding:0;height:100%;}
      #c{position:relative;height:100%;}
      #t{position:absolute;left:12px;top:12px;padding:8px 12px;border-radius:12px;font:13px -apple-system,Segoe UI,Roboto,Helvetica,Arial;background:rgba(17,24,39,.9);color:#ffffff;z-index:10;box-shadow:0 8px 25px rgba(0,0,0,0.15);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.1);}
      #controls{position:absolute;right:12px;top:12px;z-index:10;display:flex;gap:8px;}
      .btn{padding:6px 12px;border:none;border-radius:8px;font:12px -apple-system,Segoe UI,Roboto,Helvetica,Arial;cursor:pointer;background:rgba(17,24,39,.8);color:#ffffff;transition:all 0.2s;}
      .btn:hover{background:rgba(37,99,235,.8);}
      .btn.active{background:#2563eb;}
    </style>
    </head><body>
    <div id="wrap">
      <div id="c">
        <div id="t" style="display:none"></div>
        <div id="controls">
          <button class="btn" onclick="chart.timeScale().fitContent()">Fit</button>
          <button class="btn" onclick="resetZoom()">Reset</button>
        </div>
      </div>
    </div>
    <script src="https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js"></script>
    <script>
      const dark = ${JSON.stringify(theme)} === 'dark';
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

      const chart = LightweightCharts.createChart(document.getElementById('c'), chartOptions);
      
      let mainSeries;
      const type = ${JSON.stringify(type)};
      
      if (type === 'area') {
        mainSeries = chart.addAreaSeries({ 
          lineColor: '#2563eb', 
          topColor: 'rgba(37,99,235,0.4)', 
          bottomColor: 'rgba(37,99,235,0.05)',
          lineWidth: 2
        });
      } else if (type === 'line') {
        mainSeries = chart.addLineSeries({ 
          color: '#2563eb', 
          lineWidth: 3,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 6
        });
      } else if (type === 'bar') {
        mainSeries = chart.addBarSeries({ 
          upColor: '#16a34a', 
          downColor: '#dc2626',
          openVisible: true,
          thinBars: false
        });
      } else {
        mainSeries = chart.addCandlestickSeries({ 
          upColor: '#16a34a', 
          downColor: '#dc2626', 
          wickUpColor: '#16a34a', 
          wickDownColor: '#dc2626', 
          borderVisible: false 
        });
      }
      
      const data = ${JSON.stringify(series)};
      mainSeries.setData(data);

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
        const volumeSeries = chart.addHistogramSeries({
          color: '#94a3b8',
          priceFormat: { type: 'volume' },
          priceScaleId: '',
          scaleMargins: { top: 0.7, bottom: 0 }
        });
        
        const volumeData = data.map(d => ({
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

      // Auto-fit content on load
      setTimeout(() => {
        chart.timeScale().fitContent();
      }, 100);

      // Handle window resize
      function handleResize() {
        chart.applyOptions({ width: document.getElementById('c').clientWidth });
      }
      
      window.addEventListener('resize', handleResize);
      
      // Post ready message
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ 
        ready: true, 
        count: data.length,
        type: type
      }));
    </script>
  </body></html>`;

  return (
    <View
      className="rounded-xl overflow-hidden bg-white dark:bg-gray-800"
      style={{ height }}
    >
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ height }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
