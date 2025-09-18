import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Mover = {
  symbol: string;
  name?: string;
  changePct: number;
  price?: number;
};

interface Props {
  items: Mover[];
  title?: string;
}

export default function TopMoversCard({ items, title = "Top Movers" }: Props) {
  const sorted = [...items]
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 6);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.grid}>
        {sorted.map((m, i) => {
          const up = m.changePct >= 0;
          return (
            <View
              key={i}
              style={[
                styles.row,
                { borderLeftColor: up ? "#10B981" : "#EF4444" },
              ]}
            >
              <Text style={styles.symbol}>{m.symbol}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {m.name || ""}
                </Text>
              </View>
              <Text style={[styles.change, up ? styles.up : styles.down]}>
                {up ? "+" : ""}
                {m.changePct.toFixed(2)}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16 },
  title: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  grid: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 3,
    paddingVertical: 8,
    paddingLeft: 10,
    backgroundColor: "#131313",
    borderRadius: 8,
  },
  symbol: { color: "#ffffff", fontWeight: "700", width: 56 },
  name: { color: "#9ca3af", fontSize: 12 },
  change: { fontWeight: "700", width: 70, textAlign: "right" },
  up: { color: "#10B981" },
  down: { color: "#EF4444" },
});
