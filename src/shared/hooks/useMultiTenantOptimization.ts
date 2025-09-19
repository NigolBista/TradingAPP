import { useState, useEffect, useCallback } from 'react';
import { multiTenantManager, SystemSummary } from '../services/MultiTenantManager';
import { Quote } from '../services/BatchDataFetcher';

// Hook for multi-tenant cost optimization
export interface MultiTenantState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  systemSummary: SystemSummary | null;
  costSavingsPercentage: number;
  cacheHitRate: number;
}

export interface MultiTenantActions {
  initialize: () => Promise<void>;
  subscribeToTickers: (userId: string, tickers: string[]) => Promise<void>;
  unsubscribeUser: (userId: string) => Promise<void>;
  getQuote: (ticker: string) => Promise<Quote>;
  getQuotes: (tickers: string[]) => Promise<Quote[]>;
  summarizeNews: (article: any) => Promise<any>;
  getOptimizationRecommendations: () => Promise<string[]>;
  refreshSystemSummary: () => Promise<void>;
}

/**
 * React Hook for Multi-Tenant Cost Optimization
 *
 * This hook provides a React-friendly interface to the multi-tenant optimization system.
 * It handles initialization, state management, and provides easy-to-use methods for
 * cost-optimized operations.
 *
 * Example usage:
 * ```typescript
 * const { state, actions } = useMultiTenantOptimization();
 *
 * // Initialize the system
 * useEffect(() => {
 *   actions.initialize();
 * }, []);
 *
 * // Subscribe user to tickers
 * const handleSubscribe = async () => {
 *   await actions.subscribeToTickers(userId, ['AAPL', 'TSLA', 'MSFT']);
 * };
 *
 * // Get optimized quotes
 * const quotes = await actions.getQuotes(['AAPL', 'TSLA']);
 * ```
 */
export function useMultiTenantOptimization() {
  const [state, setState] = useState<MultiTenantState>({
    isInitialized: false,
    isLoading: false,
    error: null,
    systemSummary: null,
    costSavingsPercentage: 0,
    cacheHitRate: 0
  });

  /**
   * Initialize the multi-tenant system
   */
  const initialize = useCallback(async () => {
    if (state.isInitialized || state.isLoading) {
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await multiTenantManager.initialize();

      // Get initial system summary
      const summary = await multiTenantManager.getSystemSummary();

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        systemSummary: summary,
        costSavingsPercentage: summary.costOptimization.costSavingsPercentage,
        cacheHitRate: summary.costOptimization.cacheHitRate
      }));

      console.log('✅ Multi-tenant optimization initialized via hook');

    } catch (error) {
      console.error('❌ Failed to initialize multi-tenant system:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize system'
      }));
    }
  }, [state.isInitialized, state.isLoading]);

  /**
   * Subscribe user to tickers with cost optimization
   */
  const subscribeToTickers = useCallback(async (userId: string, tickers: string[]) => {
    if (!state.isInitialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    try {
      await multiTenantManager.subscribeUserToTickers(userId, tickers);

      // Refresh system summary to reflect changes
      await refreshSystemSummary();

    } catch (error) {
      console.error('Error subscribing to tickers:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to subscribe to tickers'
      }));
      throw error;
    }
  }, [state.isInitialized]);

  /**
   * Unsubscribe user from all tickers
   */
  const unsubscribeUser = useCallback(async (userId: string) => {
    if (!state.isInitialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    try {
      await multiTenantManager.unsubscribeUser(userId);

      // Refresh system summary to reflect changes
      await refreshSystemSummary();

    } catch (error) {
      console.error('Error unsubscribing user:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe user'
      }));
      throw error;
    }
  }, [state.isInitialized]);

  /**
   * Get optimized quote for single ticker
   */
  const getQuote = useCallback(async (ticker: string): Promise<Quote> => {
    if (!state.isInitialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    try {
      return await multiTenantManager.getQuote(ticker);
    } catch (error) {
      console.error(`Error getting quote for ${ticker}:`, error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : `Failed to get quote for ${ticker}`
      }));
      throw error;
    }
  }, [state.isInitialized]);

  /**
   * Get optimized quotes for multiple tickers
   */
  const getQuotes = useCallback(async (tickers: string[]): Promise<Quote[]> => {
    if (!state.isInitialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    try {
      return await multiTenantManager.getQuotes(tickers);
    } catch (error) {
      console.error('Error getting quotes:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to get quotes'
      }));
      throw error;
    }
  }, [state.isInitialized]);

  /**
   * Summarize news with cost optimization
   */
  const summarizeNews = useCallback(async (article: any) => {
    if (!state.isInitialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    try {
      return await multiTenantManager.summarizeNews(article);
    } catch (error) {
      console.error('Error summarizing news:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to summarize news'
      }));
      throw error;
    }
  }, [state.isInitialized]);

  /**
   * Get optimization recommendations
   */
  const getOptimizationRecommendations = useCallback(async (): Promise<string[]> => {
    if (!state.isInitialized) {
      return ['System not initialized'];
    }

    try {
      return await multiTenantManager.getOptimizationRecommendations();
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return ['Failed to get recommendations'];
    }
  }, [state.isInitialized]);

  /**
   * Refresh system summary
   */
  const refreshSystemSummary = useCallback(async () => {
    if (!state.isInitialized) {
      return;
    }

    try {
      const summary = await multiTenantManager.getSystemSummary();

      setState(prev => ({
        ...prev,
        systemSummary: summary,
        costSavingsPercentage: summary.costOptimization.costSavingsPercentage,
        cacheHitRate: summary.costOptimization.cacheHitRate,
        error: null
      }));

    } catch (error) {
      console.error('Error refreshing system summary:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to refresh system summary'
      }));
    }
  }, [state.isInitialized]);

  /**
   * Auto-refresh system summary every 5 minutes
   */
  useEffect(() => {
    if (!state.isInitialized) return;

    const interval = setInterval(refreshSystemSummary, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [state.isInitialized, refreshSystemSummary]);

  /**
   * Clear error when state changes
   */
  useEffect(() => {
    if (state.error) {
      const timeout = setTimeout(() => {
        setState(prev => ({ ...prev, error: null }));
      }, 10000); // Clear error after 10 seconds

      return () => clearTimeout(timeout);
    }
  }, [state.error]);

  const actions: MultiTenantActions = {
    initialize,
    subscribeToTickers,
    unsubscribeUser,
    getQuote,
    getQuotes,
    summarizeNews,
    getOptimizationRecommendations,
    refreshSystemSummary
  };

  return {
    state,
    actions,

    // Convenience getters
    isReady: state.isInitialized && !state.isLoading,
    hasError: !!state.error,
    isHealthy: multiTenantManager.isSystemHealthy(),

    // Quick access to key metrics
    metrics: {
      costSavings: state.costSavingsPercentage,
      cacheHitRate: state.cacheHitRate,
      totalUsers: state.systemSummary?.totalUsers || 0,
      uniqueTickers: state.systemSummary?.uniqueTickers || 0
    }
  };
}

// Additional hooks for specific use cases

/**
 * Hook for optimized ticker subscriptions
 */
export function useOptimizedTickerSubscription(userId: string, tickers: string[]) {
  const { state, actions } = useMultiTenantOptimization();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.isInitialized || tickers.length === 0) return;

    const subscribe = async () => {
      try {
        setSubscriptionError(null);
        await actions.subscribeToTickers(userId, tickers);
        setIsSubscribed(true);
      } catch (error) {
        setSubscriptionError(error instanceof Error ? error.message : 'Subscription failed');
        setIsSubscribed(false);
      }
    };

    subscribe();

    // Cleanup: unsubscribe when component unmounts or tickers change
    return () => {
      if (isSubscribed) {
        actions.unsubscribeUser(userId).catch(console.error);
      }
    };
  }, [state.isInitialized, userId, tickers.join(','), actions]);

  return {
    isSubscribed,
    subscriptionError,
    costSavingsPercentage: state.costSavingsPercentage
  };
}

/**
 * Hook for optimized quote fetching
 */
export function useOptimizedQuotes(tickers: string[], refreshInterval: number = 15000) {
  const { state, actions } = useMultiTenantOptimization();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotes = useCallback(async () => {
    if (!state.isInitialized || tickers.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const newQuotes = await actions.getQuotes(tickers);
      setQuotes(newQuotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quotes');
    } finally {
      setIsLoading(false);
    }
  }, [state.isInitialized, tickers.join(','), actions]);

  // Initial fetch
  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchQuotes, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchQuotes, refreshInterval]);

  return {
    quotes,
    isLoading,
    error,
    refresh: fetchQuotes,
    cacheHitRate: state.cacheHitRate
  };
}

/**
 * Hook for optimized news summarization
 */
export function useOptimizedNewsSummary() {
  const { state, actions } = useMultiTenantOptimization();

  const summarizeArticle = useCallback(async (article: any) => {
    if (!state.isInitialized) {
      throw new Error('System not initialized');
    }

    return await actions.summarizeNews(article);
  }, [state.isInitialized, actions]);

  const summarizeArticles = useCallback(async (articles: any[]) => {
    if (!state.isInitialized) {
      throw new Error('System not initialized');
    }

    // Process articles in parallel with cost optimization
    const summaries = await Promise.allSettled(
      articles.map(article => actions.summarizeNews(article))
    );

    return summaries.map((result, index) => ({
      article: articles[index],
      summary: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }, [state.isInitialized, actions]);

  return {
    summarizeArticle,
    summarizeArticles,
    isReady: state.isInitialized
  };
}