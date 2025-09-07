import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  SafeAreaView,
  Image,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../providers/ThemeProvider";
import { useLLMChatStore } from "../store/llmChatStore";
import { sendChartChatMessage } from "../logic/llmChartChat";

export default function ChartChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const symbol: string = route.params?.symbol;
  const { sessions, addMessage, newChat } = useLLMChatStore();
  const messages = sessions[symbol] || [];
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    addMessage(symbol, { role: "user", content });
    setInput("");
    setSending(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await sendChartChatMessage({
        symbol,
        message: content,
        history,
      });
      addMessage(symbol, {
        role: "assistant",
        content: res.reply,
        screenshot: res.screenshot,
        analysis: res.analysis,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
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
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text
          style={{
            color: theme.colors.text,
            fontWeight: "700",
            fontSize: 16,
            marginLeft: 8,
          }}
        >
          Chat · {symbol}
        </Text>
        <Pressable
          onPress={() => newChat(symbol)}
          style={{ marginLeft: "auto", padding: 8 }}
        >
          <Ionicons name="refresh" size={20} color={theme.colors.text} />
        </Pressable>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View
            style={{
              marginBottom: 12,
              alignSelf: item.role === "user" ? "flex-end" : "flex-start",
              backgroundColor:
                item.role === "user" ? theme.colors.primary : theme.colors.card,
              borderRadius: 8,
              padding: 10,
              maxWidth: "80%",
            }}
          >
            <Text
              style={{
                color: item.role === "user" ? "#fff" : theme.colors.text,
              }}
            >
              {item.content}
            </Text>
            {item.screenshot ? (
              <Image
                source={{ uri: item.screenshot }}
                style={{ width: 200, height: 120, marginTop: 6, borderRadius: 6 }}
              />
            ) : null}
          </View>
        )}
      />

      <View
        style={{
          flexDirection: "row",
          padding: 16,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        <TextInput
          style={{
            flex: 1,
            color: theme.colors.text,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginRight: 8,
          }}
          placeholder="Ask the AI..."
          placeholderTextColor={theme.colors.textSecondary}
          value={input}
          onChangeText={setInput}
        />
        <Pressable
          onPress={handleSend}
          disabled={sending}
          style={{
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 16,
            justifyContent: "center",
            borderRadius: 8,
          }}
        >
          <Ionicons name="send" size={16} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
