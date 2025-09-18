import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TradePlanOverlay } from "../components/charts/LightweightCandles";

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
  // Full context for navigation back to chart
  tradePlan?: TradePlanOverlay;
  aiMeta?: {
    strategyChosen?: string;
    side?: "long" | "short";
    confidence?: number;
    why?: string[];
    notes?: string[];
    targets?: number[];
    riskReward?: number;
  };
  analysisContext?: {
    mode: string;
    tradePace: string;
    desiredRR: number;
    contextMode: string;
    isAutoAnalysis: boolean;
    contextLookback?: { mode: "auto" | "fixed"; ms?: number };
  };
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
    // Full context for navigation back to chart
    tradePlan?: TradePlanOverlay;
    aiMeta?: {
      strategyChosen?: string;
      side?: "long" | "short";
      confidence?: number;
      why?: string[];
      notes?: string[];
      targets?: number[];
      riskReward?: number;
    };
    analysisContext?: {
      mode: string;
      tradePace: string;
      desiredRR: number;
      contextMode: string;
      isAutoAnalysis: boolean;
      contextLookback?: { mode: "auto" | "fixed"; ms?: number };
    };
  }) => void;
  clear: () => void;
  clearSymbolMessages: (symbol: string) => void;
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
        tradePlan,
        aiMeta,
        analysisContext,
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
          tradePlan,
          aiMeta,
          analysisContext,
        };
        set((s) => ({ messages: [msg, ...s.messages] }));
      },
      clear: () => set({ messages: [] }),
      clearSymbolMessages: (symbol: string) => {
        set((s) => ({
          messages: s.messages.filter((msg) => msg.symbol !== symbol),
        }));
      },
    }),
    {
      name: "chat-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ messages: state.messages }),
    }
  )
);
