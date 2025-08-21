import React from "react";
import { View, Text, FlatList, Pressable, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../providers/ThemeProvider";
import { useChatStore } from "../store/chatStore";

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { messages } = useChatStore();

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
        <View style={{ width: 32 }} />
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
              <Text
                style={{
                  color: theme.colors.text,
                  fontWeight: "600",
                  marginBottom: 6,
                }}
              >
                Strategy: {item.strategy} {item.side ? `· ${item.side}` : ""}
              </Text>
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
    </SafeAreaView>
  );
}
