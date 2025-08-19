import React from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BrokerageProvider } from "../../services/brokerageAuth";

interface Props {
  visible: boolean;
  provider: BrokerageProvider | null;
  onCancel: () => void;
  onContinue: () => void;
}

export default function ConnectProviderModal({
  visible,
  provider,
  onCancel,
  onContinue,
}: Props) {
  if (!provider) return null;
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  const color = provider === "robinhood" ? "#00C851" : "#FFD700";
  const icon = provider === "robinhood" ? "trending-up" : "bar-chart";

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={[styles.avatar, { backgroundColor: color + "20" }]}>
              <Ionicons name={icon as any} size={24} color={color} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.title}>Link your {providerName} account</Text>
              <Text style={styles.subtitle}>
                Securely connect to import balances, holdings, and watchlists
              </Text>
            </View>
          </View>

          <View style={styles.list}>
            <View style={styles.listItem}>
              <Ionicons name="shield-checkmark" size={18} color="#10B981" />
              <Text style={styles.listText}>
                Your credentials are never stored on our servers
              </Text>
            </View>
            <View style={styles.listItem}>
              <Ionicons name="eye" size={18} color="#60a5fa" />
              <Text style={styles.listText}>
                Read-only access: balances, holdings, watchlists
              </Text>
            </View>
            <View style={styles.listItem}>
              <Ionicons name="time" size={18} color="#f59e0b" />
              <Text style={styles.listText}>
                You can disconnect any time from Settings
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancel]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>Not now</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.continue]}
              onPress={onContinue}
            >
              <Ionicons name="lock-open" size={16} color="#fff" />
              <Text style={styles.continueText}>
                Continue to {providerName}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#0b0b0b",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "700" },
  subtitle: { color: "#9ca3af", marginTop: 2 },
  list: { marginTop: 16, gap: 10 },
  listItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  listText: { color: "#d1d5db" },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cancel: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
  },
  continue: { backgroundColor: "#2563eb" },
  cancelText: { color: "#9ca3af", fontWeight: "700" },
  continueText: { color: "#fff", fontWeight: "700" },
});
