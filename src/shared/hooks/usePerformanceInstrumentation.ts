import { useEffect, useCallback, useRef } from 'react';
import { performanceMonitor, measureAsync } from "../utils/performanceMonitor";

/**
 * Hook to instrument StockDetail screen performance
 */
export function useStockDetailPerformance(symbol: string) {
  const mountTime = useRef(performance.now());
  const hasRecordedFirstRender = useRef(false);

  // Record component mount
  useEffect(() => {
    performanceMonitor.startTiming('stockdetail_mount');
    performanceMonitor.startRenderMonitoring();

    if (!hasRecordedFirstRender.current) {
      performanceMonitor.recordMetric('time_to_first_render', performance.now() - mountTime.current);
      hasRecordedFirstRender.current = true;
    }

    return () => {
      performanceMonitor.endTiming('stockdetail_mount');
      performanceMonitor.stop();
    };
  }, []);

  // Record symbol changes
  useEffect(() => {
    performanceMonitor.recordMetric('symbol_change', 0, { symbol });
  }, [symbol]);

  // Instrumented data fetchers
  const instrumentedRefreshQuote = useCallback(async (refreshFn: () => Promise<any>) => {
    return measureAsync('quote_fetch', refreshFn, { symbol });
  }, [symbol]);

  const instrumentedRefreshNews = useCallback(async (refreshFn: () => Promise<any>) => {
    return measureAsync('news_fetch', refreshFn, { symbol });
  }, [symbol]);

  const instrumentedRefreshSentiment = useCallback(async (refreshFn: () => Promise<any>) => {
    return measureAsync('sentiment_fetch', refreshFn, { symbol });
  }, [symbol]);

  const instrumentedChartDataFetch = useCallback(async (fetchFn: () => Promise<any>) => {
    return measureAsync('chart_data_fetch', fetchFn, { symbol });
  }, [symbol]);

  // Record render cycles
  const recordRender = useCallback((componentName: string) => {
    const renderTime = performance.now();
    performanceMonitor.recordRender(renderTime);
    performanceMonitor.recordMetric(`${componentName}_render`, renderTime);
  }, []);

  // Record price updates (for real-time data)
  const recordPriceUpdate = useCallback((latency?: number) => {
    performanceMonitor.recordPriceUpdateReceived();
    if (latency !== undefined) {
      performanceMonitor.recordWebSocketMessage(latency);
    }
  }, []);

  // Record when price updates are applied to UI
  const recordPriceUpdateApplied = useCallback(() => {
    performanceMonitor.recordPriceUpdateApplied();
  }, []);

  // Get current performance metrics
  const getMetrics = useCallback(() => {
    return performanceMonitor.getMetrics();
  }, []);

  // Export performance data
  const exportMetrics = useCallback(() => {
    return performanceMonitor.exportMetrics();
  }, []);

  return {
    instrumentedRefreshQuote,
    instrumentedRefreshNews,
    instrumentedRefreshSentiment,
    instrumentedChartDataFetch,
    recordRender,
    recordPriceUpdate,
    recordPriceUpdateApplied,
    getMetrics,
    exportMetrics,
  };
}

/**
 * Hook to monitor WebSocket performance specifically
 */
export function useWebSocketPerformanceMonitoring() {
  useEffect(() => {
    performanceMonitor.startWebSocketMonitoring();

    return () => {
      performanceMonitor.stop();
    };
  }, []);

  const recordConnection = useCallback(() => {
    performanceMonitor.recordMetric('ws_connection_established');
  }, []);

  const recordDisconnection = useCallback(() => {
    performanceMonitor.recordMetric('ws_connection_lost');
  }, []);

  const recordReconnection = useCallback(() => {
    performanceMonitor.recordWebSocketReconnect();
  }, []);

  const recordMessage = useCallback((latency?: number) => {
    performanceMonitor.recordWebSocketMessage(latency);
  }, []);

  const recordDroppedUpdate = useCallback(() => {
    performanceMonitor.recordDroppedUpdate();
  }, []);

  const recordThrottledUpdate = useCallback(() => {
    performanceMonitor.recordThrottledUpdate();
  }, []);

  return {
    recordConnection,
    recordDisconnection,
    recordReconnection,
    recordMessage,
    recordDroppedUpdate,
    recordThrottledUpdate,
  };
}