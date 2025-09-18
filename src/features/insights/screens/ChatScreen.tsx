import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  SafeAreaView,
  Modal,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../providers/ThemeProvider";
import { useChatStore } from "../../../store/chatStore";
import * as Clipboard from "expo-clipboard";

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { messages } = useChatStore();
  const [historyVisible, setHistoryVisible] = useState(false);

  const transcriptText = useMemo(() => {
    return messages
      .map((m) => {
        const time = new Date(m.timestamp).toLocaleString();
        const header = `${time} · ${m.symbol}`;
        const lines: string[] = [];
        if (m.strategy)
          lines.push(`Strategy: ${m.strategy}${m.side ? ` · ${m.side}` : ""}`);
        if (
          m.entry != null ||
          m.stop != null ||
          (m.targets && m.targets.length)
        ) {
          const parts: string[] = [];
          if (m.entry != null) parts.push(`Entry $${m.entry.toFixed(2)}`);
          if (m.stop != null) parts.push(`Stop $${m.stop.toFixed(2)}`);
          if (m.targets && m.targets.length)
            parts.push(
              `Targets ${m.targets.map((t) => `$${t.toFixed(2)}`).join(" • ")}`
            );
          lines.push(parts.join("  "));
        }
        if (m.confidence != null || m.riskReward != null) {
          const parts: string[] = [];
          if (m.confidence != null)
            parts.push(`Confidence ${Math.round(m.confidence)}%`);
          if (m.riskReward != null) parts.push(`RR ${m.riskReward.toFixed(2)}`);
          lines.push(parts.join("  "));
        }
        if (m.why && m.why.length) {
          lines.push(...m.why.map((w) => `• ${w}`));
        }
        return `${header}\n${lines.join("\n")}`;
      })
      .join("\n\n");
  }, [messages]);

  const handleCopyTranscript = async () => {
    try {
      await Clipboard.setStringAsync(transcriptText);
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text
          style={{ color: theme.colors.text, fontWeight: "700", fontSize: 16 }}
        >
          Analysis Chat
        </Text>
        <View style={{ flexDirection: "row" }}>
          <Pressable
            onPress={() => setHistoryVisible(true)}
            style={{ padding: 8 }}
          >
            <Ionicons name="time" size={20} color={theme.colors.text} />
          </Pressable>
          <Pressable onPress={handleCopyTranscript} style={{ padding: 8 }}>
            <Ionicons name="copy" size={20} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              {new Date(item.timestamp).toLocaleString()} · {item.symbol}
            </Text>
            {item.strategy ? (
              <Pressable
                onPress={() => {
                  // Navigate back to chart with full context
                  navigation.navigate("ChartFullScreen", {
                    symbol: item.symbol,
                    tradePlan: item.tradePlan,
                    ai: item.aiMeta,
                    analysisContext: item.analysisContext,
                  });
                }}
                style={{
                  backgroundColor: "rgba(37, 99, 235, 0.1)",
                  borderRadius: 8,
                  padding: 8,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: "rgba(37, 99, 235, 0.2)",
                }}
              >
                <Text
                  style={{
                    color: "#2563EB",
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  📊 {item.strategy} {item.side ? `· ${item.side}` : ""}
                </Text>
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: 11,
                    marginTop: 2,
                  }}
                >
                  Tap to view on chart with entry/exit lines
                </Text>
              </Pressable>
            ) : null}
            {item.entry != null || item.stop != null ? (
              <Text style={{ color: theme.colors.text, marginBottom: 6 }}>
                {item.entry != null ? `Entry: $${item.entry.toFixed(2)}  ` : ""}
                {item.stop != null ? `Stop: $${item.stop.toFixed(2)}  ` : ""}
                {item.targets && item.targets.length
                  ? `Targets: ${item.targets
                      .map((t) => `$${t.toFixed(2)}`)
                      .join(" • ")}`
                  : ""}
              </Text>
            ) : null}
            {item.confidence != null || item.riskReward != null ? (
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: 12,
                  marginBottom: 6,
                }}
              >
                {item.confidence != null
                  ? `Confidence: ${Math.round(item.confidence)}%  `
                  : ""}
                {item.riskReward != null
                  ? `RR: ${item.riskReward.toFixed(2)}`
                  : ""}
              </Text>
            ) : null}
            {item.why && item.why.length ? (
              <View style={{ marginTop: 4 }}>
                {item.why.map((w, i) => (
                  <Text
                    key={i}
                    style={{ color: theme.colors.text, fontSize: 13 }}
                  >
                    • {w}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        )}
      />

      <Modal visible={historyVisible} animationType="slide">
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <Pressable
              onPress={() => setHistoryVisible(false)}
              style={{ padding: 8 }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
            <Text
              style={{
                color: theme.colors.text,
                fontWeight: "700",
                fontSize: 16,
                marginLeft: 8,
              }}
            >
              All Analysis History
            </Text>
            <Pressable
              onPress={handleCopyTranscript}
              style={{ marginLeft: "auto", padding: 8 }}
            >
              <Ionicons name="copy" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  {new Date(item.timestamp).toLocaleString()} · {item.symbol}
                </Text>
                {item.strategy ? (
                  <Text style={{ color: theme.colors.text, fontWeight: "600" }}>
                    📊 {item.strategy} {item.side ? `· ${item.side}` : ""}
                  </Text>
                ) : null}
                {item.why && item.why.length ? (
                  <View style={{ marginTop: 4 }}>
                    {item.why.map((w, i) => (
                      <Text
                        key={i}
                        style={{ color: theme.colors.text, fontSize: 13 }}
                      >
                        • {w}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
