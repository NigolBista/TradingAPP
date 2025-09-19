import { supabase } from '../lib/supabase';
import { batchDataFetcher } from './BatchDataFetcher';
import { webSocketMultiplexer } from './WebSocketMultiplexer';
import { sharedAlertProcessor } from './SharedAlertProcessor';
import { serverSummarizationService } from './ServerSummarizationService';

// Types for cost tracking
export interface CostEntry {
  id: string;
  date: string;
  serviceType: string;
  operationType: string;
  requestCount: number;
  costCents: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface DailyCostSummary {
  date: string;
  totalCostCents: number;
  totalRequests: number;
  serviceBreakdown: ServiceCostBreakdown[];
  costSavings: number;
  efficiency: number;
}

export interface ServiceCostBreakdown {
  serviceType: string;
  costCents: number;
  requestCount: number;
  percentage: number;
  operations: OperationCostBreakdown[];
}

export interface OperationCostBreakdown {
  operationType: string;
  costCents: number;
  requestCount: number;
  averageCostPerRequest: number;
}

export interface CostOptimizationMetrics {
  totalUsers: number;
  uniqueTickers: number;
  totalSubscriptions: number;
  deduplicationRatio: number;
  cacheHitRate: number;
  costPerUser: number;
  projectedMonthlyCost: number;
  costSavingsPercentage: number;
}

export interface PerformanceMetrics {
  responseTime: {
    batch: number;
    websocket: number;
    alerts: number;
    summarization: number;
  };
  throughput: {
    quotesPerSecond: number;
    alertsPerMinute: number;
    summariesPerHour: number;
  };
  reliability: {
    uptime: number;
    errorRate: number;
    retryRate: number;
  };
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  services: {
    batchFetcher: ServiceStatus;
    webSocketMultiplexer: ServiceStatus;
    alertProcessor: ServiceStatus;
    summarizationService: ServiceStatus;
    database: ServiceStatus;
  };
  alerts: HealthAlert[];
}

export interface ServiceStatus {
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  uptime: number;
  lastChecked: number;
  metrics?: Record<string, any>;
  issues?: string[];
}

export interface HealthAlert {
  severity: 'info' | 'warning' | 'critical';
  service: string;
  message: string;
  timestamp: number;
  resolved: boolean;
}

/**
 * Cost Tracking and Monitoring Service
 *
 * Key Features:
 * - Real-time cost tracking across all services
 * - Daily/monthly cost summaries and projections
 * - Cost optimization analysis and recommendations
 * - Performance monitoring and health checks
 * - Automated alerting for cost/performance issues
 * - Usage analytics and trends
 * - ROI calculations for optimization strategies
 */
export class CostTrackingService {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private costSummaryInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly COST_SUMMARY_INTERVAL = 300000; // 5 minutes
  private readonly MAX_DAILY_COST_CENTS = 10000; // $100 daily limit
  private readonly MAX_HOURLY_REQUESTS = 100000;

  // Metrics cache
  private lastHealthCheck = 0;
  private healthStatus: SystemHealthStatus | null = null;
  private costOptimizationCache: CostOptimizationMetrics | null = null;
  private performanceMetricsCache: PerformanceMetrics | null = null;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start monitoring services
   */
  private startMonitoring(): void {
    console.log('📊 Starting cost tracking and monitoring service...');

    // Health checks
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    // Cost summaries
    this.costSummaryInterval = setInterval(async () => {
      await this.generateDailyCostSummary();
    }, this.COST_SUMMARY_INTERVAL);

    // Initial checks
    this.performHealthCheck();
    this.generateDailyCostSummary();
  }

  /**
   * Stop monitoring services
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.costSummaryInterval) {
      clearInterval(this.costSummaryInterval);
      this.costSummaryInterval = null;
    }

    console.log('🛑 Cost tracking and monitoring stopped');
  }

  /**
   * Track API cost
   */
  async trackCost(
    serviceType: string,
    operationType: string,
    requestCount: number = 1,
    costCents: number = 0,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await supabase.rpc('track_api_cost', {
        p_service_type: serviceType,
        p_operation_type: operationType,
        p_request_count: requestCount,
        p_cost_cents: costCents
      });

      // Check if we're approaching cost limits
      await this.checkCostLimits();

    } catch (error) {
      console.error('Error tracking cost:', error);
    }
  }

  /**
   * Get daily cost summary
   */
  async getDailyCostSummary(date?: string): Promise<DailyCostSummary | null> {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];

      const { data: costs, error } = await supabase
        .from('cost_tracking')
        .select('*')
        .eq('date', targetDate);

      if (error || !costs) {
        console.error('Error fetching daily costs:', error);
        return null;
      }

      return this.calculateDailySummary(costs, targetDate);

    } catch (error) {
      console.error('Error getting daily cost summary:', error);
      return null;
    }
  }

  /**
   * Get cost optimization metrics
   */
  async getCostOptimizationMetrics(): Promise<CostOptimizationMetrics> {
    try {
      // Check cache first
      if (this.costOptimizationCache && Date.now() - this.lastHealthCheck < 60000) {
        return this.costOptimizationCache;
      }

      // Get subscription data
      const { data: subscriptionData } = await supabase
        .rpc('get_active_tickers');

      const { data: userCount } = await supabase
        .from('user_ticker_subscriptions')
        .select('user_id')
        .distinct();

      const { data: totalSubscriptions } = await supabase
        .from('user_ticker_subscriptions')
        .select('id');

      // Calculate metrics
      const uniqueTickers = subscriptionData?.length || 0;
      const totalUsers = userCount?.length || 0;
      const totalSubs = totalSubscriptions?.length || 0;

      const deduplicationRatio = totalSubs > 0 ? uniqueTickers / totalSubs : 0;
      const cacheHitRate = batchDataFetcher.getCacheHitRatio();

      // Get today's costs
      const todaysSummary = await this.getDailyCostSummary();
      const costPerUser = totalUsers > 0 ? (todaysSummary?.totalCostCents || 0) / totalUsers / 100 : 0;
      const projectedMonthlyCost = (todaysSummary?.totalCostCents || 0) * 30 / 100;

      // Calculate potential cost without optimization
      const potentialDailyCost = totalSubs * 1440 * 1; // 1 cent per request, every minute
      const actualDailyCost = todaysSummary?.totalCostCents || 0;
      const costSavingsPercentage = potentialDailyCost > 0
        ? ((potentialDailyCost - actualDailyCost) / potentialDailyCost) * 100
        : 0;

      const metrics: CostOptimizationMetrics = {
        totalUsers,
        uniqueTickers,
        totalSubscriptions: totalSubs,
        deduplicationRatio,
        cacheHitRate,
        costPerUser,
        projectedMonthlyCost,
        costSavingsPercentage
      };

      this.costOptimizationCache = metrics;
      return metrics;

    } catch (error) {
      console.error('Error calculating cost optimization metrics:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      // Check cache first
      if (this.performanceMetricsCache && Date.now() - this.lastHealthCheck < 30000) {
        return this.performanceMetricsCache;
      }

      // Gather metrics from all services
      const batchMetrics = batchDataFetcher.getMetrics();
      const wsMetrics = webSocketMultiplexer.getMetrics();
      const alertMetrics = sharedAlertProcessor.getMetrics();
      const summaryMetrics = serverSummarizationService.getMetrics();

      const metrics: PerformanceMetrics = {
        responseTime: {
          batch: batchMetrics.averageResponseTime,
          websocket: wsMetrics.averageLatency,
          alerts: alertMetrics.averageLatency,
          summarization: summaryMetrics.averageProcessingTime
        },
        throughput: {
          quotesPerSecond: batchMetrics.totalRequests / 60, // Approximate
          alertsPerMinute: alertMetrics.totalAlertsProcessed / 60,
          summariesPerHour: summaryMetrics.totalRequests * 60
        },
        reliability: {
          uptime: Math.min(wsMetrics.uptime, Date.now()),
          errorRate: (batchMetrics.totalRequests + alertMetrics.totalAlertsProcessed) > 0
            ? (alertMetrics.errorCount / (batchMetrics.totalRequests + alertMetrics.totalAlertsProcessed)) * 100
            : 0,
          retryRate: 0 // Would need to track this separately
        }
      };

      this.performanceMetricsCache = metrics;
      return metrics;

    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      this.lastHealthCheck = Date.now();

      const services = {
        batchFetcher: await this.checkBatchFetcherHealth(),
        webSocketMultiplexer: await this.checkWebSocketHealth(),
        alertProcessor: await this.checkAlertProcessorHealth(),
        summarizationService: await this.checkSummarizationHealth(),
        database: await this.checkDatabaseHealth()
      };

      const alerts: HealthAlert[] = [];

      // Check for issues
      Object.entries(services).forEach(([serviceName, status]) => {
        if (status.status === 'critical') {
          alerts.push({
            severity: 'critical',
            service: serviceName,
            message: `Service is offline or experiencing critical issues`,
            timestamp: Date.now(),
            resolved: false
          });
        } else if (status.status === 'warning') {
          alerts.push({
            severity: 'warning',
            service: serviceName,
            message: `Service is experiencing performance issues`,
            timestamp: Date.now(),
            resolved: false
          });
        }
      });

      // Determine overall health
      const criticalCount = Object.values(services).filter(s => s.status === 'critical').length;
      const warningCount = Object.values(services).filter(s => s.status === 'warning').length;

      let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (criticalCount > 0) {
        overall = 'critical';
      } else if (warningCount > 1) {
        overall = 'warning';
      }

      this.healthStatus = {
        overall,
        services,
        alerts
      };

      // Log health status
      if (overall !== 'healthy') {
        console.warn(`⚠️ System health: ${overall}`, { alerts: alerts.length });
      }

    } catch (error) {
      console.error('Error performing health check:', error);
    }
  }

  /**
   * Check individual service health
   */
  private async checkBatchFetcherHealth(): Promise<ServiceStatus> {
    try {
      const metrics = batchDataFetcher.getMetrics();
      const debugInfo = batchDataFetcher.getDebugInfo();

      const issues: string[] = [];

      // Check cache hit rate
      if (metrics.totalRequests > 100 && batchDataFetcher.getCacheHitRatio() < 0.5) {
        issues.push('Low cache hit rate');
      }

      // Check response time
      if (metrics.averageResponseTime > 5000) {
        issues.push('High response time');
      }

      // Check memory cache size
      if (debugInfo.memoryCacheSize > 1000) {
        issues.push('Large memory cache');
      }

      const status = issues.length > 2 ? 'critical' : issues.length > 0 ? 'warning' : 'healthy';

      return {
        status,
        uptime: Date.now(),
        lastChecked: Date.now(),
        metrics: {
          cacheHitRate: batchDataFetcher.getCacheHitRatio(),
          responseTime: metrics.averageResponseTime,
          totalRequests: metrics.totalRequests
        },
        issues: issues.length > 0 ? issues : undefined
      };

    } catch (error) {
      return {
        status: 'critical',
        uptime: 0,
        lastChecked: Date.now(),
        issues: ['Service check failed']
      };
    }
  }

  private async checkWebSocketHealth(): Promise<ServiceStatus> {
    try {
      const status = webSocketMultiplexer.getConnectionStatus();
      const metrics = webSocketMultiplexer.getMetrics();

      const issues: string[] = [];

      if (!status.connected) {
        issues.push('WebSocket disconnected');
      }

      if (status.reconnectAttempts > 3) {
        issues.push('Multiple reconnection attempts');
      }

      if (metrics.messagesReceived === 0 && status.connected) {
        issues.push('No messages received');
      }

      const serviceStatus = !status.connected ? 'critical' : issues.length > 1 ? 'warning' : 'healthy';

      return {
        status: serviceStatus,
        uptime: metrics.uptime,
        lastChecked: Date.now(),
        metrics: {
          connected: status.connected,
          subscriptions: status.subscriptions,
          messagesReceived: metrics.messagesReceived
        },
        issues: issues.length > 0 ? issues : undefined
      };

    } catch (error) {
      return {
        status: 'critical',
        uptime: 0,
        lastChecked: Date.now(),
        issues: ['Service check failed']
      };
    }
  }

  private async checkAlertProcessorHealth(): Promise<ServiceStatus> {
    try {
      const status = sharedAlertProcessor.getStatus();
      const metrics = sharedAlertProcessor.getMetrics();

      const issues: string[] = [];

      if (!status.isRunning) {
        issues.push('Alert processor not running');
      }

      if (metrics.errorCount > 10) {
        issues.push('High error count');
      }

      if (metrics.averageLatency > 30000) {
        issues.push('High processing latency');
      }

      const serviceStatus = !status.isRunning ? 'critical' : issues.length > 1 ? 'warning' : 'healthy';

      return {
        status: serviceStatus,
        uptime: Date.now() - (status.lastProcessingTime || 0),
        lastChecked: Date.now(),
        metrics: {
          isRunning: status.isRunning,
          alertsProcessed: metrics.totalAlertsProcessed,
          errorCount: metrics.errorCount
        },
        issues: issues.length > 0 ? issues : undefined
      };

    } catch (error) {
      return {
        status: 'critical',
        uptime: 0,
        lastChecked: Date.now(),
        issues: ['Service check failed']
      };
    }
  }

  private async checkSummarizationHealth(): Promise<ServiceStatus> {
    try {
      const queueStatus = serverSummarizationService.getQueueStatus();
      const metrics = serverSummarizationService.getMetrics();

      const issues: string[] = [];

      if (queueStatus.queueSize > 100) {
        issues.push('Large processing queue');
      }

      if (metrics.errorCount > metrics.totalRequests * 0.1) {
        issues.push('High error rate');
      }

      if (serverSummarizationService.getCacheHitRate() < 0.3) {
        issues.push('Low cache hit rate');
      }

      const serviceStatus = issues.length > 2 ? 'critical' : issues.length > 0 ? 'warning' : 'healthy';

      return {
        status: serviceStatus,
        uptime: Date.now(),
        lastChecked: Date.now(),
        metrics: {
          queueSize: queueStatus.queueSize,
          cacheHitRate: serverSummarizationService.getCacheHitRate(),
          totalRequests: metrics.totalRequests
        },
        issues: issues.length > 0 ? issues : undefined
      };

    } catch (error) {
      return {
        status: 'critical',
        uptime: 0,
        lastChecked: Date.now(),
        issues: ['Service check failed']
      };
    }
  }

  private async checkDatabaseHealth(): Promise<ServiceStatus> {
    try {
      const startTime = Date.now();

      // Test database connectivity
      const { data, error } = await supabase
        .from('ticker_subscriptions')
        .select('count')
        .limit(1);

      const responseTime = Date.now() - startTime;

      const issues: string[] = [];

      if (error) {
        issues.push('Database query failed');
      }

      if (responseTime > 5000) {
        issues.push('Slow database response');
      }

      const status = error ? 'critical' : responseTime > 2000 ? 'warning' : 'healthy';

      return {
        status,
        uptime: Date.now(),
        lastChecked: Date.now(),
        metrics: {
          responseTime,
          connected: !error
        },
        issues: issues.length > 0 ? issues : undefined
      };

    } catch (error) {
      return {
        status: 'critical',
        uptime: 0,
        lastChecked: Date.now(),
        issues: ['Database connection failed']
      };
    }
  }

  /**
   * Generate daily cost summary
   */
  private async generateDailyCostSummary(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const summary = await this.getDailyCostSummary(today);

      if (summary) {
        console.log('💰 Daily Cost Summary:', {
          date: summary.date,
          totalCost: '$' + (summary.totalCostCents / 100).toFixed(4),
          requests: summary.totalRequests,
          efficiency: summary.efficiency.toFixed(2) + '%',
          savings: '$' + (summary.costSavings / 100).toFixed(4)
        });
      }

    } catch (error) {
      console.error('Error generating daily cost summary:', error);
    }
  }

  /**
   * Calculate daily summary from cost entries
   */
  private calculateDailySummary(costs: CostEntry[], date: string): DailyCostSummary {
    const totalCostCents = costs.reduce((sum, cost) => sum + cost.costCents, 0);
    const totalRequests = costs.reduce((sum, cost) => sum + cost.requestCount, 0);

    // Group by service type
    const serviceGroups: Record<string, CostEntry[]> = {};
    costs.forEach(cost => {
      if (!serviceGroups[cost.serviceType]) {
        serviceGroups[cost.serviceType] = [];
      }
      serviceGroups[cost.serviceType].push(cost);
    });

    // Calculate service breakdown
    const serviceBreakdown: ServiceCostBreakdown[] = Object.entries(serviceGroups).map(([serviceType, serviceCosts]) => {
      const serviceCostCents = serviceCosts.reduce((sum, cost) => sum + cost.costCents, 0);
      const serviceRequests = serviceCosts.reduce((sum, cost) => sum + cost.requestCount, 0);
      const percentage = totalCostCents > 0 ? (serviceCostCents / totalCostCents) * 100 : 0;

      // Group by operation type
      const operationGroups: Record<string, CostEntry[]> = {};
      serviceCosts.forEach(cost => {
        if (!operationGroups[cost.operationType]) {
          operationGroups[cost.operationType] = [];
        }
        operationGroups[cost.operationType].push(cost);
      });

      const operations: OperationCostBreakdown[] = Object.entries(operationGroups).map(([operationType, operationCosts]) => {
        const operationCostCents = operationCosts.reduce((sum, cost) => sum + cost.costCents, 0);
        const operationRequests = operationCosts.reduce((sum, cost) => sum + cost.requestCount, 0);

        return {
          operationType,
          costCents: operationCostCents,
          requestCount: operationRequests,
          averageCostPerRequest: operationRequests > 0 ? operationCostCents / operationRequests : 0
        };
      });

      return {
        serviceType,
        costCents: serviceCostCents,
        requestCount: serviceRequests,
        percentage,
        operations
      };
    });

    // Calculate cost savings (negative costs represent savings)
    const costSavings = Math.abs(costs.filter(c => c.costCents < 0).reduce((sum, cost) => sum + cost.costCents, 0));

    // Calculate efficiency (cost savings / potential cost)
    const potentialCost = totalCostCents + costSavings;
    const efficiency = potentialCost > 0 ? (costSavings / potentialCost) * 100 : 0;

    return {
      date,
      totalCostCents,
      totalRequests,
      serviceBreakdown,
      costSavings,
      efficiency
    };
  }

  /**
   * Check cost limits and alert if necessary
   */
  private async checkCostLimits(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const summary = await this.getDailyCostSummary(today);

      if (summary && summary.totalCostCents > this.MAX_DAILY_COST_CENTS) {
        console.warn('🚨 Daily cost limit exceeded!', {
          actual: '$' + (summary.totalCostCents / 100).toFixed(2),
          limit: '$' + (this.MAX_DAILY_COST_CENTS / 100).toFixed(2)
        });

        // Could trigger alerts here
      }

    } catch (error) {
      console.error('Error checking cost limits:', error);
    }
  }

  /**
   * Public API methods
   */
  getSystemHealth(): SystemHealthStatus | null {
    return this.healthStatus;
  }

  async getCostProjection(days: number = 30): Promise<{
    projectedCost: number;
    basedOnDays: number;
    confidence: number;
  }> {
    try {
      // Get last 7 days of cost data
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data: costs } = await supabase
        .from('cost_tracking')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (!costs || costs.length === 0) {
        return { projectedCost: 0, basedOnDays: 0, confidence: 0 };
      }

      // Calculate average daily cost
      const dailyCosts = costs.reduce((acc, cost) => {
        if (!acc[cost.date]) acc[cost.date] = 0;
        acc[cost.date] += cost.costCents;
        return acc;
      }, {} as Record<string, number>);

      const avgDailyCost = Object.values(dailyCosts).reduce((sum, cost) => sum + cost, 0) / Object.keys(dailyCosts).length;
      const projectedCost = (avgDailyCost * days) / 100; // Convert to dollars

      // Calculate confidence based on data consistency
      const variance = Object.values(dailyCosts).reduce((sum, cost) => sum + Math.pow(cost - avgDailyCost, 2), 0) / Object.keys(dailyCosts).length;
      const confidence = Math.max(0, Math.min(1, 1 - (variance / (avgDailyCost * avgDailyCost))));

      return {
        projectedCost,
        basedOnDays: Object.keys(dailyCosts).length,
        confidence
      };

    } catch (error) {
      console.error('Error calculating cost projection:', error);
      return { projectedCost: 0, basedOnDays: 0, confidence: 0 };
    }
  }

  async getOptimizationRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      const metrics = await this.getCostOptimizationMetrics();
      const performance = await this.getPerformanceMetrics();

      // Cache hit rate recommendations
      if (metrics.cacheHitRate < 0.7) {
        recommendations.push('Increase cache TTL to improve hit rate');
      }

      // Deduplication recommendations
      if (metrics.deduplicationRatio < 0.1) {
        recommendations.push('Users have highly overlapping ticker interests - optimization is working well');
      }

      // Performance recommendations
      if (performance.responseTime.batch > 2000) {
        recommendations.push('Consider reducing batch processing delay');
      }

      if (performance.reliability.errorRate > 5) {
        recommendations.push('Investigate high error rate in services');
      }

      // Cost recommendations
      if (metrics.costPerUser > 1) {
        recommendations.push('Cost per user is high - review pricing strategies');
      }

      if (recommendations.length === 0) {
        recommendations.push('System is well optimized - no immediate recommendations');
      }

      return recommendations;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      return ['Unable to generate recommendations due to system error'];
    }
  }
}

// Singleton instance for global use
export const costTrackingService = new CostTrackingService();