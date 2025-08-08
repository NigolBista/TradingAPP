import { create } from "zustand";

export type SkillLevel = "Beginner" | "Intermediate" | "Expert";
export type TraderType = "Long-term holder" | "Swing trader" | "Day trader";
export type SubscriptionTier = "Free" | "Pro" | "Elite";

export interface UserProfile {
  id?: string;
  email?: string;
  skillLevel: SkillLevel;
  traderType: TraderType;
  subscriptionTier: SubscriptionTier;
  watchlist: string[];
}

interface UserState {
  profile: UserProfile;
  setProfile: (data: Partial<UserProfile>) => void;
  reset: () => void;
}

const defaultProfile: UserProfile = {
  skillLevel: "Beginner",
  traderType: "Long-term holder",
  subscriptionTier: "Free",
  watchlist: [],
};

export const useUserStore = create<UserState>((set) => ({
  profile: defaultProfile,
  setProfile: (data) => set((s) => ({ profile: { ...s.profile, ...data } })),
  reset: () => set({ profile: defaultProfile }),
}));
