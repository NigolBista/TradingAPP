import { batchDataFetcher } from './BatchDataFetcher';
import { webSocketMultiplexer } from './WebSocketMultiplexer';
import { sharedAlertProcessor } from './SharedAlertProcessor';
import { serverSummarizationService } from './ServerSummarizationService';
import { costTrackingService } from './CostTrackingService';

// Types for the manager
export interface MultiTenantConfig {
  enableBatchProcessing: boolean;
  enableWebSocketMultiplexing: boolean;
  enableSharedAlertProcessing: boolean;
  enableServerSummarization: boolean;
  enableCostTracking: boolean;
  autoStart: boolean;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  uptime: number;
  metrics?: Record<string, any>;
}

export interface SystemSummary {
  totalUsers: number;
  totalSubscriptions: number;
  uniqueTickers: number;
  costOptimization: {
    dailyCostCents: number;
    costSavingsPercentage: number;
    cacheHitRate: number;
  };
  performance: {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
  };
  health: ServiceHealth[];
}

/**
 * Multi-Tenant Manager for coordinating all cost optimization services
 *
 * Key Features:
 * - Centralized service management and coordination
 * - Health monitoring and automatic recovery
 * - Cost optimization analytics and reporting
 * - Service lifecycle management
 * - Integration with existing app components
 */
export class MultiTenantManager {
  private config: MultiTenantConfig;
  private isInitialized = false;
  private services = {
    batchDataFetcher,
    webSocketMultiplexer,
    sharedAlertProcessor,
    serverSummarizationService,
    costTrackingService
  };

  constructor(config: Partial<MultiTenantConfig> = {}) {
    this.config = {
      enableBatchProcessing: true,
      enableWebSocketMultiplexing: true,
      enableSharedAlertProcessing: true,
      enableServerSummarization: true,
      enableCostTracking: true,
      autoStart: true,
      ...config
    };
  }

  /**
   * Initialize all enabled services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ Multi-tenant manager already initialized');
      return;
    }

    console.log('🚀 Initializing multi-tenant cost optimization system...');

    try {
      // Initialize services in order of dependency
      if (this.config.enableCostTracking) {
        console.log('📊 Starting cost tracking service...');
        // Cost tracking service starts automatically in constructor
      }

      if (this.config.enableBatchProcessing) {
        console.log('📦 Batch data fetcher ready...');
        // Batch data fetcher is ready to use
      }

      if (this.config.enableWebSocketMultiplexing) {
        console.log('📡 Starting WebSocket multiplexer...');
        await this.services.webSocketMultiplexer.connect();
      }

      if (this.config.enableSharedAlertProcessing) {
        console.log('🔔 Starting shared alert processor...');
        this.services.sharedAlertProcessor.start();
      }

      if (this.config.enableServerSummarization) {
        console.log('🤖 Server summarization service ready...');
        // Summarization service is ready to use
      }

      this.isInitialized = true;
      console.log('✅ Multi-tenant system initialized successfully');

      // Log initial system summary
      const summary = await this.getSystemSummary();
      console.log('📋 Initial System Summary:', {
        users: summary.totalUsers,
        subscriptions: summary.totalSubscriptions,
        tickers: summary.uniqueTickers,
        costSavings: summary.costOptimization.costSavingsPercentage.toFixed(1) + '%'
      });

    } catch (error) {
      console.error('❌ Failed to initialize multi-tenant system:', error);
      throw error;
    }
  }

  /**
   * Shutdown all services gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      console.log('⚠️ Multi-tenant manager not initialized');
      return;
    }

    console.log('🛑 Shutting down multi-tenant system...');

    try {
      // Shutdown services in reverse order
      if (this.config.enableSharedAlertProcessing) {
        this.services.sharedAlertProcessor.stop();
      }

      if (this.config.enableWebSocketMultiplexing) {
        this.services.webSocketMultiplexer.disconnect();
      }

      if (this.config.enableCostTracking) {
        this.services.costTrackingService.stopMonitoring();
      }

      // Clear caches
      this.services.batchDataFetcher.clearCaches();

      this.isInitialized = false;
      console.log('✅ Multi-tenant system shutdown complete');

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  /**
   * Subscribe user to multiple tickers efficiently
   */
  async subscribeUserToTickers(userId: string, tickers: string[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Multi-tenant manager not initialized');
    }

    try {
      console.log(`👤 Subscribing user ${userId} to ${tickers.length} tickers...`);

      // Use WebSocket multiplexer for real-time subscriptions
      if (this.config.enableWebSocketMultiplexing) {
        await this.services.webSocketMultiplexer.subscribeUserToTickers(userId, tickers);
      }

      // Track the subscription cost
      if (this.config.enableCostTracking) {
        await this.services.costTrackingService.trackCost(
          'user_subscription',
          'ticker_subscription',
          tickers.length,
          0 // No direct cost for subscription
        );
      }

      console.log(`✅ User ${userId} subscribed to ${tickers.length} tickers`);

    } catch (error) {
      console.error('Error subscribing user to tickers:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from all tickers
   */
  async unsubscribeUser(userId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Multi-tenant manager not initialized');
    }

    try {
      console.log(`👤 Unsubscribing user ${userId} from all tickers...`);

      if (this.config.enableWebSocketMultiplexing) {
        await this.services.webSocketMultiplexer.unsubscribeUserFromAll(userId);
      }

      console.log(`✅ User ${userId} unsubscribed from all tickers`);

    } catch (error) {
      console.error('Error unsubscribing user:', error);
      throw error;
    }
  }

  /**
   * Get real-time quote for ticker (uses batch optimization)
   */
  async getQuote(ticker: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Multi-tenant manager not initialized');
    }

    try {
      if (this.config.enableBatchProcessing) {
        return await this.services.batchDataFetcher.fetchQuote(ticker);
      } else {
        throw new Error('Batch processing not enabled');
      }

    } catch (error) {
      console.error(`Error getting quote for ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Get quotes for multiple tickers efficiently
   */
  async getQuotes(tickers: string[]): Promise<any[]> {
    if (!this.isInitialized) {
      throw new Error('Multi-tenant manager not initialized');
    }

    try {
      if (this.config.enableBatchProcessing) {
        return await this.services.batchDataFetcher.fetchQuotesBatch(tickers);
      } else {
        throw new Error('Batch processing not enabled');
      }

    } catch (error) {
      console.error('Error getting quotes:', error);
      throw error;
    }
  }

  /**
   * Summarize news article efficiently
   */
  async summarizeNews(article: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Multi-tenant manager not initialized');
    }

    try {
      if (this.config.enableServerSummarization) {
        return await this.services.serverSummarizationService.summarizeNews(article);
      } else {
        throw new Error('Server summarization not enabled');
      }

    } catch (error) {
      console.error('Error summarizing news:', error);
      throw error;
    }
  }

  /**
   * Summarize earnings report
   */
  async summarizeEarnings(report: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Multi-tenant manager not initialized');
    }

    try {
      if (this.config.enableServerSummarization) {
        return await this.services.serverSummarizationService.summarizeEarnings(report);
      } else {
        throw new Error('Server summarization not enabled');
      }

    } catch (error) {
      console.error('Error summarizing earnings:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive system summary
   */
  async getSystemSummary(): Promise<SystemSummary> {
    try {
      // Get cost optimization metrics
      const costMetrics = await this.services.costTrackingService.getCostOptimizationMetrics();
      const performanceMetrics = await this.services.costTrackingService.getPerformanceMetrics();
      const systemHealth = this.services.costTrackingService.getSystemHealth();

      // Get today's cost summary
      const dailyCostSummary = await this.services.costTrackingService.getDailyCostSummary();

      // Calculate performance metrics
      const batchMetrics = this.services.batchDataFetcher.getMetrics();
      const alertMetrics = this.services.sharedAlertProcessor.getMetrics();

      const health: ServiceHealth[] = systemHealth ? Object.entries(systemHealth.services).map(([service, status]) => ({
        service,
        status: status.status,
        uptime: status.uptime,
        metrics: status.metrics
      })) : [];

      return {
        totalUsers: costMetrics.totalUsers,
        totalSubscriptions: costMetrics.totalSubscriptions,
        uniqueTickers: costMetrics.uniqueTickers,
        costOptimization: {
          dailyCostCents: dailyCostSummary?.totalCostCents || 0,
          costSavingsPercentage: costMetrics.costSavingsPercentage,
          cacheHitRate: costMetrics.cacheHitRate
        },
        performance: {
          averageResponseTime: performanceMetrics.responseTime.batch,
          throughput: performanceMetrics.throughput.quotesPerSecond,
          errorRate: performanceMetrics.reliability.errorRate
        },
        health
      };

    } catch (error) {
      console.error('Error getting system summary:', error);
      throw error;
    }
  }

  /**
   * Get optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<string[]> {
    if (!this.isInitialized) {
      return ['System not initialized'];
    }

    try {
      return await this.services.costTrackingService.getOptimizationRecommendations();
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return ['Unable to generate recommendations'];
    }
  }

  /**
   * Get detailed metrics for all services
   */
  getDetailedMetrics(): {
    batchFetcher: any;
    webSocket: any;
    alertProcessor: any;
    summarization: any;
  } {
    return {
      batchFetcher: {
        ...this.services.batchDataFetcher.getMetrics(),
        debugInfo: this.services.batchDataFetcher.getDebugInfo(),
        cacheHitRatio: this.services.batchDataFetcher.getCacheHitRatio(),
        costSavings: this.services.batchDataFetcher.getCostSavings()
      },
      webSocket: {
        ...this.services.webSocketMultiplexer.getMetrics(),
        connectionStatus: this.services.webSocketMultiplexer.getConnectionStatus(),
        subscriptions: this.services.webSocketMultiplexer.getSubscriptions().size
      },
      alertProcessor: {
        ...this.services.sharedAlertProcessor.getMetrics(),
        status: this.services.sharedAlertProcessor.getStatus()
      },
      summarization: {
        ...this.services.serverSummarizationService.getMetrics(),
        queueStatus: this.services.serverSummarizationService.getQueueStatus(),
        cacheHitRate: this.services.serverSummarizationService.getCacheHitRate(),
        costSavings: this.services.serverSummarizationService.getCostSavings()
      }
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetAllMetrics(): void {
    this.services.batchDataFetcher.resetMetrics();
    this.services.sharedAlertProcessor.resetMetrics();
    this.services.serverSummarizationService.resetMetrics();
    console.log('📊 All metrics reset');
  }

  /**
   * Check if system is healthy
   */
  isSystemHealthy(): boolean {
    const health = this.services.costTrackingService.getSystemHealth();
    return health ? health.overall === 'healthy' : false;
  }

  /**
   * Get initialization status
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get configuration
   */
  getConfig(): MultiTenantConfig {
    return { ...this.config };
  }
}

// Default singleton instance
export const multiTenantManager = new MultiTenantManager();

// Export for easy access in app
export default multiTenantManager;