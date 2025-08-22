import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

interface DataPoint {
  time: number; // epoch ms
  value: number;
}

interface ExtraSeriesData {
  data: DataPoint[];
  color?: string;
  name?: string;
}

interface SimpleLineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  strokeWidth?: number;
  extraSeries?: ExtraSeriesData[];
  showFill?: boolean;
}

export default function AmChartsLine({
  data,
  height = 200,
  color = "#00D4AA",
  strokeWidth = 2,
  extraSeries = [],
  showFill = true,
}: SimpleLineChartProps) {
  const webRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);

  const series = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((d) => ({
      time: Math.floor(d.time / 1000), // Convert to seconds
      value: Number(d.value) || 0,
    }));
  }, [data]);

  const html = useMemo(
    () => `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <script src="https://cdn.amcharts.com/lib/5/index.js"></script>
    <script src="https://cdn.amcharts.com/lib/5/xy.js"></script>
    <script src="https://cdn.amcharts.com/lib/5/themes/Animated.js"></script>
    <style>
      html,body,#wrap{margin:0;padding:0;height:100%;width:100%;background:transparent;overscroll-behavior:none;}
      body{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}
      #wrap{overflow:hidden;}
      #chartdiv{position:relative;height:100%;width:100%;overflow:hidden;}
    </style>
    </head><body>
    <div id="wrap">
      <div id="chartdiv"></div>
    </div>
    <script>
      function initChart() {
        try {
          if (!window.am5) {
            throw new Error('amCharts library not available');
          }
          
          const container = document.getElementById('chartdiv');
          if (!container) {
            throw new Error('Chart container not found');
          }
          
          // Create root element
          let root = am5.Root.new("chartdiv");
          
          // Set themes
          root.setThemes([am5themes_Animated.new(root)]);
          
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
          
          // Create axes
          let xAxis = chart.xAxes.push(am5xy.DateAxis.new(root, {
            maxDeviation: 0.2,
            baseInterval: {
              timeUnit: "second",
              count: 1
            },
            renderer: am5xy.AxisRendererX.new(root, {
              minorGridEnabled: false,
              minGridDistance: 50
            }),
            tooltip: am5.Tooltip.new(root, {})
          }));
          
          let yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {
              pan: "zoom"
            })
          }));
          
          // Create main series
          let mainSeries = chart.series.push(am5xy.LineSeries.new(root, {
            name: "Value",
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "value",
            valueXField: "date",
            stroke: am5.color("${color}"),
            strokeWidth: ${strokeWidth},
            tooltip: am5.Tooltip.new(root, {
              labelText: "{valueY}"
            })
          }));
          
          ${
            showFill
              ? `
          mainSeries.fills.template.setAll({
            fillOpacity: 0.3,
            visible: true
          });
          `
              : ""
          }
          
          // Extra series
          const extraSeriesConfigs = ${JSON.stringify(extraSeries)};
          const extraSeriesInstances = [];
          
          extraSeriesConfigs.forEach((config, index) => {
            const series = chart.series.push(am5xy.LineSeries.new(root, {
              name: config.name || \`Series \${index + 1}\`,
              xAxis: xAxis,
              yAxis: yAxis,
              valueYField: "value",
              valueXField: "date",
              stroke: am5.color(config.color || "#666"),
              strokeWidth: ${strokeWidth},
              tooltip: am5.Tooltip.new(root, {
                labelText: "{valueY}"
              })
            }));
            extraSeriesInstances.push(series);
          });
          
          function applySeriesData(mainData, extraData = []) {
            try {
              // Convert data format for amCharts
              const chartData = mainData.map(d => ({
                date: d.time * 1000, // Convert to milliseconds
                value: d.value
              }));
              
              mainSeries.data.setAll(chartData);
              
              // Set extra series data
              extraData.forEach((seriesData, index) => {
                if (extraSeriesInstances[index] && seriesData.data) {
                  const extraChartData = seriesData.data.map(d => ({
                    date: d.time * 1000,
                    value: d.value
                  }));
                  extraSeriesInstances[index].data.setAll(extraChartData);
                }
              });
              
            } catch(e) { 
              console.error('applySeriesData error:', e.message); 
            }
          }
          
          // Initial data
          const initialData = ${JSON.stringify(series)};
          const initialExtraData = ${JSON.stringify(extraSeries)};
          applySeriesData(initialData, initialExtraData);
          
          // Auto-fit content
          setTimeout(() => {
            try {
              xAxis.zoomToValues(xAxis.getPrivate("min"), xAxis.getPrivate("max"));
            } catch(_) {}
          }, 100);
          
          // Message handler
          window.addEventListener('message', function(event) {
            try {
              const msg = JSON.parse(event.data);
              if (!msg || !msg.cmd) return;
              
              if (msg.cmd === 'setData') {
                applySeriesData(msg.data || [], msg.extraData || []);
              }
            } catch(e) { 
              console.error('message handler error:', e.message); 
            }
          });
          
          // Post ready message
          try {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ 
              ready: true
            }));
          } catch (e) {
            console.error('postMessage error:', e.message);
          }
          
        } catch (globalError) {
          console.error('Global error:', globalError.message);
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
            console.error('Library load timeout');
          }
        }, 100);
      }
    </script>
  </body></html>`,
    [height, color, strokeWidth, showFill, series, extraSeries]
  );

  // Update chart when data changes
  useEffect(() => {
    if (!isReady || !webRef.current) return;

    (webRef.current as any)?.postMessage?.(
      JSON.stringify({
        cmd: "setData",
        data: series,
        extraData: extraSeries,
      })
    );
  }, [isReady, series, extraSeries]);

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
        cacheEnabled={true}
        incognito={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        allowsInlineMediaPlayback={false}
        mediaPlaybackRequiresUserAction={true}
        ref={webRef}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg?.ready) {
              setIsReady(true);
            } else {
              console.log("AmChartsLine WebView message:", msg);
            }
          } catch {
            console.log("AmChartsLine WebView message:", e.nativeEvent.data);
          }
        }}
        onError={(e) => {
          console.warn("AmChartsLine WebView error:", e.nativeEvent);
        }}
      />
    </View>
  );
}
