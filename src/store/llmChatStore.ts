import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AIStrategyOutput } from "../logic/aiStrategyEngine";

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
    }),
    {
      name: "llm-chat-store",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
