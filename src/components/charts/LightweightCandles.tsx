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
}

export default function LightweightCandles({
  data,
  height = 320,
  type = "candlestick",
  theme = "light",
}: Props) {
  const series = useMemo(
    () =>
      data.map((d) => ({
        time: Math.floor(d.time / 1000),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })),
    [data]
  );

  const html = `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,body,#wrap{margin:0;padding:0;height:100%;}
      #c{position:relative;height:100%;}
      #t{position:absolute;left:8px;top:8px;padding:6px 8px;border-radius:8px;font:12px -apple-system,Segoe UI,Roboto,Helvetica,Arial;background:rgba(17,24,39,.85);color:#e5e7eb;z-index:2}
    </style>
    </head><body>
    <div id="wrap"><div id="c"><div id="t" style="display:none"></div></div></div>
    <script src="https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js"></script>
    <script>
      const dark = ${JSON.stringify(theme)} === 'dark';
      const chart = LightweightCharts.createChart(document.getElementById('c'), {
        height: ${height},
        layout: { textColor: dark ? '#e5e7eb' : '#111827', background: { type: 'solid', color: dark ? '#0b1220' : '#ffffff' } },
        rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible:true, secondsVisible:false },
        grid: { horzLines: { color: dark ? '#1f2937' : '#eef2f7' }, vertLines: { color: dark ? '#1f2937' : '#eef2f7' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      });
      let series;
      const type = ${JSON.stringify(type)};
      if (type === 'area') {
        series = chart.addAreaSeries({ lineColor:'#2563eb', topColor:'rgba(37,99,235,0.3)', bottomColor:'rgba(37,99,235,0.05)' });
      } else if (type === 'line') {
        series = chart.addLineSeries({ color:'#2563eb', lineWidth:2 });
      } else if (type === 'bar') {
        series = chart.addBarSeries({ upColor:'#16a34a', downColor:'#dc2626' });
      } else {
        series = chart.addCandlestickSeries({ upColor:'#16a34a', downColor:'#dc2626', wickUpColor:'#16a34a', wickDownColor:'#dc2626', borderVisible:false });
      }
      const data = ${JSON.stringify(series)};
      series.setData(data);

      // Volume pane
      let volSeries = chart.addHistogramSeries({ color: '#94a3b8', priceFormat: { type: 'volume' }, priceScaleId: '' });
      volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      volSeries.setData(data.map(d => ({ time: d.time, value: d.volume || 0, color: (d.close >= d.open) ? 'rgba(22,163,74,0.6)' : 'rgba(220,38,38,0.6)'})));

      // Crosshair tooltip
      const tip = document.getElementById('t');
      chart.subscribeCrosshairMove(param => {
        if (!param || !param.time || !param.point) { tip.style.display='none'; return; }
        const p = param.seriesPrices.get(series);
        if (p == null) { tip.style.display='none'; return; }
        const v = volSeries ? param.seriesPrices.get(volSeries) : null;
        const dt = new Date(param.time*1000);
        let open='', high='', low='', close='';
        if (typeof p === 'number') {
          close = Number(p).toFixed(2);
        } else {
          open = (p.open!=null) ? Number(p.open).toFixed(2) : '';
          high = (p.high!=null) ? Number(p.high).toFixed(2) : '';
          low  = (p.low!=null)  ? Number(p.low).toFixed(2)  : '';
          close= (p.close!=null)? Number(p.close).toFixed(2): '';
        }
        tip.innerHTML = dt.toLocaleDateString() + ' · ' + (open?('O '+open+' '):'') + (high?('H '+high+' '):'') + (low?('L '+low+' '):'') + 'C ' + close + (v?(' · Vol '+v):'');
        tip.style.display='block';
      });

      chart.timeScale().fitContent();
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ ready: true, count: data.length }));
    </script>
  </body></html>`;

  return (
    <View className="rounded-xl overflow-hidden" style={{ height }}>
      <WebView originWhitelist={["*"]} source={{ html }} style={{ height }} />
    </View>
  );
}
