import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Candle, formatPrice, formatVolume } from "./utils";

type Props = { lastCandle: Candle | null };

export default function OHLCRow({ lastCandle }: Props) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: "#1f2937",
        backgroundColor: "#0a0a0a",
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
            O{" "}
            <Text style={{ color: "#10B981" }}>
              {formatPrice(lastCandle?.open)}
            </Text>
          </Text>
          <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
            H{" "}
            <Text style={{ color: "#10B981" }}>
              {formatPrice(lastCandle?.high)}
            </Text>
          </Text>
          <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
            L{" "}
            <Text style={{ color: "#EF4444" }}>
              {formatPrice(lastCandle?.low)}
            </Text>
          </Text>
          <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
            C{" "}
            <Text style={{ color: "#E5E7EB" }}>
              {formatPrice(lastCandle?.close)}
            </Text>
          </Text>
          <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
            V{" "}
            <Text style={{ color: "#E5E7EB" }}>
              {formatVolume(lastCandle?.volume)}
            </Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
