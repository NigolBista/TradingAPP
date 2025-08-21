import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  useColorScheme,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import LightweightCandles from "./LightweightCandles";
import {
  fetchCandles,
  MarketDataResolution,
  aggregateCandles,
} from "../../services/marketProviders";

type TradeLevels = {
  entry?: number;
  entryExtended?: number;
  exit?: number;
  exitExtended?: number;
};

type Props = {
  symbol: string; // e.g. "AAPL" or "NASDAQ:AAPL"
  height?: number;
  interval?: "1" | "5" | "15" | "30" | "60" | "120" | "240" | "D" | "W" | "M";
  theme?: "light" | "dark";
  showExpand?: boolean;
  levels?: TradeLevels;
};

export default function TradingViewChart({
  symbol,
  height = 560,
  interval = "D",
  theme,
  showExpand = true,
  levels,
}: Props) {
  const scheme = useColorScheme();
  const resolvedTheme = theme || (scheme === "dark" ? "dark" : "light");
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);

  const normalizedSymbol = useMemo(
    () => (symbol.includes(":") ? symbol.split(":")[1] : symbol),
    [symbol]
  );

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        // Map TradingView-style interval to our provider resolution and optional aggregation factor
        let base: MarketDataResolution =
          interval === "60"
            ? "1H"
            : interval === "120"
            ? "1H"
            : interval === "240"
            ? "1H"
            : (interval as MarketDataResolution);
        const group = interval === "120" ? 2 : interval === "240" ? 4 : 1;

        // Try configured provider; on 403 or failure, fallback to Yahoo open endpoint
        let candles: any[] = [];
        try {
          candles = await fetchCandles(normalizedSymbol, {
            resolution: base,
          });
        } catch (primaryErr) {
          console.warn(
            "Primary provider failed, retrying with Yahoo:",
            primaryErr
          );
          candles = await fetchCandles(normalizedSymbol, {
            resolution: base,
            providerOverride: "yahoo",
          });
        }
        if (group > 1) {
          candles = aggregateCandles(candles, group);
        }
        if (!isMounted) return;
        setData(
          candles.map((c) => ({
            time:
              typeof c.time === "number" && c.time < 1e12
                ? c.time * 1000
                : c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          }))
        );
      } catch (e) {
        console.warn("Failed to load candles", e);
        if (isMounted) setData([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [normalizedSymbol, interval]);

  const effectiveLevels = useMemo(() => {
    if (
      levels &&
      (levels.entry ||
        levels.exit ||
        levels.entryExtended ||
        levels.exitExtended)
    ) {
      return levels;
    }
    if (data && data.length > 0) {
      const last = data[data.length - 1];
      const close = Number(last.close) || 0;
      if (!close) return undefined;
      const delta = close * 0.01; // 1% bands default
      return {
        entry: close + delta * 0.5,
        entryExtended: close + delta * 1.0,
        exit: Math.max(0, close - delta * 0.5),
        exitExtended: Math.max(0, close - delta * 1.0),
      };
    }
    return undefined;
  }, [levels, data]);

  return (
    <View style={{ height, width: "100%", backgroundColor: "transparent" }}>
      {loading ? (
        <View
          style={{
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator />
        </View>
      ) : (
        <LightweightCandles
          data={data}
          height={height}
          type="candlestick"
          theme={resolvedTheme}
          showVolume={false}
          showMA={false}
          showGrid={true}
          showCrosshair={true}
          levels={effectiveLevels}
        />
      )}
      {showExpand && (
        <Pressable
          onPress={() =>
            navigation.navigate("ChartFullScreen", {
              symbol: normalizedSymbol,
              levels,
            })
          }
          style={{
            position: "absolute",
            right: 12,
            top: 20,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 20,
            padding: 8,
          }}
          hitSlop={10}
        >
          <Ionicons name="expand" size={18} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}
