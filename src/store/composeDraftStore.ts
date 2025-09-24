import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DraftPlan = {
  entries: number[];
  exits: number[];
  tps: number[];
  updatedAt: number;
};

interface ComposeDraftState {
  drafts: Record<string, DraftPlan>; // by symbol

  setDraftPlan: (symbol: string, draft: DraftPlan) => void;
  getDraftPlan: (symbol: string) => DraftPlan | null;
  clearDraftPlan: (symbol: string) => void;
  clearAll: () => void;
}

export const useComposeDraftStore = create<ComposeDraftState>()(
  persist(
    (set, get) => ({
      drafts: {},

      setDraftPlan: (symbol, draft) => {
        set((state) => {
          const timestamp = Number.isFinite(draft.updatedAt)
            ? (draft.updatedAt as number)
            : Date.now();

          return {
            drafts: {
              ...state.drafts,
              [symbol]: { ...draft, updatedAt: timestamp },
            },
          };
        });
      },

      getDraftPlan: (symbol) => {
        return get().drafts[symbol] || null;
      },

      clearDraftPlan: (symbol) => {
        set((state) => {
          const next = { ...state.drafts };
          delete next[symbol];
          return { drafts: next };
        });
      },

      clearAll: () => set({ drafts: {} }),
    }),
    {
      name: "compose-draft-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ drafts: s.drafts }),
    }
  )
);
