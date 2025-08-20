import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  EarningsCalendarItem,
  RecentEarningsItem,
  fetchTodaysEarnings,
  fetchWeeklyEarnings,
  fetchUpcomingEarnings,
  fetchRecentEarnings,
} from "../services/earningsData";

interface EarningsStore {
  // Data
  todaysEarnings: EarningsCalendarItem[];
  weeklyEarnings: EarningsCalendarItem[];
  upcomingEarnings: EarningsCalendarItem[];
  recentEarnings: RecentEarningsItem[];

  // Metadata
  lastUpdated: string | null;
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;

  // Actions
  setTodaysEarnings: (earnings: EarningsCalendarItem[]) => void;
  setWeeklyEarnings: (earnings: EarningsCalendarItem[]) => void;
  setUpcomingEarnings: (earnings: EarningsCalendarItem[]) => void;
  setRecentEarnings: (earnings: RecentEarningsItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHydrated: (hydrated: boolean) => void;

  // Hydration and refresh
  hydrateEarningsData: () => Promise<void>;
  refreshEarningsData: () => Promise<void>;
  shouldRefresh: () => boolean;
  clearCache: () => void;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

export const useEarningsStore = create<EarningsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      todaysEarnings: [],
      weeklyEarnings: [],
      upcomingEarnings: [],
      recentEarnings: [],
      lastUpdated: null,
      isLoading: false,
      error: null,
      isHydrated: false,

      // Setters
      setTodaysEarnings: (earnings) => set({ todaysEarnings: earnings }),
      setWeeklyEarnings: (earnings) => set({ weeklyEarnings: earnings }),
      setUpcomingEarnings: (earnings) => set({ upcomingEarnings: earnings }),
      setRecentEarnings: (earnings) => set({ recentEarnings: earnings }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),

      // Check if data should be refreshed
      shouldRefresh: () => {
        const { lastUpdated } = get();
        if (!lastUpdated) return true;

        const now = new Date().getTime();
        const lastUpdate = new Date(lastUpdated).getTime();
        return now - lastUpdate > CACHE_DURATION;
      },

      // Hydrate earnings data at app launch
      hydrateEarningsData: async () => {
        const state = get();

        // Skip if already hydrated and data is fresh
        if (state.isHydrated && !state.shouldRefresh()) {
          console.log("📊 Earnings data already hydrated and fresh");
          return;
        }

        console.log("🚀 Hydrating earnings data at app launch...");
        set({ isLoading: true, error: null });

        try {
          // Fetch all earnings data in parallel
          const [todaysData, weeklyData] = await Promise.all([
            fetchTodaysEarnings(),
            fetchWeeklyEarnings(),
          ]);

          set({
            todaysEarnings: todaysData,
            weeklyEarnings: weeklyData,
            lastUpdated: new Date().toISOString(),
            isHydrated: true,
            isLoading: false,
            error: null,
          });

          console.log(
            `✅ Earnings hydration complete: ${todaysData.length} today, ${weeklyData.length} this week`
          );
        } catch (error) {
          console.error("❌ Failed to hydrate earnings data:", error);
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to load earnings data",
            isLoading: false,
          });
        }
      },

      // Refresh earnings data (called when user visits market overview)
      refreshEarningsData: async () => {
        const state = get();

        // Skip if data is fresh
        if (!state.shouldRefresh()) {
          console.log("📊 Earnings data is fresh, skipping refresh");
          return;
        }

        console.log("🔄 Refreshing earnings data...");
        set({ isLoading: true, error: null });

        try {
          // Fetch all earnings data in parallel
          const [todaysData, weeklyData, upcomingData, recentData] =
            await Promise.all([
              fetchTodaysEarnings(),
              fetchWeeklyEarnings(),
              fetchUpcomingEarnings([], 60), // Get general upcoming earnings
              fetchRecentEarnings([], 14), // Get general recent earnings
            ]);

          set({
            todaysEarnings: todaysData,
            weeklyEarnings: weeklyData,
            upcomingEarnings: upcomingData,
            recentEarnings: recentData,
            lastUpdated: new Date().toISOString(),
            isHydrated: true,
            isLoading: false,
            error: null,
          });

          console.log(
            `✅ Earnings refresh complete: ${todaysData.length} today, ${weeklyData.length} weekly, ${upcomingData.length} upcoming, ${recentData.length} recent`
          );
        } catch (error) {
          console.error("❌ Failed to refresh earnings data:", error);
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to refresh earnings data",
            isLoading: false,
          });
        }
      },

      // Clear cache
      clearCache: () => {
        set({
          todaysEarnings: [],
          weeklyEarnings: [],
          upcomingEarnings: [],
          recentEarnings: [],
          lastUpdated: null,
          isHydrated: false,
          error: null,
        });
      },
    }),
    {
      name: "earnings-store",
      partialize: (state) => ({
        todaysEarnings: state.todaysEarnings,
        weeklyEarnings: state.weeklyEarnings,
        upcomingEarnings: state.upcomingEarnings,
        recentEarnings: state.recentEarnings,
        lastUpdated: state.lastUpdated,
        isHydrated: state.isHydrated,
      }),
    }
  )
);
