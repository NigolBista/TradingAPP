import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ChatMessage = {
  id: string;
  type: "analysis";
  symbol: string;
  strategy?: string;
  side?: "long" | "short";
  entry?: number;
  lateEntry?: number;
  exit?: number;
  lateExit?: number;
  stop?: number;
  targets?: number[];
  riskReward?: number;
  confidence?: number;
  why?: string[];
  timestamp: number;
};

interface ChatState {
  messages: ChatMessage[];
  addAnalysisMessage: (params: {
    symbol: string;
    strategy?: string;
    side?: "long" | "short";
    entry?: number;
    lateEntry?: number;
    exit?: number;
    lateExit?: number;
    stop?: number;
    targets?: number[];
    riskReward?: number;
    confidence?: number;
    why?: string[];
  }) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      addAnalysisMessage: ({
        symbol,
        strategy,
        side,
        entry,
        lateEntry,
        exit,
        lateExit,
        stop,
        targets,
        riskReward,
        confidence,
        why,
      }) => {
        const msg: ChatMessage = {
          id: `analysis-${Date.now()}`,
          type: "analysis",
          symbol,
          strategy,
          side,
          entry,
          lateEntry,
          exit,
          lateExit,
          stop,
          targets,
          riskReward,
          confidence,
          why,
          timestamp: Date.now(),
        };
        set((s) => ({ messages: [msg, ...s.messages] }));
      },
      clear: () => set({ messages: [] }),
    }),
    {
      name: "chat-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ messages: state.messages }),
    }
  )
);
