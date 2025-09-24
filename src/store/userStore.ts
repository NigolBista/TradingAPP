import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SkillLevel = "Beginner" | "Intermediate" | "Expert";
export type TraderType = "Long-term holder" | "Swing trader" | "Day trader";
export type SubscriptionTier = "Free" | "Pro" | "Elite";

export interface WatchlistItem {
  symbol: string;
  isFavorite: boolean;
  addedAt: Date;
}

export interface Watchlist {
  id: string;
  name: string;
  description?: string;
  color: string;
  items: WatchlistItem[];
  createdAt: Date;
  isDefault: boolean;
}

export interface UserProfile {
  id?: string;
  email?: string;
  skillLevel: SkillLevel;
  traderType: TraderType;
  subscriptionTier: SubscriptionTier;
  watchlist: string[]; // Keep for backward compatibility
  watchlists: Watchlist[];
  activeWatchlistId: string;
  favorites: string[]; // Global favorites outside watchlists (Robinhood-style)
  accountSize?: number; // USD
  riskPerTradePct?: number; // % of account per trade
  signalConfidenceThreshold?: number; // 0-100
  notificationsEnabled?: boolean;

  // Strategy complexity preferences
  strategyComplexity?: "simple" | "partial" | "advanced";
  preferredRiskReward?: number;
  autoApplyComplexity?: boolean; // Auto-apply complexity to all analyses

  // Signal provider & strategy groups
  isSignalProvider?: boolean;
  strategyGroups?: StrategyGroup[];
  selectedStrategyGroupId?: string;
}

export interface StrategyGroup {
  id: string;
  name: string;
  description?: string;
  isInviteOnly?: boolean;
  inviteCode?: string; // pseudo invite code for local-only flow
  ownerUserId?: string;
  memberUserIds?: string[];
}

interface UserState {
  profile: UserProfile;
  setProfile: (data: Partial<UserProfile>) => void;
  createWatchlist: (name: string, description?: string) => string;
  deleteWatchlist: (id: string) => void;
  addToWatchlist: (watchlistId: string, symbol: string) => void;
  removeFromWatchlist: (watchlistId: string, symbol: string) => void;
  toggleFavorite: (watchlistId: string, symbol: string) => void;
  toggleGlobalFavorite: (symbol: string) => void; // For global favorites like Robinhood
  isGlobalFavorite: (symbol: string) => boolean;
  setActiveWatchlist: (id: string) => void;
  getActiveWatchlist: () => Watchlist | undefined;
  // Strategy groups
  createStrategyGroup: (
    name: string,
    options?: { description?: string; inviteOnly?: boolean }
  ) => string;
  selectStrategyGroup: (groupId: string) => void;
  joinStrategyGroupByCode: (inviteCode: string) => StrategyGroup | null;
  listStrategyGroups: () => StrategyGroup[];
  reset: () => void;
}

const defaultWatchlist: Watchlist = {
  id: "default",
  name: "My Watchlist",
  description: "Default watchlist",
  color: "#00D4AA",
  items: [
    { symbol: "AAPL", isFavorite: true, addedAt: new Date() },
    { symbol: "GOOGL", isFavorite: false, addedAt: new Date() },
    { symbol: "MSFT", isFavorite: false, addedAt: new Date() },
    { symbol: "TSLA", isFavorite: true, addedAt: new Date() },
    { symbol: "NVDA", isFavorite: false, addedAt: new Date() },
  ],
  createdAt: new Date(),
  isDefault: true,
};

const defaultProfile: UserProfile = {
  skillLevel: "Beginner",
  traderType: "Long-term holder",
  subscriptionTier: "Free",
  watchlist: ["AAPL", "GOOGL", "MSFT", "TSLA", "NVDA"], // Keep for backward compatibility
  watchlists: [defaultWatchlist],
  activeWatchlistId: "default",
  favorites: ["AAPL", "TSLA"], // Global favorites like Robinhood
  accountSize: 10000,
  riskPerTradePct: 1,
  signalConfidenceThreshold: 70,
  notificationsEnabled: true,
  isSignalProvider: false,
  strategyGroups: [],
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: defaultProfile,
      setProfile: (data) =>
        set((s) => ({ profile: { ...s.profile, ...data } })),

      createWatchlist: (name: string, description?: string) => {
        const id = `watchlist_${Date.now()}`;
        const newWatchlist: Watchlist = {
          id,
          name,
          description,
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          items: [],
          createdAt: new Date(),
          isDefault: false,
        };

        set((s) => ({
          profile: {
            ...s.profile,
            watchlists: [...s.profile.watchlists, newWatchlist],
            activeWatchlistId: id,
          },
        }));

        return id;
      },

      deleteWatchlist: (id: string) => {
        set((s) => {
          const watchlists = s.profile.watchlists.filter(
            (w) => w.id !== id && !w.isDefault
          );
          const activeId =
            s.profile.activeWatchlistId === id
              ? watchlists.find((w) => w.isDefault)?.id ||
                watchlists[0]?.id ||
                "default"
              : s.profile.activeWatchlistId;

          return {
            profile: {
              ...s.profile,
              watchlists,
              activeWatchlistId: activeId,
            },
          };
        });
      },

      addToWatchlist: (watchlistId: string, symbol: string) => {
        set((s) => ({
          profile: {
            ...s.profile,
            watchlists: s.profile.watchlists.map((w) =>
              w.id === watchlistId
                ? {
                    ...w,
                    items: w.items.find((item) => item.symbol === symbol)
                      ? w.items
                      : [
                          ...w.items,
                          { symbol, isFavorite: false, addedAt: new Date() },
                        ],
                  }
                : w
            ),
          },
        }));
      },

      removeFromWatchlist: (watchlistId: string, symbol: string) => {
        set((s) => ({
          profile: {
            ...s.profile,
            watchlists: s.profile.watchlists.map((w) =>
              w.id === watchlistId
                ? {
                    ...w,
                    items: w.items.filter((item) => item.symbol !== symbol),
                  }
                : w
            ),
          },
        }));
      },

      toggleFavorite: (watchlistId: string, symbol: string) => {
        set((s) => ({
          profile: {
            ...s.profile,
            watchlists: s.profile.watchlists.map((w) =>
              w.id === watchlistId
                ? {
                    ...w,
                    items: w.items.map((item) =>
                      item.symbol === symbol
                        ? { ...item, isFavorite: !item.isFavorite }
                        : item
                    ),
                  }
                : w
            ),
          },
        }));
      },

      toggleGlobalFavorite: (symbol: string) => {
        set((s) => {
          const isCurrentlyFavorite = s.profile.favorites.includes(symbol);
          return {
            profile: {
              ...s.profile,
              favorites: isCurrentlyFavorite
                ? s.profile.favorites.filter((fav) => fav !== symbol)
                : [...s.profile.favorites, symbol],
            },
          };
        });
      },

      isGlobalFavorite: (symbol: string) => {
        const { profile } = get();
        return profile.favorites.includes(symbol);
      },

      setActiveWatchlist: (id: string) => {
        set((s) => ({
          profile: { ...s.profile, activeWatchlistId: id },
        }));
      },

      getActiveWatchlist: () => {
        const { profile } = get();
        return profile.watchlists.find(
          (w) => w.id === profile.activeWatchlistId
        );
      },

      // Strategy groups local CRUD (client-only for now)
      createStrategyGroup: (
        name: string,
        options?: { description?: string; inviteOnly?: boolean }
      ) => {
        const id = `group_${Date.now()}`;
        const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
        const group: StrategyGroup = {
          id,
          name,
          description: options?.description,
          isInviteOnly: !!options?.inviteOnly,
          inviteCode,
        };
        set((s) => ({
          profile: {
            ...s.profile,
            strategyGroups: [...(s.profile.strategyGroups || []), group],
            selectedStrategyGroupId: id,
          },
        }));
        return id;
      },

      selectStrategyGroup: (groupId: string) => {
        set((s) => ({
          profile: { ...s.profile, selectedStrategyGroupId: groupId },
        }));
      },

      joinStrategyGroupByCode: (inviteCode: string) => {
        const { profile } = get();
        const groups = profile.strategyGroups || [];
        const match = groups.find(
          (g) => (g.inviteCode || "").toUpperCase() === inviteCode.toUpperCase()
        );
        if (!match) return null;
        // Already local; just select it
        set((s) => ({
          profile: { ...s.profile, selectedStrategyGroupId: match.id },
        }));
        return match;
      },

      listStrategyGroups: () => {
        const { profile } = get();
        return profile.strategyGroups || [];
      },

      reset: () => set({ profile: defaultProfile }),
    }),
    {
      name: "user-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Persist the entire profile
      partialize: (state) => ({
        profile: state.profile,
      }),
    }
  )
);
