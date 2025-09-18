import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

interface UseStockDetailsOptions {
  initialQuote?: SimpleQuote;
}

interface AlertLine {
  id: string;
  price: number;
  condition: PriceAlert["condition"];
  isActive: boolean;
}

type AlertStoreState = ReturnType<typeof useAlertStore.getState>;
type AlertStorePick = Pick<
  AlertStoreState,
  "addAlert" | "updateAlert" | "upsertAlert" | "checkAlerts" | "alerts"
>;

interface UseStockDetailsResult {
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
  addAlert: AlertStorePick["addAlert"];
  updateAlert: AlertStorePick["updateAlert"];
  upsertAlert: AlertStorePick["upsertAlert"];
  checkAlertsForPrice: (price: number) => PriceAlert[];
}

export function useStockDetails(
  symbol: string,
  options: UseStockDetailsOptions = {}
): UseStockDetailsResult {
  const { initialQuote } = options;

  const [quote, setQuote] = useState<SimpleQuote | null>(initialQuote ?? null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [sentimentStats, setSentimentStats] =
    useState<SentimentStats | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);

  const alerts = useAlertStore((state) => state.alerts);
  const addAlert = useAlertStore((state) => state.addAlert);
  const updateAlert = useAlertStore((state) => state.updateAlert);
  const upsertAlert = useAlertStore((state) => state.upsertAlert);
  const checkAlerts = useAlertStore((state) => state.checkAlerts);

  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Cancel all requests for this symbol when component unmounts
      requestDeduplicator.cancelRequestsWithPrefix(`quote:${symbol}`);
      requestDeduplicator.cancelRequestsWithPrefix(`news:${symbol}`);
      requestDeduplicator.cancelRequestsWithPrefix(`sentiment:${symbol}`);
    };
  }, [symbol]);

  useEffect(() => {
    if (!isMounted.current) return;
    setQuote(initialQuote ?? null);
    setNews([]);
    setNewsLoading(true);
    setSentimentStats(null);
  }, [symbol, initialQuote]);

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

  useEffect(() => {
    if (!initialQuote) {
      refreshQuote().catch(() => {});
    }
  }, [initialQuote, refreshQuote]);

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
  };
}
