import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useAlertStore, type PriceAlert } from "../store/alertStore";
import { fetchSingleQuote } from "../services/quotes";

export default function AlertsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { symbol } = route.params || {};
  const { getAlertsForSymbol, updateAlert, deleteAlert, createAlert } =
    useAlertStore();
  const alerts: PriceAlert[] = symbol
    ? getAlertsForSymbol(symbol)
    : useAlertStore.getState().getAllActiveAlerts();

  const [showNew, setShowNew] = React.useState(false);
  const [newPrice, setNewPrice] = React.useState<string>("");
  const [newCondition, setNewCondition] = React.useState<
    "above" | "below" | "crosses_above" | "crosses_below"
  >("above");

  React.useEffect(() => {
    (async () => {
      try {
        if (symbol) {
          const q = await fetchSingleQuote(symbol);
          if (q && typeof q.last === "number") setNewPrice(String(q.last));
        }
      } catch {}
    })();
  }, [symbol]);

  const renderItem = ({ item }: { item: PriceAlert }) => {
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <Text style={styles.sub}>
            {item.condition} @ ${item.price.toFixed(2)} • {item.source}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            updateAlert(item.id, {
              active: !item.active,
              updatedAt: Date.now(),
            })
          }
          style={[
            styles.chip,
            { backgroundColor: item.active ? "#10B981" : "#374151" },
          ]}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            {item.active ? "Active" : "Paused"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => deleteAlert(item.id)}
          style={[styles.iconBtn]}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.title}>
          {symbol ? `${symbol} Alerts` : "Alerts"}
        </Text>
        <Pressable
          onPress={() => setShowNew(true)}
          style={[
            styles.iconBtn,
            { backgroundColor: "#2563EB", borderRadius: 16 },
          ]}
        >
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={() => (
          <Text style={styles.empty}>No alerts yet. Tap + to add one.</Text>
        )}
      />

      <Modal transparent visible={showNew} animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowNew(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              New Alert{symbol ? ` for ${symbol}` : ""}
            </Text>
            <View style={{ height: 8 }} />
            <View style={styles.formRow}>
              <Text style={styles.label}>Condition</Text>
              <View style={{ flexDirection: "row" }}>
                {["above", "below"].map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setNewCondition(c as any)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          newCondition === c ? "#10B981" : "#374151",
                        marginLeft: 8,
                      },
                    ]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ height: 10 }} />
            <View style={styles.formRow}>
              <Text style={styles.label}>Price</Text>
              <TextInput
                value={newPrice}
                onChangeText={setNewPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#6B7280"
                style={styles.input}
              />
            </View>
            <View style={{ height: 16 }} />
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <Pressable
                onPress={() => setShowNew(false)}
                style={[styles.chip, { backgroundColor: "#374151" }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <View style={{ width: 8 }} />
              <Pressable
                onPress={() => {
                  const p = Number(newPrice);
                  if (!Number.isFinite(p)) return;
                  const s = symbol || (alerts[0]?.symbol ?? "");
                  if (!s) return;
                  createAlert({
                    symbol: s,
                    condition: newCondition as any,
                    price: p,
                    source: "user",
                  });
                  setShowNew(false);
                }}
                style={[styles.chip, { backgroundColor: "#2563EB" }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0a0a0a",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  backBtn: { padding: 6, marginRight: 8 },
  title: { color: "#fff", fontSize: 16, fontWeight: "700", flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  symbol: { color: "#fff", fontWeight: "700", fontSize: 14 },
  sub: { color: "#9CA3AF", marginTop: 2, fontSize: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  iconBtn: { padding: 8, marginLeft: 8 },
  empty: { color: "#9CA3AF", padding: 16, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  modalCard: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    width: "86%",
    maxWidth: 420,
  },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: { color: "#9CA3AF", fontSize: 13 },
  input: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: "#1f2937",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
});
