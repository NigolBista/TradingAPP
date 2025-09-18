import { StateCreator } from 'zustand';
import { AppState, StoreActions, MarketState } from '../types';
import { MarketDataRepository } from '../../services/repositories/MarketDataRepository';

// Initial market state
const initialMarketState: MarketState = {
  quotes: {},
  charts: {},
  news: {
    global: [],
    bySymbol: {},
  },
  marketSummary: null,
  watchlists: {},
  searchResults: {},
  trends: {
    gainers: [],
    losers: [],
    mostActive: [],
  },
  _meta: {
    lastUpdated: 0,
    isLoading: false,
    error: null,
  },
};

// Market slice creator
export const createMarketSlice: StateCreator<
  AppState & StoreActions,
  [],
  [],
  MarketState & Pick<StoreActions, 'getQuote' | 'getChart' | 'searchSymbols' | 'refreshMarketSummary' | 'updateWatchlist'>
> = (set, get) => ({
  ...initialMarketState,

  // Market actions
  getQuote: async (symbol) => {
    const marketRepo = new MarketDataRepository(get().apiClient);

      try {
        const response = await marketRepo.getQuote(symbol);
        const quote = response.data;

        set((state) => ({
          market: {
            ...state.market,
            quotes: {
              ...state.market.quotes,
              [symbol]: quote,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));

        return quote;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        set((state) => ({
          market: {
            ...state.market,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: errorMessage,
            },
          },
        }));
        throw error;
      }
    },

    // Get chart data
    getChart: async (symbol, timeframe) => {
      const marketRepo = new MarketDataRepository(get().apiClient);
      const chartKey = `${symbol}:${timeframe}`;

      try {
        const response = await marketRepo.getChartData(symbol, timeframe);
        const chartData = response.data;

        set((state) => ({
          market: {
            ...state.market,
            charts: {
              ...state.market.charts,
              [chartKey]: chartData,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));

        return chartData;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        set((state) => ({
          market: {
            ...state.market,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: errorMessage,
            },
          },
        }));
        throw error;
      }
    },

    // Search symbols
    searchSymbols: async (query) => {
      const marketRepo = new MarketDataRepository(get().apiClient);

      try {
        const response = await marketRepo.searchSymbols(query);
        const results = response.data;

        set((state) => ({
          market: {
            ...state.market,
            searchResults: {
              ...state.market.searchResults,
              [query]: results,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));

        return results;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        set((state) => ({
          market: {
            ...state.market,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: errorMessage,
            },
          },
        }));
        throw error;
      }
    },

    // Refresh market summary
    refreshMarketSummary: async () => {
      const marketRepo = new MarketDataRepository(get().apiClient);

      set((state) => ({
        market: {
          ...state.market,
          _meta: { ...state.market._meta, isLoading: true, error: null },
        },
      }));

      try {
        const response = await marketRepo.getMarketSummary();
        const marketSummary = response.data;

        set((state) => ({
          market: {
            ...state.market,
            marketSummary,
            trends: {
              gainers: marketSummary.movers.gainers,
              losers: marketSummary.movers.losers,
              mostActive: marketSummary.movers.mostActive,
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        set((state) => ({
          market: {
            ...state.market,
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: errorMessage,
            },
          },
        }));
        throw error;
      }
    },

    // Update watchlist
    updateWatchlist: async (watchlistId, updates) => {
      // This would integrate with UserRepository for watchlist management
      try {
        // For now, update locally
        set((state) => ({
          market: {
            ...state.market,
            watchlists: {
              ...state.market.watchlists,
              [watchlistId]: {
                ...state.market.watchlists[watchlistId],
                ...updates,
              },
            },
            _meta: {
              lastUpdated: Date.now(),
              isLoading: false,
              error: null,
            },
          },
        }));
      } catch (error) {
        console.error('Failed to update watchlist:', error);
        throw error;
      }
    },
});

// Market-related selectors
export const marketSelectors = {
  // Quotes
  quoteForSymbol: (symbol: string) => (state: AppState) => state.market.quotes[symbol],
  allQuotes: (state: AppState) => Object.values(state.market.quotes),

  // Charts
  chartForSymbol: (symbol: string, timeframe: string) => (state: AppState) =>
    state.market.charts[`${symbol}:${timeframe}`],

  // News
  globalNews: (state: AppState) => state.market.news.global,
  newsForSymbol: (symbol: string) => (state: AppState) =>
    state.market.news.bySymbol[symbol] || [],

  // Market summary
  marketSummary: (state: AppState) => state.market.marketSummary,
  indices: (state: AppState) => state.market.marketSummary?.indices || [],
  sectors: (state: AppState) => state.market.marketSummary?.sectors || [],

  // Trends
  topGainers: (state: AppState) => state.market.trends.gainers,
  topLosers: (state: AppState) => state.market.trends.losers,
  mostActive: (state: AppState) => state.market.trends.mostActive,

  // Search
  searchResults: (query: string) => (state: AppState) =>
    state.market.searchResults[query] || [],

  // Watchlists
  watchlist: (watchlistId: string) => (state: AppState) =>
    state.market.watchlists[watchlistId],
  allWatchlists: (state: AppState) => Object.values(state.market.watchlists),

  // Loading states
  isLoading: (state: AppState) => state.market._meta.isLoading,
  error: (state: AppState) => state.market._meta.error,
  lastUpdated: (state: AppState) => state.market._meta.lastUpdated,
};