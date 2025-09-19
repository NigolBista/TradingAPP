import { supabase } from '../lib/supabase';
import { batchDataFetcher, Quote } from './BatchDataFetcher';

// Types for alert processing
export interface Alert {
  id: string;
  user_id: string;
  symbol: string;
  price: number;
  condition: 'above' | 'below' | 'crosses_above' | 'crosses_below';
  message?: string;
  is_active: boolean;
  last_price?: number;
  triggered_at?: string;
  repeat: 'unlimited' | 'once_per_min' | 'once_per_day';
  last_notified_at?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'price' | 'volume' | 'news' | 'technical' | 'discord' | 'earnings';
  status: 'active' | 'triggered' | 'paused' | 'expired' | 'failed';
  cooldown_period: number;
  expires_at?: string;
  metadata: Record<string, any>;
}

export interface AlertGroup {
  ticker: string;
  alerts: Alert[];
  currentPrice?: number;
}

export interface TriggeredAlert extends Alert {
  current_price: number;
  triggered_timestamp: number;
  notification_payload: NotificationPayload;
}

export interface NotificationPayload {
  title: string;
  body: string;
  ticker: string;
  current_price: number;
  target_price: number;
  condition: string;
  priority: string;
  category: string;
  metadata?: Record<string, any>;
}

export interface AlertProcessingMetrics {
  totalAlertsProcessed: number;
  alertsTriggered: number;
  notificationsCreated: number;
  processingTime: number;
  costSavings: number;
  errorCount: number;
  averageLatency: number;
}

export interface PriorityGroup {
  critical: TriggeredAlert[];
  high: TriggeredAlert[];
  medium: TriggeredAlert[];
  low: TriggeredAlert[];
}

/**
 * Shared Alert Processor for cost-effective alert evaluation
 *
 * Key Features:
 * - Process alerts for all users in single pass
 * - Group alerts by ticker to minimize API calls
 * - Priority-based processing and notification
 * - Intelligent throttling and cooldown management
 * - Batch notification creation
 * - Cost tracking and optimization
 * - Error handling and retry logic
 */
export class SharedAlertProcessor {
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  // Configuration
  private readonly PROCESSING_INTERVAL = 15000; // 15 seconds
  private readonly MAX_BATCH_SIZE = 100;
  private readonly MAX_NOTIFICATIONS_PER_BATCH = 50;

  // Metrics tracking
  private metrics: AlertProcessingMetrics = {
    totalAlertsProcessed: 0,
    alertsTriggered: 0,
    notificationsCreated: 0,
    processingTime: 0,
    costSavings: 0,
    errorCount: 0,
    averageLatency: 0
  };

  // Processing state
  private lastProcessingTime = 0;
  private processingTimes: number[] = [];

  /**
   * Start the alert processing service
   */
  start(): void {
    if (this.processingInterval) {
      console.log('⚠️ Alert processor already running');
      return;
    }

    console.log('🚀 Starting shared alert processor...');

    this.processingInterval = setInterval(async () => {
      await this.evaluateAllAlerts();
    }, this.PROCESSING_INTERVAL);

    // Initial processing
    this.evaluateAllAlerts();
  }

  /**
   * Stop the alert processing service
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('🛑 Shared alert processor stopped');
    }
  }

  /**
   * Main alert evaluation function
   */
  async evaluateAllAlerts(): Promise<void> {
    if (this.isProcessing) {
      console.log('⏳ Alert processing already in progress, skipping...');
      return;
    }

    const startTime = Date.now();
    this.isProcessing = true;

    try {
      console.log('📊 Starting alert evaluation cycle...');

      // Get all active alerts grouped by ticker
      const alertGroups = await this.getActiveAlertsGroupedByTicker();

      if (Object.keys(alertGroups).length === 0) {
        console.log('ℹ️ No active alerts to process');
        return;
      }

      console.log(`📈 Processing alerts for ${Object.keys(alertGroups).length} tickers...`);

      // Fetch current prices for all tickers in one batch
      const tickers = Object.keys(alertGroups);
      const prices = await this.fetchCurrentPrices(tickers);

      // Track cost savings
      const apiCallsSaved = tickers.length > 1 ? (this.getTotalAlertCount(alertGroups) - tickers.length) : 0;
      this.metrics.costSavings += apiCallsSaved * 1; // 1 cent per API call saved

      const triggeredAlerts: TriggeredAlert[] = [];

      // Evaluate all alerts in memory
      for (const [ticker, alertGroup] of Object.entries(alertGroups)) {
        const currentPrice = prices.find(p => p.ticker === ticker)?.price;

        if (!currentPrice) {
          console.warn(`⚠️ No price data available for ${ticker}`);
          continue;
        }

        alertGroup.currentPrice = currentPrice;

        // Check each alert for this ticker
        for (const alert of alertGroup.alerts) {
          try {
            if (await this.shouldTriggerAlert(alert, currentPrice)) {
              const triggeredAlert = await this.createTriggeredAlert(alert, currentPrice);
              triggeredAlerts.push(triggeredAlert);
            }

            // Update last_price for cross alerts
            await this.updateAlertLastPrice(alert.id, currentPrice);

          } catch (error) {
            console.error(`Error evaluating alert ${alert.id}:`, error);
            this.metrics.errorCount++;
          }
        }

        this.metrics.totalAlertsProcessed += alertGroup.alerts.length;
      }

      // Process all triggered alerts
      if (triggeredAlerts.length > 0) {
        console.log(`🔔 Processing ${triggeredAlerts.length} triggered alerts...`);
        await this.processTriggeredAlerts(triggeredAlerts);
        this.metrics.alertsTriggered += triggeredAlerts.length;
      }

      // Update processing metrics
      const processingTime = Date.now() - startTime;
      this.updateProcessingMetrics(processingTime);

      console.log(`✅ Alert evaluation completed in ${processingTime}ms. Triggered: ${triggeredAlerts.length}`);

    } catch (error) {
      console.error('❌ Error during alert evaluation:', error);
      this.metrics.errorCount++;

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get all active alerts grouped by ticker
   */
  private async getActiveAlertsGroupedByTicker(): Promise<Record<string, AlertGroup>> {
    try {
      const { data: alerts, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('status', 'active')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

      if (error) {
        console.error('Error fetching alerts:', error);
        throw error;
      }

      const grouped: Record<string, AlertGroup> = {};

      for (const alert of alerts || []) {
        // Skip alerts in cooldown
        if (await this.isAlertInCooldown(alert)) {
          continue;
        }

        if (!grouped[alert.symbol]) {
          grouped[alert.symbol] = {
            ticker: alert.symbol,
            alerts: []
          };
        }

        grouped[alert.symbol].alerts.push(alert);
      }

      return grouped;

    } catch (error) {
      console.error('Error grouping alerts by ticker:', error);
      throw error;
    }
  }

  /**
   * Fetch current prices for all tickers
   */
  private async fetchCurrentPrices(tickers: string[]): Promise<Quote[]> {
    try {
      console.log(`📡 Fetching prices for ${tickers.length} tickers...`);

      // Use batch fetcher for cost optimization
      const quotes = await batchDataFetcher.fetchQuotesBatch(tickers);

      console.log(`✅ Retrieved ${quotes.length}/${tickers.length} quotes`);

      return quotes;

    } catch (error) {
      console.error('Error fetching current prices:', error);
      throw error;
    }
  }

  /**
   * Check if alert should be triggered
   */
  private async shouldTriggerAlert(alert: Alert, currentPrice: number): Promise<boolean> {
    const { condition, price, last_price } = alert;

    switch (condition) {
      case 'above':
        return currentPrice > price;

      case 'below':
        return currentPrice < price;

      case 'crosses_above':
        return last_price !== null &&
               last_price !== undefined &&
               last_price <= price &&
               currentPrice > price;

      case 'crosses_below':
        return last_price !== null &&
               last_price !== undefined &&
               last_price >= price &&
               currentPrice < price;

      default:
        console.warn(`Unknown alert condition: ${condition}`);
        return false;
    }
  }

  /**
   * Check if alert is in cooldown period
   */
  private async isAlertInCooldown(alert: Alert): Promise<boolean> {
    if (!alert.last_notified_at || alert.cooldown_period === 0) {
      return false;
    }

    const lastNotified = new Date(alert.last_notified_at).getTime();
    const cooldownEnd = lastNotified + (alert.cooldown_period * 60 * 1000); // Convert minutes to ms
    const now = Date.now();

    return now < cooldownEnd;
  }

  /**
   * Create triggered alert object
   */
  private async createTriggeredAlert(alert: Alert, currentPrice: number): Promise<TriggeredAlert> {
    const notificationPayload: NotificationPayload = {
      title: this.createAlertTitle(alert, currentPrice),
      body: this.createAlertBody(alert, currentPrice),
      ticker: alert.symbol,
      current_price: currentPrice,
      target_price: alert.price,
      condition: alert.condition,
      priority: alert.priority,
      category: alert.category,
      metadata: {
        alertId: alert.id,
        triggeredAt: Date.now(),
        ...alert.metadata
      }
    };

    return {
      ...alert,
      current_price: currentPrice,
      triggered_timestamp: Date.now(),
      notification_payload: notificationPayload
    };
  }

  /**
   * Create alert notification title
   */
  private createAlertTitle(alert: Alert, currentPrice: number): string {
    const emoji = this.getPriorityEmoji(alert.priority);
    const direction = this.getDirectionText(alert.condition);

    return `${emoji} ${alert.symbol} ${direction} $${currentPrice.toFixed(2)}`;
  }

  /**
   * Create alert notification body
   */
  private createAlertBody(alert: Alert, currentPrice: number): string {
    const conditionText = this.getConditionText(alert.condition);
    const changePercent = ((currentPrice - alert.price) / alert.price * 100).toFixed(2);
    const direction = currentPrice > alert.price ? '↗️' : '↘️';

    let body = `${alert.symbol} ${conditionText} $${alert.price.toFixed(2)} (${direction} ${changePercent}%)`;

    if (alert.message) {
      body += `\n${alert.message}`;
    }

    return body;
  }

  /**
   * Process all triggered alerts
   */
  private async processTriggeredAlerts(triggeredAlerts: TriggeredAlert[]): Promise<void> {
    try {
      // Group by priority for efficient processing
      const priorityGroups = this.groupAlertsByPriority(triggeredAlerts);

      // Process each priority level
      for (const priority of ['critical', 'high', 'medium', 'low']) {
        const alertsForPriority = priorityGroups[priority as keyof PriorityGroup] || [];

        if (alertsForPriority.length === 0) continue;

        console.log(`📮 Processing ${alertsForPriority.length} ${priority} priority alerts...`);

        // Create notifications in batches
        await this.createBatchNotifications(alertsForPriority);

        // Update alert statuses
        await this.updateAlertStatuses(alertsForPriority);

        // Add to alert history
        await this.addToAlertHistory(alertsForPriority);
      }

    } catch (error) {
      console.error('Error processing triggered alerts:', error);
      throw error;
    }
  }

  /**
   * Group alerts by priority
   */
  private groupAlertsByPriority(alerts: TriggeredAlert[]): PriorityGroup {
    const groups: PriorityGroup = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    alerts.forEach(alert => {
      groups[alert.priority].push(alert);
    });

    return groups;
  }

  /**
   * Create notifications in batch
   */
  private async createBatchNotifications(alerts: TriggeredAlert[]): Promise<void> {
    try {
      // Process in smaller batches to avoid overwhelming the system
      const batches = this.chunkArray(alerts, this.MAX_NOTIFICATIONS_PER_BATCH);

      for (const batch of batches) {
        const notifications = batch.map(alert => ({
          alert_id: alert.id,
          user_id: alert.user_id,
          priority: alert.priority,
          category: alert.category,
          payload: alert.notification_payload,
          scheduled_at: new Date().toISOString(),
          status: 'pending'
        }));

        const { error } = await supabase
          .from('notifications_queue')
          .insert(notifications);

        if (error) {
          console.error('Error creating batch notifications:', error);
          throw error;
        }

        this.metrics.notificationsCreated += notifications.length;
      }

    } catch (error) {
      console.error('Error in batch notification creation:', error);
      throw error;
    }
  }

  /**
   * Update alert statuses after triggering
   */
  private async updateAlertStatuses(alerts: TriggeredAlert[]): Promise<void> {
    try {
      const updates = alerts.map(alert => {
        const newStatus = this.getNewAlertStatus(alert);

        return {
          id: alert.id,
          status: newStatus,
          triggered_at: new Date().toISOString(),
          last_notified_at: new Date().toISOString(),
          metadata: {
            ...alert.metadata,
            lastTriggeredPrice: alert.current_price,
            triggeredAt: alert.triggered_timestamp
          }
        };
      });

      // Batch update alerts
      for (const update of updates) {
        const { error } = await supabase
          .from('alerts')
          .update({
            status: update.status,
            triggered_at: update.triggered_at,
            last_notified_at: update.last_notified_at,
            metadata: update.metadata
          })
          .eq('id', update.id);

        if (error) {
          console.error(`Error updating alert ${update.id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error updating alert statuses:', error);
      throw error;
    }
  }

  /**
   * Add triggered alerts to history
   */
  private async addToAlertHistory(alerts: TriggeredAlert[]): Promise<void> {
    try {
      const historyEntries = alerts.map(alert => ({
        alert_id: alert.id,
        user_id: alert.user_id,
        ticker: alert.symbol,
        triggered_price: alert.current_price,
        target_price: alert.price,
        condition: alert.condition,
        notification_sent: true,
        response_time_ms: Date.now() - alert.triggered_timestamp,
        metadata: {
          priority: alert.priority,
          category: alert.category,
          notificationPayload: alert.notification_payload
        }
      }));

      const { error } = await supabase
        .from('alert_history')
        .insert(historyEntries);

      if (error) {
        console.error('Error adding to alert history:', error);
        throw error;
      }

    } catch (error) {
      console.error('Error in alert history creation:', error);
      throw error;
    }
  }

  /**
   * Update alert's last price for cross conditions
   */
  private async updateAlertLastPrice(alertId: string, currentPrice: number): Promise<void> {
    try {
      await supabase
        .from('alerts')
        .update({ last_price: currentPrice })
        .eq('id', alertId);

    } catch (error) {
      console.error(`Error updating last price for alert ${alertId}:`, error);
    }
  }

  /**
   * Get new alert status after triggering
   */
  private getNewAlertStatus(alert: TriggeredAlert): string {
    switch (alert.repeat) {
      case 'once_per_day':
      case 'once_per_min':
        return 'triggered'; // Will be reactivated after cooldown

      case 'unlimited':
      default:
        return 'active'; // Continues to be active
    }
  }

  /**
   * Utility functions
   */
  private getTotalAlertCount(alertGroups: Record<string, AlertGroup>): number {
    return Object.values(alertGroups).reduce((total, group) => total + group.alerts.length, 0);
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '📈';
      case 'low': return 'ℹ️';
      default: return '📊';
    }
  }

  private getDirectionText(condition: string): string {
    switch (condition) {
      case 'above':
      case 'crosses_above':
        return 'Above';
      case 'below':
      case 'crosses_below':
        return 'Below';
      default:
        return 'Alert';
    }
  }

  private getConditionText(condition: string): string {
    switch (condition) {
      case 'above': return 'is above';
      case 'below': return 'is below';
      case 'crosses_above': return 'crossed above';
      case 'crosses_below': return 'crossed below';
      default: return 'triggered at';
    }
  }

  /**
   * Update processing metrics
   */
  private updateProcessingMetrics(processingTime: number): void {
    this.metrics.processingTime = processingTime;
    this.processingTimes.push(processingTime);

    // Keep only last 100 processing times
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100);
    }

    // Calculate average latency
    this.metrics.averageLatency = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;

    this.lastProcessingTime = Date.now();
  }

  /**
   * Get current metrics
   */
  getMetrics(): AlertProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalAlertsProcessed: 0,
      alertsTriggered: 0,
      notificationsCreated: 0,
      processingTime: 0,
      costSavings: 0,
      errorCount: 0,
      averageLatency: 0
    };
    this.processingTimes = [];
  }

  /**
   * Get processing status
   */
  getStatus(): {
    isRunning: boolean;
    isProcessing: boolean;
    lastProcessingTime: number;
    nextProcessingIn: number;
  } {
    const nextProcessingIn = this.lastProcessingTime > 0
      ? Math.max(0, this.PROCESSING_INTERVAL - (Date.now() - this.lastProcessingTime))
      : 0;

    return {
      isRunning: this.processingInterval !== null,
      isProcessing: this.isProcessing,
      lastProcessingTime: this.lastProcessingTime,
      nextProcessingIn
    };
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualEvaluation(): Promise<void> {
    await this.evaluateAllAlerts();
  }
}

// Singleton instance for global use
export const sharedAlertProcessor = new SharedAlertProcessor();