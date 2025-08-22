import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import { Ionicons } from "@expo/vector-icons";
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
type TimeFrame = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y";

interface Props {
  data: LWCDatum[];
  symbol: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  height?: number;
  onTimeFrameChange?: (timeFrame: TimeFrame) => void;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0a0a0a",
    borderRadius: 8,
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  symbolText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  priceText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  changeText: {
    fontSize: 14,
    fontWeight: "500",
  },
  changePositive: {
    color: "#00d4aa",
  },
  changeNegative: {
    color: "#ff6b6b",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  timeFrameContainer: {
    flexDirection: "row",
    gap: 4,
  },
  timeFrameButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "#2a2a2a",
  },
  timeFrameButtonActive: {
    backgroundColor: "#00d4aa",
  },
  timeFrameText: {
    color: "#999",
    fontSize: 12,
    fontWeight: "500",
  },
  timeFrameTextActive: {
    color: "white",
  },
  chartTypeContainer: {
    flexDirection: "row",
    gap: 4,
  },
  chartTypeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#2a2a2a",
  },
  chartTypeButtonActive: {
    backgroundColor: "#0066ff",
  },
  indicatorsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  indicatorButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444",
  },
  indicatorButtonActive: {
    backgroundColor: "#333",
    borderColor: "#00d4aa",
  },
  indicatorText: {
    color: "#999",
    fontSize: 11,
    fontWeight: "500",
  },
  indicatorTextActive: {
    color: "#00d4aa",
  },
  chartContainer: {
    height: 400,
  },
});

export default function AdvancedTradingChart({
  data,
  symbol,
  currentPrice,
  priceChange,
  priceChangePercent,
  height = 400,
  onTimeFrameChange,
}: Props) {
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>("1D");
  const [selectedChartType, setSelectedChartType] =
    useState<ChartType>("candlestick");
  const [activeIndicators, setActiveIndicators] = useState({
    EMA: true,
    VWAP: true,
    Volume: true,
    MACD: false,
    RSI: false,
  });

  const timeFrames: TimeFrame[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y"];
  const chartTypes: { type: ChartType; icon: string }[] = [
    { type: "candlestick", icon: "analytics" },
    { type: "line", icon: "trending-up" },
    { type: "area", icon: "triangle" },
    { type: "bar", icon: "bar-chart" },
  ];

  const indicators = [
    { key: "EMA", label: "EMA", color: "#ffa500" },
    { key: "VWAP", label: "VWAP", color: "#9c27b0" },
    { key: "Volume", label: "Volume", color: "#666" },
    { key: "MACD", label: "MACD", color: "#2196f3" },
    { key: "RSI", label: "RSI", color: "#ff9800" },
  ];

  const series = useMemo(
    () =>
      data.map((d) => ({
        time: Math.floor(d.time / 1000),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume || Math.random() * 1000000,
      })),
    [data]
  );

  const calculateEMA = (data: any[], period: number) => {
    const result: any[] = [];
    const multiplier = 2 / (period + 1);
    let ema = data[0]?.close || 0;

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        ema = data[i].close;
      } else {
        ema = (data[i].close - ema) * multiplier + ema;
      }
      result.push({ time: data[i].time, value: ema });
    }
    return result;
  };

  const calculateVWAP = (data: any[]) => {
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    return data.map((d) => {
      const typicalPrice = (d.high + d.low + d.close) / 3;
      cumulativeTPV += typicalPrice * d.volume;
      cumulativeVolume += d.volume;

      return {
        time: d.time,
        value: cumulativeTPV / cumulativeVolume,
      };
    });
  };

  const calculateMACD = (data: any[]) => {
    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);

    const macdLine = ema12.map((ema12Point, i) => ({
      time: ema12Point.time,
      value: ema12Point.value - ema26[i].value,
    }));

    const signalLine = calculateEMA(macdLine, 9);

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine.map((macdPoint, i) => ({
        time: macdPoint.time,
        value: macdPoint.value - (signalLine[i]?.value || 0),
      })),
    };
  };

  const calculateRSI = (data: any[], period: number = 14) => {
    const result: any[] = [];

    for (let i = period; i < data.length; i++) {
      let gains = 0;
      let losses = 0;

      for (let j = i - period; j < i; j++) {
        const change = data[j + 1].close - data[j].close;
        if (change > 0) gains += change;
        else losses -= change;
      }

      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);

      result.push({ time: data[i].time, value: rsi });
    }

    return result;
  };

  const ema20 = calculateEMA(series, 20);
  const ema50 = calculateEMA(series, 50);
  const vwap = calculateVWAP(series);
  const macd = calculateMACD(series);
  const rsi = calculateRSI(series);

  const handleTimeFramePress = (timeFrame: TimeFrame) => {
    setSelectedTimeFrame(timeFrame);
    onTimeFrameChange?.(timeFrame);
  };

  const toggleIndicator = (key: string) => {
    setActiveIndicators((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
  };

  const isPositive = priceChange >= 0;

  // Prefer local Expo asset stored as .txt; inject inline; CDN fallback
  const [inlineLibText, setInlineLibText] = useState<string | null>(null);
  React.useEffect(() => {
    (async () => {
      try {
        if (__DEV__)
          console.log("AdvancedTradingChart: Starting to load local asset...");
        const lib = Asset.fromModule(
          require("../../../assets/js/lightweight-charts.txt")
        );
        await lib.downloadAsync();
        const uri = lib.localUri || lib.uri;
        if (__DEV__) console.log("AdvancedTradingChart: Asset URI:", uri);
        if (uri) {
          const content = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          if (__DEV__)
            console.log(
              "AdvancedTradingChart: Content length:",
              content?.length
            );
          if (__DEV__)
            console.log(
              "AdvancedTradingChart: Contains LightweightCharts:",
              content?.includes("LightweightCharts")
            );
          if (content && content.includes("LightweightCharts")) {
            if (__DEV__) console.log("AdvancedTradingChart: Using local asset");
            setInlineLibText(content);
          } else {
            if (__DEV__)
              console.log(
                "AdvancedTradingChart: Local asset invalid, falling back to CDN"
              );
            setInlineLibText(null);
          }
        }
      } catch (e) {
        if (__DEV__)
          console.log("AdvancedTradingChart: Error loading local asset:", e);
        setInlineLibText(null);
      }
    })();
  }, []);
  const libSrc =
    "https://unpkg.com/lightweight-charts@5.0.0/dist/lightweight-charts.standalone.production.js";
  const scriptLoader = inlineLibText
    ? `<script>${
        __DEV__
          ? "console.log('AdvancedTradingChart: Using inline script');"
          : ""
      }(function(){try{var s=document.createElement('script');s.type='text/javascript';s.text=${JSON.stringify(
        inlineLibText
      )};document.head.appendChild(s);}catch(e){${
        __DEV__
          ? "console.log('AdvancedTradingChart: Error injecting inline script:', e);"
          : ""
      }})();</script>`
    : `<script>${
        __DEV__ ? "console.log('AdvancedTradingChart: Using CDN script');" : ""
      }</script><script src="${libSrc}"></script>`;

  const html = `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,body,#wrap{margin:0;padding:0;height:100%;width:100%;background:#0a0a0a;}
      #c{position:relative;height:100%;width:100%;}
      #volume{position:relative;height:100px;width:100%;margin-top:5px;}
      #macd{position:relative;height:80px;width:100%;margin-top:5px;}
      #rsi{position:relative;height:60px;width:100%;margin-top:5px;}
      .chart-section{border-top:1px solid #333;}
    </style>
    </head><body>
    <div id="wrap">
      <div id="c"></div>
      ${
        activeIndicators.Volume
          ? '<div id="volume" class="chart-section"></div>'
          : ""
      }
      ${
        activeIndicators.MACD
          ? '<div id="macd" class="chart-section"></div>'
          : ""
      }
      ${
        activeIndicators.RSI ? '<div id="rsi" class="chart-section"></div>' : ""
      }
    </div>
    ${scriptLoader}
    <script>
      function initChart() {
        try {
          if (!window.LightweightCharts) return;
          
          const mainHeight = ${
            activeIndicators.Volume ||
            activeIndicators.MACD ||
            activeIndicators.RSI
              ? height - 100
              : height
          };
          
          // Main chart
          const chartOptions = {
            height: mainHeight,
            layout: { 
              textColor: '#d1d4dc', 
              background: { type: 'solid', color: '#0a0a0a' },
              fontSize: 11,
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
              horzLines: { color: '#1a1a1a' }, 
              vertLines: { color: '#1a1a1a' } 
            },
            crosshair: { 
              mode: LightweightCharts.CrosshairMode.Normal,
              vertLine: { width: 1, color: '#333', style: LightweightCharts.LineStyle.Dashed },
              horzLine: { width: 1, color: '#333', style: LightweightCharts.LineStyle.Dashed }
            }
          };

          const container = document.getElementById('c');
          const chart = LightweightCharts.createChart(container, chartOptions);
          
          // Main series
          const raw = ${JSON.stringify(series)};
          let mainSeries;
          
          if ('${selectedChartType}' === 'candlestick') {
            mainSeries = chart.addCandlestickSeries({ 
              upColor: '#00d4aa', 
              downColor: '#ff6b6b', 
              wickUpColor: '#00d4aa', 
              wickDownColor: '#ff6b6b', 
              borderVisible: false 
            });
            mainSeries.setData(raw);
          } else if ('${selectedChartType}' === 'line') {
            mainSeries = chart.addLineSeries({ 
              color: '#00d4aa', 
              lineWidth: 2
            });
            mainSeries.setData(raw.map(d => ({ time: d.time, value: d.close })));
          } else if ('${selectedChartType}' === 'area') {
            mainSeries = chart.addAreaSeries({ 
              lineColor: '#00d4aa', 
              topColor: 'rgba(0, 212, 170, 0.4)', 
              bottomColor: 'rgba(0, 212, 170, 0.05)',
              lineWidth: 2
            });
            mainSeries.setData(raw.map(d => ({ time: d.time, value: d.close })));
          } else if ('${selectedChartType}' === 'bar') {
            mainSeries = chart.addBarSeries({ 
              upColor: '#00d4aa', 
              downColor: '#ff6b6b'
            });
            mainSeries.setData(raw);
          }

          // Add indicators to main chart
          ${
            activeIndicators.EMA
              ? `
            const ema20Series = chart.addLineSeries({
              color: '#ffa500',
              lineWidth: 1,
              priceLineVisible: false,
              crosshairMarkerVisible: false
            });
            ema20Series.setData(${JSON.stringify(ema20)});
            
            const ema50Series = chart.addLineSeries({
              color: '#ff4500',
              lineWidth: 1,
              priceLineVisible: false,
              crosshairMarkerVisible: false
            });
            ema50Series.setData(${JSON.stringify(ema50)});
          `
              : ""
          }

          ${
            activeIndicators.VWAP
              ? `
            const vwapSeries = chart.addLineSeries({
              color: '#9c27b0',
              lineWidth: 1,
              priceLineVisible: false,
              crosshairMarkerVisible: false,
              lineStyle: LightweightCharts.LineStyle.Dashed
            });
            vwapSeries.setData(${JSON.stringify(vwap)});
          `
              : ""
          }

          // Volume chart
          ${
            activeIndicators.Volume
              ? `
            const volumeContainer = document.getElementById('volume');
            const volumeChart = LightweightCharts.createChart(volumeContainer, {
              height: 100,
              layout: { 
                textColor: '#d1d4dc', 
                background: { type: 'solid', color: '#0a0a0a' },
                fontSize: 10,
                attributionLogo: false
              },
              rightPriceScale: { 
                borderVisible: false,
                scaleMargins: { top: 0.1, bottom: 0.1 }
              },
              timeScale: { 
                borderVisible: false,
                visible: false
              },
              grid: { 
                horzLines: { color: '#1a1a1a' }, 
                vertLines: { color: 'transparent' } 
              }
            });
            
            const volumeSeries = volumeChart.addHistogramSeries({
              color: '#666',
              priceFormat: { type: 'volume' }
            });
            
            const volumeData = raw.map(d => ({
              time: d.time,
              value: d.volume,
              color: d.close >= d.open ? 'rgba(0, 212, 170, 0.7)' : 'rgba(255, 107, 107, 0.7)'
            }));
            
            volumeSeries.setData(volumeData);
            chart.timeScale().subscribeVisibleTimeRangeChange(() => {
              volumeChart.timeScale().setVisibleRange(chart.timeScale().getVisibleRange());
            });
          `
              : ""
          }

          // MACD chart
          ${
            activeIndicators.MACD
              ? `
            const macdContainer = document.getElementById('macd');
            const macdChart = LightweightCharts.createChart(macdContainer, {
              height: 80,
              layout: { 
                textColor: '#d1d4dc', 
                background: { type: 'solid', color: '#0a0a0a' },
                fontSize: 10,
                attributionLogo: false
              },
              rightPriceScale: { 
                borderVisible: false,
                scaleMargins: { top: 0.1, bottom: 0.1 }
              },
              timeScale: { 
                borderVisible: false,
                visible: false
              },
              grid: { 
                horzLines: { color: '#1a1a1a' }, 
                vertLines: { color: 'transparent' } 
              }
            });
            
            const macdData = ${JSON.stringify(macd)};
            
            const macdLineSeries = macdChart.addLineSeries({
              color: '#2196f3',
              lineWidth: 1
            });
            macdLineSeries.setData(macdData.macd);
            
            const signalLineSeries = macdChart.addLineSeries({
              color: '#ff9800',
              lineWidth: 1
            });
            signalLineSeries.setData(macdData.signal);
            
            const histogramSeries = macdChart.addHistogramSeries({
              color: '#666'
            });
            histogramSeries.setData(macdData.histogram.map(d => ({
              ...d,
              color: d.value >= 0 ? 'rgba(0, 212, 170, 0.7)' : 'rgba(255, 107, 107, 0.7)'
            })));
            
            chart.timeScale().subscribeVisibleTimeRangeChange(() => {
              macdChart.timeScale().setVisibleRange(chart.timeScale().getVisibleRange());
            });
          `
              : ""
          }

          // RSI chart
          ${
            activeIndicators.RSI
              ? `
            const rsiContainer = document.getElementById('rsi');
            const rsiChart = LightweightCharts.createChart(rsiContainer, {
              height: 60,
              layout: { 
                textColor: '#d1d4dc', 
                background: { type: 'solid', color: '#0a0a0a' },
                fontSize: 10,
                attributionLogo: false
              },
              rightPriceScale: { 
                borderVisible: false,
                scaleMargins: { top: 0.1, bottom: 0.1 }
              },
              timeScale: { 
                borderVisible: false,
                visible: false
              },
              grid: { 
                horzLines: { color: '#1a1a1a' }, 
                vertLines: { color: 'transparent' } 
              }
            });
            
            // Add reference lines for RSI
            const rsiUpperLine = rsiChart.addLineSeries({
              color: '#666',
              lineWidth: 1,
              lineStyle: LightweightCharts.LineStyle.Dashed,
              priceLineVisible: false,
              crosshairMarkerVisible: false
            });
            
            const rsiLowerLine = rsiChart.addLineSeries({
              color: '#666',
              lineWidth: 1,
              lineStyle: LightweightCharts.LineStyle.Dashed,
              priceLineVisible: false,
              crosshairMarkerVisible: false
            });
            
            const rsiSeries = rsiChart.addLineSeries({
              color: '#ff9800',
              lineWidth: 1
            });
            
            const rsiData = ${JSON.stringify(rsi)};
            rsiSeries.setData(rsiData);
            
            // Add 70 and 30 reference lines
            if (rsiData.length > 0) {
              const firstTime = rsiData[0].time;
              const lastTime = rsiData[rsiData.length - 1].time;
              rsiUpperLine.setData([{time: firstTime, value: 70}, {time: lastTime, value: 70}]);
              rsiLowerLine.setData([{time: firstTime, value: 30}, {time: lastTime, value: 30}]);
            }
            
            chart.timeScale().subscribeVisibleTimeRangeChange(() => {
              rsiChart.timeScale().setVisibleRange(chart.timeScale().getVisibleRange());
            });
          `
              : ""
          }

          // Sync time scales and fit content
          setTimeout(() => {
            chart.applyOptions({ width: container.clientWidth });
            chart.timeScale().fitContent();
            
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ 
              ready: true, 
              count: raw.length 
            }));
          }, 100);

        } catch (error) {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ 
            error: error.message 
          }));
        }
      }
      
      if (window.LightweightCharts) {
        initChart();
      } else {
        let attempts = 0;
        const checkForLibrary = setInterval(() => {
          attempts++;
          if (window.LightweightCharts) {
            clearInterval(checkForLibrary);
            initChart();
          } else if (attempts > 50) {
            clearInterval(checkForLibrary);
          }
        }, 100);
      }
    </script>
  </body></html>`;

  return (
    <View style={styles.container}>
      {/* Header with symbol and price info */}
      <View style={styles.header}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbolText}>{symbol}</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.priceText}>${currentPrice.toFixed(2)}</Text>
            <Text
              style={[
                styles.changeText,
                isPositive ? styles.changePositive : styles.changeNegative,
              ]}
            >
              {isPositive ? "+" : ""}${priceChange.toFixed(2)} (
              {isPositive ? "+" : ""}
              {priceChangePercent.toFixed(2)}%)
            </Text>
          </View>
        </View>

        {/* Time Frame Controls */}
        <View style={styles.controlsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.timeFrameContainer}>
              {timeFrames.map((timeFrame) => (
                <Pressable
                  key={timeFrame}
                  onPress={() => handleTimeFramePress(timeFrame)}
                  style={[
                    styles.timeFrameButton,
                    selectedTimeFrame === timeFrame &&
                      styles.timeFrameButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.timeFrameText,
                      selectedTimeFrame === timeFrame &&
                        styles.timeFrameTextActive,
                    ]}
                  >
                    {timeFrame}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Chart Type Controls */}
          <View style={styles.chartTypeContainer}>
            {chartTypes.map(({ type, icon }) => (
              <Pressable
                key={type}
                onPress={() => setSelectedChartType(type)}
                style={[
                  styles.chartTypeButton,
                  selectedChartType === type && styles.chartTypeButtonActive,
                ]}
              >
                <Ionicons
                  name={icon as any}
                  size={16}
                  color={selectedChartType === type ? "white" : "#999"}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Indicators */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.indicatorsRow}>
            {indicators.map((indicator) => (
              <Pressable
                key={indicator.key}
                onPress={() => toggleIndicator(indicator.key)}
                style={[
                  styles.indicatorButton,
                  activeIndicators[
                    indicator.key as keyof typeof activeIndicators
                  ] && styles.indicatorButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.indicatorText,
                    activeIndicators[
                      indicator.key as keyof typeof activeIndicators
                    ] && styles.indicatorTextActive,
                  ]}
                >
                  {indicator.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Chart */}
      <View style={[styles.chartContainer, { height }]}>
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
              if (__DEV__) console.log("AdvancedTradingChart message:", msg);
            } catch {
              if (__DEV__)
                console.log(
                  "AdvancedTradingChart message:",
                  e.nativeEvent.data
                );
            }
          }}
          onError={(e) => {
            console.warn("AdvancedTradingChart WebView error:", e.nativeEvent);
          }}
        />
      </View>
    </View>
  );
}
