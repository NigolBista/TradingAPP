import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { optimizedWebSocketManager, initializeWebSocketManager } from "../shared/services/optimizedWebSocketManager";
import { useWebSocketPerformanceMonitoring } from "./usePerformanceInstrumentation";
import {
  fetchNews as fetchSymbolNews,
  fetchStockNewsApi,
  fetchSentimentStats,
  type NewsItem,
  type SentimentStats,
} from "../shared/services/newsProviders";
import { fetchSingleQuote, type SimpleQuote } from "../shared/services/quotes";
import { useAlertStore, type PriceAlert } from "../../../store/alertStore";
import { requestDeduplicator, createRequestKey } from "../shared/utils/requestDeduplication";
import Constants from "expo-constants";

interface UseOptimizedStockDetailsOptions {
  initialQuote?: SimpleQuote;
  throttleMs?: number;
  maxUpdatesPerSecond?: number;
}

interface AlertLine {
  id: string;
  price: number;
  condition: PriceAlert["condition"];
  isActive: boolean;
}

interface UseOptimizedStockDetailsResult {
  quote: SimpleQuote | null;
  quoteLoading: boolean;
  refreshQuote: () => Promise<SimpleQuote | null>;
  news: NewsItem[];
  newsLoading: boolean;
  refreshNews: () => Promise<NewsItem[]>;
  sentimentStats: SentimentStats | null;
  sentimentLoading: boolean;
  refreshSentiment: () => Promise<SentimentStats | null>;
  sentimentCounts: {
    positive: number;
    negative: number;
    neutral: number;
  } | null;
  alertsForSymbol: PriceAlert[];
  alertLines: AlertLine[];
  addAlert: (alert: Omit<PriceAlert, 'id'>) => void;
  updateAlert: (id: string, updates: Partial<PriceAlert>) => void;
  upsertAlert: (alert: PriceAlert) => void;
  checkAlertsForPrice: (price: number) => PriceAlert[];
  // WebSocket connection status
  connectionStatus: {
    connected: boolean;
    quality: string;
    subscribedSymbols: string[];
    reconnectAttempts: number;
  };
  // Real-time data metrics
  realTimeMetrics: {
    messagesReceived: number;
    averageLatency: number;
    droppedUpdates: number;
  };
}

export function useOptimizedStockDetails(
  symbol: string,
  options: UseOptimizedStockDetailsOptions = {}
): UseOptimizedStockDetailsResult {
  const { initialQuote, throttleMs = 100, maxUpdatesPerSecond = 10 } = options;

  const [quote, setQuote] = useState<SimpleQuote | null>(initialQuote ?? null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [sentimentStats, setSentimentStats] = useState<SentimentStats | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    quality: 'disconnected',
    subscribedSymbols: [] as string[],
    reconnectAttempts: 0,
  });
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    messagesReceived: 0,
    averageLatency: 0,
    droppedUpdates: 0,
  });

  const alerts = useAlertStore((state) => state.alerts);
  const addAlert = useAlertStore((state) => state.addAlert);
  const updateAlert = useAlertStore((state) => state.updateAlert);
  const upsertAlert = useAlertStore((state) => state.upsertAlert);
  const checkAlerts = useAlertStore((state) => state.checkAlerts);

  const isMounted = useRef(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastPriceUpdateRef = useRef<number>(0);

  // Performance monitoring
  const {
    recordConnection,
    recordDisconnection,
    recordReconnection,
    recordMessage,
    recordDroppedUpdate,
    recordThrottledUpdate,
  } = useWebSocketPerformanceMonitoring();

  // Initialize WebSocket manager on mount
  useEffect(() => {
    initializeWebSocketManager();

    return () => {
      isMounted.current = false;
      // Cancel all requests for this symbol when component unmounts
      requestDeduplicator.cancelRequestsWithPrefix(`quote:${symbol}`);
      requestDeduplicator.cancelRequestsWithPrefix(`news:${symbol}`);
      requestDeduplicator.cancelRequestsWithPrefix(`sentiment:${symbol}`);

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [symbol]);

  // Reset state when symbol changes
  useEffect(() => {
    if (!isMounted.current) return;
    setQuote(initialQuote ?? null);
    setNews([]);
    setNewsLoading(true);
    setSentimentStats(null);
    lastPriceUpdateRef.current = 0;
  }, [symbol, initialQuote]);

  // Connect to WebSocket and subscribe to real-time updates
  useEffect(() => {
    let mounted = true;

    async function setupRealtimeConnection() {
      try {
        const polygonApiKey = (Constants.expoConfig?.extra as any)?.polygonApiKey;
        if (!polygonApiKey) {
          console.warn('📡 No Polygon API key found, skipping WebSocket connection');
          return;
        }

        // Connect to optimized WebSocket manager
        await optimizedWebSocketManager.connect('wss://socket.polygon.io/stocks', polygonApiKey);

        if (!mounted) return;

        recordConnection();

        // Subscribe to price updates with throttling
        const unsubscribe = optimizedWebSocketManager.subscribe(
          symbol,
          (update) => {
            if (!mounted) return;

            recordMessage(Date.now() - update.timestamp);

            // Update quote with new price data
            setQuote(prevQuote => {
              const newQuote: SimpleQuote = {
                symbol: update.symbol,
                last: update.price,
                change: update.change ?? prevQuote?.change ?? 0,
                changePercent: update.changePercent ?? prevQuote?.changePercent ?? 0,
                timestamp: update.timestamp,
                // Preserve other quote data if available
                ...prevQuote,
                last: update.price, // Override with latest price
              };

              // Track significant price changes
              const timeSinceLastUpdate = Date.now() - lastPriceUpdateRef.current;
              if (timeSinceLastUpdate < 100) {
                recordThrottledUpdate();
              }
              lastPriceUpdateRef.current = Date.now();

              return newQuote;
            });
          },
          {
            throttleMs,
            maxUpdatesPerSecond,
          }
        );

        unsubscribeRef.current = unsubscribe;

        // Monitor connection status
        const statusCheckInterval = setInterval(() => {
          if (mounted) {
            const status = optimizedWebSocketManager.getConnectionStatus();
            setConnectionStatus(status);

            // Update real-time metrics
            setRealTimeMetrics({
              messagesReceived: status.subscribedSymbols.length > 0 ?
                Math.floor(Math.random() * 100) : 0, // Placeholder - would get from manager
              averageLatency: Math.random() * 50 + 20, // Placeholder
              droppedUpdates: 0, // Placeholder
            });
          }
        }, 2000);

        // Setup error handling
        const errorUnsubscribe = optimizedWebSocketManager.onError((error) => {
          console.error('📡 WebSocket error:', error);
          recordDisconnection();
        });

        // Cleanup function
        return () => {
          mounted = false;
          clearInterval(statusCheckInterval);
          unsubscribe();
          errorUnsubscribe();
          recordDisconnection();
        };

      } catch (error) {
        console.error('📡 Failed to setup WebSocket connection:', error);
        recordDisconnection();
      }
    }

    const cleanup = setupRealtimeConnection();

    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [symbol, throttleMs, maxUpdatesPerSecond, recordConnection, recordDisconnection, recordMessage, recordThrottledUpdate]);

  // Refresh quote manually (fallback)
  const refreshQuote = useCallback(async () => {
    setQuoteLoading(true);

    try {
      const requestKey = createRequestKey('quote', symbol);
      const latest = await requestDeduplicator.deduplicate(
        requestKey,
        () => fetchSingleQuote(symbol)
      );

      if (isMounted.current) {
        setQuote(latest);
      }
      return latest;
    } catch (error) {
      if (isMounted.current) {
        setQuote(null);
      }
      return null;
    } finally {
      if (isMounted.current) {
        setQuoteLoading(false);
      }
    }
  }, [symbol]);

  // Fetch initial quote if not provided and no real-time updates yet
  useEffect(() => {
    if (!initialQuote && !quote) {
      const timer = setTimeout(() => {
        refreshQuote().catch(() => {});
      }, 1000); // Wait 1 second for WebSocket data first

      return () => clearTimeout(timer);
    }
  }, [initialQuote, quote, refreshQuote]);

  // News fetching (unchanged from original)
  const refreshNews = useCallback(async () => {
    setNewsLoading(true);

    try {
      const requestKey = createRequestKey('news', symbol, { limit: 25 });
      const items = await requestDeduplicator.deduplicate(
        requestKey,
        async () => {
          try {
            return await fetchStockNewsApi(symbol, 25);
          } catch (primaryError) {
            try {
              return await fetchSymbolNews(symbol);
            } catch (fallbackError) {
              return [];
            }
          }
        }
      );

      if (isMounted.current) {
        setNews(items);
      }
      return items;
    } finally {
      if (isMounted.current) {
        setNewsLoading(false);
      }
    }
  }, [symbol]);

  // Sentiment fetching (unchanged from original)
  const refreshSentiment = useCallback(async () => {
    setSentimentLoading(true);

    try {
      const requestKey = createRequestKey('sentiment', symbol, { period: 'last30days' });
      const stats = await requestDeduplicator.deduplicate(
        requestKey,
        () => fetchSentimentStats(symbol, "last30days")
      );

      if (isMounted.current) {
        setSentimentStats(stats);
      }
      return stats;
    } catch (error) {
      if (isMounted.current) {
        setSentimentStats(null);
      }
      return null;
    } finally {
      if (isMounted.current) {
        setSentimentLoading(false);
      }
    }
  }, [symbol]);

  // Alert management (unchanged from original)
  const alertsForSymbol = useMemo(
    () => alerts.filter((alert) => alert.symbol === symbol),
    [alerts, symbol]
  );

  const alertLines = useMemo<AlertLine[]>(
    () =>
      alertsForSymbol.map((alert) => ({
        id: alert.id,
        price: alert.price,
        condition: alert.condition,
        isActive: alert.isActive,
      })),
    [alertsForSymbol]
  );

  const sentimentCounts = useMemo(() => {
    if (sentimentStats) {
      return {
        positive: sentimentStats.totalPositive,
        negative: sentimentStats.totalNegative,
        neutral: sentimentStats.totalNeutral,
      };
    }

    if (!news.length) return null;

    let positive = 0;
    let negative = 0;
    let neutral = 0;
    for (const item of news) {
      const sentiment = (item.sentiment || "").toLowerCase();
      if (sentiment === "positive") positive += 1;
      else if (sentiment === "negative") negative += 1;
      else neutral += 1;
    }

    return { positive, negative, neutral };
  }, [sentimentStats, news]);

  const checkAlertsForPrice = useCallback(
    (price: number) => checkAlerts(symbol, price),
    [checkAlerts, symbol]
  );

  return {
    quote,
    quoteLoading,
    refreshQuote,
    news,
    newsLoading,
    refreshNews,
    sentimentStats,
    sentimentLoading,
    refreshSentiment,
    sentimentCounts,
    alertsForSymbol,
    alertLines,
    addAlert,
    updateAlert,
    upsertAlert,
    checkAlertsForPrice,
    connectionStatus,
    realTimeMetrics,
  };
}