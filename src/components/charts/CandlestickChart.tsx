import React, { useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Line as SvgLine, Rect, Path } from "react-native-svg";

export interface CandlestickDatum {
  x: Date;
  open: number;
  close: number;
  high: number;
  low: number;
}

interface Props {
  data: CandlestickDatum[];
  movingAverageWindows?: number[]; // e.g. [20, 50]
  targets?: { price: number; label: string; color?: string }[];
}

function computeSMA(values: number[], window: number): number[] {
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) {
      sum -= values[i - window];
    }
    if (i >= window - 1) {
      result.push(sum / window);
    } else {
      result.push(NaN);
    }
  }
  return result;
}

export default function CandlestickChart({
  data,
  movingAverageWindows = [20, 50],
  targets = [],
}: Props) {
  const [width, setWidth] = useState(0);
  const height = 280;

  if (!data || data.length === 0)
    return <View className="h-72 bg-gray-100 dark:bg-gray-900 rounded-xl" />;

  const margin = 16;
  const { minPrice, maxPrice } = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (d.low < min) min = d.low;
      if (d.high > max) max = d.high;
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;
    return { minPrice: min, maxPrice: max };
  }, [data]);
  const xStep = (width - margin * 2) / Math.max(1, data.length - 1);
  const candleW = Math.max(4, xStep * 0.6);

  const yScale = (p: number) => {
    const t = (p - minPrice) / Math.max(1e-9, maxPrice - minPrice);
    return height - margin - t * (height - margin * 2);
  };

  const closes = useMemo(() => data.map((d) => d.close), [data]);
  const seriesByWindow = useMemo(() => {
    const map: Record<number, { x: number; y: number }[]> = {};
    for (let wi = 0; wi < movingAverageWindows.length; wi++) {
      const w = movingAverageWindows[wi];
      const sma = computeSMA(closes, w);
      const series = new Array(data.length);
      for (let i = 0; i < data.length; i++) {
        series[i] = { x: i, y: sma[i] };
      }
      map[w] = series as { x: number; y: number }[];
    }
    return map;
  }, [closes, data, movingAverageWindows]);

  const maPaths = useMemo(() => {
    return movingAverageWindows.map((w) => {
      const pts = seriesByWindow[w]
        .map((p, i) => {
          const y = yScale(p.y);
          if (!Number.isFinite(y)) return null as any;
          const x = margin + i * xStep;
          return `${i === 0 ? "M" : "L"}${x},${y}`;
        })
        .filter(Boolean)
        .join(" ");
      return pts;
    });
  }, [movingAverageWindows, seriesByWindow, xStep, minPrice, maxPrice]);

  return (
    <View
      className="w-full"
      onLayout={(e) => {
        const newWidth = e.nativeEvent.layout.width;
        setWidth(newWidth);
      }}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {/* x-axis line */}
          <SvgLine
            x1={margin}
            y1={height - margin}
            x2={width - margin}
            y2={height - margin}
            stroke="#e5e7eb"
          />

          {/* candles */}
          {data.map((d, i) => {
            const x = margin + i * xStep;
            const yOpen = yScale(d.open);
            const yClose = yScale(d.close);
            const yHigh = yScale(d.high);
            const yLow = yScale(d.low);
            const bullish = d.close >= d.open;
            const color = bullish ? "#16a34a" : "#dc2626";
            const top = Math.min(yOpen, yClose);
            const bottom = Math.max(yOpen, yClose);
            const bodyH = Math.max(1, bottom - top);
            return (
              <React.Fragment key={i}>
                <SvgLine x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} />
                <Rect
                  x={x - candleW / 2}
                  y={top}
                  width={candleW}
                  height={bodyH}
                  fill={color}
                />
              </React.Fragment>
            );
          })}

          {/* moving averages */}
          {maPaths.map((d, idx) => (
            <Path
              key={`ma-${idx}`}
              d={d}
              stroke={idx === 0 ? "#f59e0b" : "#6366f1"}
              strokeWidth={2}
              fill="none"
            />
          ))}

          {/* targets */}
          {targets.map((t, i) => (
            <SvgLine
              key={`t-${i}`}
              x1={margin}
              x2={width - margin}
              y1={yScale(t.price)}
              y2={yScale(t.price)}
              stroke={t.color || "#ef4444"}
              strokeDasharray="6,6"
              strokeWidth={1.5}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}
