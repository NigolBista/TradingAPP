import React, { useMemo } from "react";
import KLineProChart, { TradeLevel, TradeZone } from "./KLineProChart";
import { AnalysisParser } from "../../services/analysisParser";

interface Props {
  symbol: string;
  timeframe?: string;
  height?: number;
  theme?: "dark" | "light";
  market?: "stocks" | "crypto" | "forex";
  llmXml: string;
  visibleCandles?: number;
  currentPrice?: number;
}

export default function XMLDrivenChart({
  symbol,
  timeframe = "1d",
  height = 320,
  theme = "dark",
  market = "stocks",
  llmXml,
  visibleCandles = 50,
  currentPrice,
}: Props) {
  const { tradeLevels, tradeZones } = useMemo(() => {
    try {
      return AnalysisParser.extractChartProps(llmXml, {
        timeframe,
        visibleCandles,
        currentPrice,
      });
    } catch (e) {
      return { tradeLevels: [] as TradeLevel[], tradeZones: [] as TradeZone[] };
    }
  }, [llmXml, timeframe, visibleCandles, currentPrice]);

  return (
    <KLineProChart
      symbol={symbol}
      timeframe={timeframe}
      height={height}
      theme={theme}
      market={market}
      showYAxis
      tradeLevels={tradeLevels}
      tradeZones={tradeZones}
    />
  );
}
