import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { IndicatorConfig } from "../../components/charts/SimpleKLineChart";

type Props = {
  indicators: IndicatorConfig[];
  onOpenConfig: (name: string) => void;
  onToggleIndicator: (name: string) => void;
  onOpenAddSheet: () => void;
};

export default function IndicatorsAccordion({ indicators, onOpenConfig, onToggleIndicator, onOpenAddSheet }: Props) {
  return (
    <View
      style={{
        backgroundColor: "#0f0f0f",
        borderBottomWidth: 1,
        borderBottomColor: "#2a2a2a",
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {indicators.length === 0 ? (
            <Text style={{ color: "#9CA3AF", fontSize: 12 }}>No indicators selected</Text>
          ) : (
            indicators.map((cfg) => (
              <View
                key={`chip-${cfg.name}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  backgroundColor: "#1a1a1a",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "#333",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", marginRight: 6 }}>{cfg.name}</Text>
                <Pressable onPress={() => onOpenConfig(cfg.name)} style={{ padding: 4 }}>
                  <Ionicons name="settings-outline" size={14} color="#ccc" />
                </Pressable>
                <Pressable onPress={() => onToggleIndicator(cfg.name)} style={{ marginLeft: 8, padding: 4 }}>
                  <Ionicons name="close" size={14} color="#ccc" />
                </Pressable>
              </View>
            ))
          )}
          <Pressable
            onPress={onOpenAddSheet}
            style={{ paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#00D4AA", borderRadius: 12, marginLeft: 8 }}
          >
            <Text style={{ color: "#000", fontWeight: "700" }}>Add</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}


