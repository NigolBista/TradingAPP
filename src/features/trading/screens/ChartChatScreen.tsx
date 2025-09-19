import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  SafeAreaView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../providers/ThemeProvider";
import { useLLMChatStore } from "../../../store/llmChatStore";
import { sendChartChatMessage } from "../services/llmChartChat";
import * as Clipboard from "expo-clipboard";

export default function ChartChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const symbol: string = route.params?.symbol;
  const { sessions, addMessage, newChat, updateMessage, deleteMessage } =
    useLLMChatStore();
  const messages = sessions[symbol] || [];
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const userMessages = useMemo(
    () => messages.filter((m) => m.role === "user"),
    [messages]
  );
  const transcriptText = useMemo(() => {
    return userMessages
      .map((m) => {
        const time = new Date(m.timestamp).toLocaleString();
        return `${time} — ${m.content}`;
      })
      .join("\n\n");
  }, [userMessages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;
    addMessage(symbol, { role: "user", content });
    setInput("");
    setSending(true);
    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
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

  const handleCopyMessage = async (content: string) => {
    try {
      await Clipboard.setStringAsync(content);
    } catch {}
  };

  const handleCopyTranscript = async () => {
    try {
      await Clipboard.setStringAsync(transcriptText);
    } catch {}
  };

  const handleStartEdit = (id: string, content: string) => {
    setEditingMessageId(id);
    setEditText(content);
  };

  const handleSaveEdit = () => {
    if (!editingMessageId) return;
    const text = editText.trim();
    if (!text) return;
    updateMessage(symbol, editingMessageId, { content: text });
    setEditingMessageId(null);
    setEditText("");
    setActiveMessageId(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  const handleDelete = (id: string) => {
    deleteMessage(symbol, id);
    if (activeMessageId === id) setActiveMessageId(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
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
          <View style={{ marginLeft: "auto", flexDirection: "row" }}>
            <Pressable
              onPress={() => setHistoryVisible(true)}
              style={{ padding: 8 }}
            >
              <Ionicons name="time" size={20} color={theme.colors.text} />
            </Pressable>
            <Pressable onPress={() => newChat(symbol)} style={{ padding: 8 }}>
              <Ionicons
                name="add-circle-outline"
                size={22}
                color={theme.colors.text}
              />
            </Pressable>
          </View>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          renderItem={({ item }) => {
            const isActive = activeMessageId === item.id;
            const isEditing = editingMessageId === item.id;
            const isUser = item.role === "user";
            return (
              <Pressable
                onPress={() =>
                  setActiveMessageId((prev) =>
                    prev === item.id ? null : item.id
                  )
                }
                style={{
                  marginBottom: 12,
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  backgroundColor: isUser
                    ? "rgba(37, 99, 235, 0.12)"
                    : theme.colors.card,
                  borderRadius: 8,
                  padding: 10,
                  maxWidth: "80%",
                  borderWidth: 1,
                  borderColor: isUser
                    ? "rgba(37, 99, 235, 0.25)"
                    : theme.colors.border,
                }}
              >
                {isEditing ? (
                  <View>
                    <TextInput
                      value={editText}
                      onChangeText={setEditText}
                      multiline
                      style={{
                        color: theme.colors.text,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                        backgroundColor: theme.colors.background,
                      }}
                    />
                    <View style={{ flexDirection: "row", marginTop: 8 }}>
                      <Pressable
                        onPress={handleSaveEdit}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          backgroundColor: theme.colors.primary,
                          borderRadius: 6,
                          marginRight: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontWeight: "600",
                          }}
                        >
                          Save
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleCancelEdit}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          backgroundColor: "transparent",
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: theme.colors.border,
                        }}
                      >
                        <Text
                          style={{
                            color: theme.colors.text,
                            fontWeight: "600",
                          }}
                        >
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text
                      style={{
                        color: theme.colors.text,
                      }}
                    >
                      {item.content}
                    </Text>
                    {item.screenshot ? (
                      <Image
                        source={{ uri: item.screenshot }}
                        style={{
                          width: 200,
                          height: 120,
                          marginTop: 6,
                          borderRadius: 6,
                        }}
                      />
                    ) : null}
                    {isActive ? (
                      <View
                        style={{
                          flexDirection: "row",
                          marginTop: 8,
                          justifyContent: isUser ? "flex-end" : "flex-start",
                        }}
                      >
                        <Pressable
                          onPress={() => handleCopyMessage(item.content)}
                          style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                        >
                          <Ionicons
                            name="copy"
                            size={16}
                            color={theme.colors.text}
                          />
                        </Pressable>
                        {isUser ? (
                          <Pressable
                            onPress={() =>
                              handleStartEdit(item.id, item.content)
                            }
                            style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                          >
                            <Ionicons
                              name="create"
                              size={16}
                              color={theme.colors.text}
                            />
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => handleDelete(item.id)}
                          style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                        >
                          <Ionicons
                            name="trash"
                            size={16}
                            color={theme.colors.text}
                          />
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                )}
              </Pressable>
            );
          }}
        />

        <View
          style={{
            flexDirection: "row",
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
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
            multiline
            maxLength={500}
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
                Chat History (Your Questions)
              </Text>
              <Pressable
                onPress={handleCopyTranscript}
                style={{ marginLeft: "auto", padding: 8 }}
              >
                <Ionicons name="copy" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={userMessages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: "rgba(37, 99, 235, 0.08)",
                    borderWidth: 1,
                    borderColor: "rgba(37, 99, 235, 0.2)",
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={18}
                    color={theme.colors.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: theme.colors.textSecondary,
                        fontSize: 11,
                        marginBottom: 4,
                      }}
                    >
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{ color: theme.colors.text, fontSize: 14 }}
                    >
                      {item.content}
                    </Text>
                  </View>
                </View>
              )}
            />
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
