import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AIStrategyOutput } from "../features/trading/services/aiStrategyEngine";

export type LLMChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  screenshot?: string;
  analysis?: AIStrategyOutput | null;
  timestamp: number;
};

interface LLMChatState {
  sessions: Record<string, LLMChatMessage[]>; // keyed by symbol
  newChat: (symbol: string) => void;
  addMessage: (
    symbol: string,
    msg: Omit<LLMChatMessage, "id" | "timestamp">
  ) => void;
  updateMessage: (
    symbol: string,
    id: string,
    update: Partial<Pick<LLMChatMessage, "content">>
  ) => void;
  deleteMessage: (symbol: string, id: string) => void;
}

export const useLLMChatStore = create<LLMChatState>()(
  persist(
    (set, get) => ({
      sessions: {},
      newChat: (symbol) =>
        set((s) => ({ sessions: { ...s.sessions, [symbol]: [] } })),
      addMessage: (symbol, msg) =>
        set((s) => ({
          sessions: {
            ...s.sessions,
            [symbol]: [
              ...(s.sessions[symbol] || []),
              { ...msg, id: `${Date.now()}`, timestamp: Date.now() },
            ],
          },
        })),
      updateMessage: (symbol, id, update) =>
        set((s) => ({
          sessions: {
            ...s.sessions,
            [symbol]: (s.sessions[symbol] || []).map((m) =>
              m.id === id ? { ...m, ...update } : m
            ),
          },
        })),
      deleteMessage: (symbol, id) =>
        set((s) => ({
          sessions: {
            ...s.sessions,
            [symbol]: (s.sessions[symbol] || []).filter((m) => m.id !== id),
          },
        })),
    }),
    {
      name: "llm-chat-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
