# Multi-Tenant Cost Optimization Plan

## 🎯 Overview
This document outlines a comprehensive cost optimization strategy for handling multiple users with overlapping ticker subscriptions. The solution reduces API costs by up to 98.7% through intelligent data sharing, caching, and batch processing.

## 📊 Problem Analysis

### Current Challenge
- **1,000 active users** with average **8 stocks each** = **8,000 total subscriptions**
- **High overlap**: ~100 unique tickers (popular stocks like AAPL, TSLA, NVDA)
- **Cost multiplier**: 80x redundant API calls without optimization
- **Scalability bottleneck**: Linear cost growth per user

### Scenario Example
```
User A: [AAPL, TSLA, MSFT, GOOGL, AMZN, NVDA, META, NFLX]
User B: [AAPL, TSLA, UBER, COIN, PLTR]
User C: [AAPL, MSFT, GOOGL, AMD, INTC, CRM, ORCL, ADBE]

Overlap: AAPL (3 users), TSLA (2 users), MSFT (2 users), GOOGL (2 users)
Unique tickers: 13 instead of 21 individual subscriptions
```

## 💰 Cost Analysis

### Without Optimization
```
1,000 users × 8 tickers × $0.01/request × 1440 requests/day = $115,200/month
WebSocket connections: 1,000 × $0.50/month = $500/month
LLM API calls: 8,000 summaries × $0.002 × 30 days = $480/month
Total: $116,180/month
```

### With Optimization
```
100 unique tickers × $0.01/request × 1440 requests/day = $1,440/month
WebSocket connections: 1 multiplexed × $50/month = $50/month
LLM processing: Server-side batch × $0.0005 × 1000 summaries = $15/month
Total: $1,505/month (98.7% cost reduction!)
```

---

## 🏗️ Architecture Solution

### 1. Shared Data Layer with Deduplication

```typescript
// Ticker Subscription Manager
class TickerSubscriptionManager {
  private tickerRefCount: Map<string, number> = new Map();
  private activeSubscriptions: Map<string, WebSocket> = new Map();
  private dataCache: Map<string, CachedData> = new Map();

  // Only subscribe once per ticker, regardless of user count
  async subscribe(userId: string, tickers: string[]) {
    for (const ticker of tickers) {
      const refCount = this.tickerRefCount.get(ticker) || 0;

      if (refCount === 0) {
        // First subscriber - create real subscription
        await this.createMarketDataSubscription(ticker);
      }

      this.tickerRefCount.set(ticker, refCount + 1);
      this.addUserMapping(userId, ticker);
    }
  }

  async unsubscribe(userId: string, tickers: string[]) {
    for (const ticker of tickers) {
      const refCount = this.tickerRefCount.get(ticker) || 0;

      if (refCount <= 1) {
        // Last subscriber - close real subscription
        await this.closeMarketDataSubscription(ticker);
        this.tickerRefCount.delete(ticker);
      } else {
        this.tickerRefCount.set(ticker, refCount - 1);
      }

      this.removeUserMapping(userId, ticker);
    }
  }

  // Broadcast updates to all users watching this ticker
  private broadcastUpdate(ticker: string, data: MarketData) {
    const users = this.getUsersForTicker(ticker);
    users.forEach(userId => {
      this.sendToUser(userId, ticker, data);
    });
  }
}
```

### 2. Database Schema

```sql
-- Ticker subscriptions with reference counting
CREATE TABLE ticker_subscriptions (
  ticker TEXT PRIMARY KEY,
  subscriber_count INTEGER DEFAULT 0,
  last_fetched TIMESTAMPTZ,
  cached_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-ticker mappings
CREATE TABLE user_ticker_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ticker),
  FOREIGN KEY (ticker) REFERENCES ticker_subscriptions(ticker) ON DELETE CASCADE
);

-- Market data cache
CREATE TABLE market_data_cache (
  ticker TEXT PRIMARY KEY,
  quote_data JSONB,
  price DECIMAL(10,4),
  change_percent DECIMAL(6,4),
  volume BIGINT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  ttl_expires_at TIMESTAMPTZ
);

-- News summaries cache (server-side LLM)
CREATE TABLE news_summaries_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id TEXT UNIQUE NOT NULL,
  original_content TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_points TEXT[],
  sentiment_score DECIMAL(3,2), -- -1 to 1
  related_tickers TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Earnings summaries cache
CREATE TABLE earnings_summaries_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  quarter TEXT NOT NULL,
  year INTEGER NOT NULL,
  original_transcript TEXT,
  executive_summary TEXT NOT NULL,
  key_metrics JSONB,
  forward_guidance TEXT,
  sentiment_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, quarter, year)
);
```

### 3. Supabase Functions for Subscription Management

```sql
-- Function to subscribe user to ticker
CREATE OR REPLACE FUNCTION subscribe_user_to_ticker(
  p_user_id UUID,
  p_ticker TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
BEGIN
  -- Insert or update ticker subscription count
  INSERT INTO ticker_subscriptions (ticker, subscriber_count)
  VALUES (p_ticker, 1)
  ON CONFLICT (ticker)
  DO UPDATE SET
    subscriber_count = ticker_subscriptions.subscriber_count + 1,
    updated_at = NOW();

  -- Add user-ticker mapping
  INSERT INTO user_ticker_subscriptions (user_id, ticker)
  VALUES (p_user_id, p_ticker)
  ON CONFLICT (user_id, ticker)
  DO UPDATE SET last_accessed = NOW();

  -- Get current subscriber count
  SELECT subscriber_count INTO current_count
  FROM ticker_subscriptions
  WHERE ticker = p_ticker;

  -- Return true if this was the first subscriber (needs API subscription)
  RETURN current_count = 1;
END;
$$ LANGUAGE plpgsql;

-- Function to unsubscribe user from ticker
CREATE OR REPLACE FUNCTION unsubscribe_user_from_ticker(
  p_user_id UUID,
  p_ticker TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  remaining_count INTEGER;
BEGIN
  -- Remove user-ticker mapping
  DELETE FROM user_ticker_subscriptions
  WHERE user_id = p_user_id AND ticker = p_ticker;

  -- Decrease subscriber count
  UPDATE ticker_subscriptions
  SET
    subscriber_count = subscriber_count - 1,
    updated_at = NOW()
  WHERE ticker = p_ticker;

  -- Get remaining subscriber count
  SELECT subscriber_count INTO remaining_count
  FROM ticker_subscriptions
  WHERE ticker = p_ticker;

  -- Clean up if no subscribers left
  IF remaining_count <= 0 THEN
    DELETE FROM ticker_subscriptions WHERE ticker = p_ticker;
    DELETE FROM market_data_cache WHERE ticker = p_ticker;
    RETURN TRUE; -- Indicates API subscription should be closed
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get all active tickers
CREATE OR REPLACE FUNCTION get_active_tickers()
RETURNS TABLE(ticker TEXT, subscriber_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT ts.ticker, ts.subscriber_count
  FROM ticker_subscriptions ts
  WHERE ts.subscriber_count > 0
  ORDER BY ts.subscriber_count DESC;
END;
$$ LANGUAGE plpgsql;
```

---

## 🚀 Implementation Components

### 4. Batch Processing Service

```typescript
// Batch Data Fetcher for cost optimization
export class BatchDataFetcher {
  private pendingRequests: Map<string, Promise<Quote>> = new Map();
  private batchQueue: Set<string> = new Set();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 100; // 100ms batching window
  private readonly MAX_BATCH_SIZE = 50; // API limit

  async fetchQuote(ticker: string): Promise<Quote> {
    // Check cache first
    const cached = await this.getCachedQuote(ticker);
    if (cached && this.isValidCache(cached)) {
      return cached;
    }

    // Check if request already pending
    if (this.pendingRequests.has(ticker)) {
      return this.pendingRequests.get(ticker)!;
    }

    // Add to batch queue
    this.batchQueue.add(ticker);

    // Start batch timer if not running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_DELAY);
    }

    // Force process if batch is full
    if (this.batchQueue.size >= this.MAX_BATCH_SIZE) {
      this.processBatch();
    }

    // Create promise for this ticker
    const promise = new Promise<Quote>((resolve, reject) => {
      this.promiseResolvers.set(ticker, { resolve, reject });
    });

    this.pendingRequests.set(ticker, promise);
    return promise;
  }

  private async processBatch() {
    if (this.batchQueue.size === 0) return;

    const tickers = Array.from(this.batchQueue);
    this.batchQueue.clear();

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      // Single API call for all tickers
      const quotes = await this.api.getQuotesBatch(tickers);

      // Cache all quotes
      await this.cacheQuotes(quotes);

      // Resolve all pending promises
      quotes.forEach(quote => {
        const resolver = this.promiseResolvers.get(quote.ticker);
        if (resolver) {
          resolver.resolve(quote);
          this.promiseResolvers.delete(quote.ticker);
          this.pendingRequests.delete(quote.ticker);
        }
      });

      // Handle any missing tickers
      tickers.forEach(ticker => {
        if (!quotes.find(q => q.ticker === ticker)) {
          const resolver = this.promiseResolvers.get(ticker);
          if (resolver) {
            resolver.reject(new Error(`No data for ${ticker}`));
            this.promiseResolvers.delete(ticker);
            this.pendingRequests.delete(ticker);
          }
        }
      });

    } catch (error) {
      // Reject all pending promises
      tickers.forEach(ticker => {
        const resolver = this.promiseResolvers.get(ticker);
        if (resolver) {
          resolver.reject(error);
          this.promiseResolvers.delete(ticker);
          this.pendingRequests.delete(ticker);
        }
      });
    }
  }

  private async getCachedQuote(ticker: string): Promise<Quote | null> {
    const { data } = await supabase
      .from('market_data_cache')
      .select('*')
      .eq('ticker', ticker)
      .single();

    return data ? this.parseQuoteFromCache(data) : null;
  }

  private isValidCache(quote: Quote): boolean {
    const now = Date.now();
    const cacheAge = now - quote.lastUpdated;
    const maxAge = this.isMarketHours() ? 15000 : 300000; // 15s during market, 5min after
    return cacheAge < maxAge;
  }
}
```

### 5. WebSocket Multiplexer

```typescript
// Single WebSocket connection for all tickers
export class WebSocketMultiplexer {
  private connection: WebSocket | null = null;
  private subscriptions: Map<string, Set<string>> = new Map(); // ticker -> userIds
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  async connect() {
    try {
      this.connection = new WebSocket(process.env.MARKET_DATA_WEBSOCKET_URL!);

      this.connection.onopen = () => {
        console.log('📡 WebSocket connected');
        this.reconnectAttempts = 0;
        this.resubscribeAll();
      };

      this.connection.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          this.handleMarketUpdate(update);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.connection.onclose = () => {
        console.log('📡 WebSocket disconnected');
        this.handleReconnect();
      };

      this.connection.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.handleReconnect();
    }
  }

  async subscribeTicker(ticker: string, userId: string) {
    if (!this.subscriptions.has(ticker)) {
      // First subscription for this ticker
      this.subscriptions.set(ticker, new Set());

      if (this.connection?.readyState === WebSocket.OPEN) {
        this.connection.send(JSON.stringify({
          action: 'subscribe',
          ticker: ticker
        }));
      }
    }

    this.subscriptions.get(ticker)!.add(userId);

    // Update database
    await supabase.rpc('subscribe_user_to_ticker', {
      p_user_id: userId,
      p_ticker: ticker
    });
  }

  async unsubscribeTicker(ticker: string, userId: string) {
    const users = this.subscriptions.get(ticker);
    if (!users) return;

    users.delete(userId);

    if (users.size === 0) {
      // No more subscribers for this ticker
      this.subscriptions.delete(ticker);

      if (this.connection?.readyState === WebSocket.OPEN) {
        this.connection.send(JSON.stringify({
          action: 'unsubscribe',
          ticker: ticker
        }));
      }
    }

    // Update database
    await supabase.rpc('unsubscribe_user_from_ticker', {
      p_user_id: userId,
      p_ticker: ticker
    });
  }

  private async handleMarketUpdate(update: MarketDataUpdate) {
    const { ticker, data } = update;

    // Cache the update
    await this.cacheMarketData(ticker, data);

    // Get all users subscribed to this ticker
    const users = this.subscriptions.get(ticker);
    if (!users || users.size === 0) return;

    // Broadcast to all subscribed users via Supabase Realtime
    await supabase.channel(`ticker:${ticker}`)
      .send({
        type: 'broadcast',
        event: 'quote_update',
        payload: data
      });
  }

  private async cacheMarketData(ticker: string, data: MarketData) {
    await supabase
      .from('market_data_cache')
      .upsert({
        ticker,
        quote_data: data,
        price: data.price,
        change_percent: data.changePercent,
        volume: data.volume,
        last_updated: new Date().toISOString(),
        ttl_expires_at: new Date(Date.now() + 15000).toISOString() // 15s TTL
      });
  }

  private async resubscribeAll() {
    // Get all active tickers from database
    const { data: activeTickers } = await supabase.rpc('get_active_tickers');

    for (const { ticker } of activeTickers || []) {
      if (this.connection?.readyState === WebSocket.OPEN) {
        this.connection.send(JSON.stringify({
          action: 'subscribe',
          ticker: ticker
        }));
      }
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }
}
```

### 6. Shared Alert Processing

```typescript
// Process alerts for all users in single pass
export class SharedAlertProcessor {
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL = 15000; // 15 seconds

  start() {
    this.processingInterval = setInterval(() => {
      this.evaluateAllAlerts();
    }, this.PROCESSING_INTERVAL);
  }

  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  async evaluateAllAlerts() {
    try {
      // Get all active alerts grouped by ticker
      const alertGroups = await this.getActiveAlertsGroupedByTicker();

      if (Object.keys(alertGroups).length === 0) return;

      // Fetch current prices for all tickers in one batch
      const tickers = Object.keys(alertGroups);
      const prices = await this.batchFetcher.fetchQuotesBatch(tickers);

      const triggeredAlerts: Alert[] = [];

      // Evaluate all alerts in memory
      for (const [ticker, alerts] of Object.entries(alertGroups)) {
        const currentPrice = prices.find(p => p.ticker === ticker)?.price;
        if (!currentPrice) continue;

        // Check each alert for this ticker
        for (const alert of alerts) {
          if (this.checkAlertCondition(alert, currentPrice)) {
            triggeredAlerts.push(alert);
          }
        }
      }

      // Batch process all triggered alerts
      if (triggeredAlerts.length > 0) {
        await this.batchProcessTriggeredAlerts(triggeredAlerts);
      }

    } catch (error) {
      console.error('Error evaluating alerts:', error);
    }
  }

  private async getActiveAlertsGroupedByTicker(): Promise<Record<string, Alert[]>> {
    const { data: alerts } = await supabase
      .from('alerts')
      .select('*')
      .eq('is_active', true)
      .not('expires_at', 'lt', new Date().toISOString());

    const grouped: Record<string, Alert[]> = {};

    for (const alert of alerts || []) {
      if (!grouped[alert.symbol]) {
        grouped[alert.symbol] = [];
      }
      grouped[alert.symbol].push(alert);
    }

    return grouped;
  }

  private checkAlertCondition(alert: Alert, currentPrice: number): boolean {
    const { condition, price, last_price } = alert;

    switch (condition) {
      case 'above':
        return currentPrice > price;

      case 'below':
        return currentPrice < price;

      case 'crosses_above':
        return last_price !== null && last_price <= price && currentPrice > price;

      case 'crosses_below':
        return last_price !== null && last_price >= price && currentPrice < price;

      default:
        return false;
    }
  }

  private async batchProcessTriggeredAlerts(alerts: Alert[]) {
    // Group by priority for efficient processing
    const priorityGroups = this.groupAlertsByPriority(alerts);

    // Process high priority first
    for (const priority of ['critical', 'high', 'medium', 'low']) {
      const alertsForPriority = priorityGroups[priority] || [];
      if (alertsForPriority.length === 0) continue;

      // Batch notification creation
      await this.createBatchNotifications(alertsForPriority);

      // Update alert status
      await this.updateAlertStatuses(alertsForPriority);
    }
  }

  private async createBatchNotifications(alerts: Alert[]) {
    const notifications = alerts.map(alert => ({
      alert_id: alert.id,
      user_id: alert.user_id,
      priority: alert.priority,
      category: alert.category,
      payload: {
        title: `${alert.symbol} Alert`,
        body: `${alert.symbol} ${alert.condition} $${alert.price}`,
        ticker: alert.symbol,
        current_price: alert.current_price
      },
      scheduled_at: new Date().toISOString()
    }));

    // Batch insert notifications
    await supabase
      .from('notifications_queue')
      .insert(notifications);
  }

  private async updateAlertStatuses(alerts: Alert[]) {
    const updates = alerts.map(alert => ({
      id: alert.id,
      triggered_at: new Date().toISOString(),
      last_price: alert.current_price,
      status: alert.repeat === 'once_per_day' ? 'triggered' : 'active'
    }));

    // Batch update alerts
    for (const update of updates) {
      await supabase
        .from('alerts')
        .update(update)
        .eq('id', update.id);
    }
  }
}
```

---

## 📈 Server-Side Summarization Service

### 7. Batch LLM Processing

```typescript
// Server-side summarization with caching and batching
export class ServerSummarizationService {
  private llmClient: OpenAI;
  private summarizationQueue: SummarizationQueue;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_DELAY = 5000; // 5 seconds

  constructor() {
    this.llmClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000
    });
  }

  async summarizeNews(articles: NewsArticle[]): Promise<Summary[]> {
    const summaries: Summary[] = [];

    for (const article of articles) {
      // Check cache first
      const cached = await this.getCachedSummary(article.id);
      if (cached) {
        summaries.push(cached);
        continue;
      }

      // Add to processing queue
      const summary = await this.queueForSummarization(article);
      summaries.push(summary);
    }

    return summaries;
  }

  async summarizeEarnings(report: EarningsReport): Promise<EarningsSummary> {
    const cacheKey = `${report.ticker}_${report.quarter}_${report.year}`;

    // Check cache first
    const cached = await this.getCachedEarningsSummary(cacheKey);
    if (cached) return cached;

    // Process with LLM
    const summary = await this.processEarningsReport(report);

    // Cache result
    await this.cacheEarningsSummary(cacheKey, summary);

    return summary;
  }

  private async processEarningsReport(report: EarningsReport): Promise<EarningsSummary> {
    const prompt = `
Analyze this earnings report and provide a concise summary:

Company: ${report.ticker}
Quarter: ${report.quarter} ${report.year}
Transcript: ${report.transcript}

Please provide:
1. Executive Summary (2-3 sentences)
2. Key Financial Metrics
3. Forward Guidance
4. Sentiment Score (-1 to 1)

Format as JSON with keys: executiveSummary, keyMetrics, forwardGuidance, sentimentScore
`;

    try {
      const response = await this.llmClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from LLM');

      return JSON.parse(content);

    } catch (error) {
      console.error('Error processing earnings report:', error);
      throw error;
    }
  }

  private async queueForSummarization(article: NewsArticle): Promise<Summary> {
    // Add to batch queue
    return new Promise((resolve, reject) => {
      this.summarizationQueue.add({
        article,
        resolve,
        reject
      });
    });
  }

  async processSummarizationBatch() {
    const batch = this.summarizationQueue.getBatch(this.BATCH_SIZE);
    if (batch.length === 0) return;

    try {
      // Create batch prompt for multiple articles
      const batchPrompt = this.createBatchPrompt(batch.map(item => item.article));

      const response = await this.llmClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: batchPrompt }],
        temperature: 0.3,
        max_tokens: 2000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from LLM');

      const summaries = JSON.parse(content);

      // Resolve promises and cache results
      for (let i = 0; i < batch.length; i++) {
        const summary = summaries[i];
        const item = batch[i];

        // Cache summary
        await this.cacheSummary(item.article.id, summary);

        // Resolve promise
        item.resolve(summary);
      }

    } catch (error) {
      console.error('Error processing summarization batch:', error);

      // Reject all promises in batch
      batch.forEach(item => item.reject(error));
    }
  }

  private createBatchPrompt(articles: NewsArticle[]): string {
    const articlesText = articles.map((article, index) =>
      `Article ${index + 1}:
Title: ${article.title}
Content: ${article.content}
---`
    ).join('\n');

    return `
Summarize these ${articles.length} financial news articles. For each article, provide:
1. Summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Sentiment score (-1 to 1)
4. Related tickers

${articlesText}

Respond with a JSON array where each element corresponds to an article in order:
[
  {
    "summary": "...",
    "keyPoints": ["...", "..."],
    "sentimentScore": 0.5,
    "relatedTickers": ["AAPL", "MSFT"]
  }
]
`;
  }

  private async getCachedSummary(articleId: string): Promise<Summary | null> {
    const { data } = await supabase
      .from('news_summaries_cache')
      .select('*')
      .eq('article_id', articleId)
      .gt('expires_at', new Date().toISOString())
      .single();

    return data ? {
      summary: data.summary,
      keyPoints: data.key_points,
      sentimentScore: data.sentiment_score,
      relatedTickers: data.related_tickers
    } : null;
  }

  private async cacheSummary(articleId: string, summary: Summary) {
    await supabase
      .from('news_summaries_cache')
      .upsert({
        article_id: articleId,
        summary: summary.summary,
        key_points: summary.keyPoints,
        sentiment_score: summary.sentimentScore,
        related_tickers: summary.relatedTickers,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });
  }
}
```

---

## 🎯 Implementation Roadmap

### Phase 1: Foundation (Week 1)
1. **Database Schema Setup**
   - Create ticker subscription tables
   - Set up market data cache
   - Add news/earnings summary tables

2. **Subscription Management**
   - Implement reference counting functions
   - Build subscription/unsubscription logic
   - Create user-ticker mapping system

### Phase 2: Data Optimization (Week 2)
1. **Batch Processing Service**
   - Build batch data fetcher
   - Implement smart caching layer
   - Add cache invalidation logic

2. **WebSocket Multiplexer**
   - Single connection management
   - Pub/sub distribution system
   - Automatic reconnection handling

### Phase 3: Alert Optimization (Week 3)
1. **Shared Alert Processor**
   - Batch alert evaluation
   - Priority-based processing
   - Efficient notification creation

2. **Real-time Distribution**
   - Supabase Realtime integration
   - User-specific message routing
   - Offline queue management

### Phase 4: Summarization Service (Week 4)
1. **Server-side LLM Integration**
   - Batch summarization processing
   - Smart caching strategy
   - Cost optimization techniques

2. **Performance Monitoring**
   - Cost tracking dashboard
   - Performance metrics
   - Optimization analytics

---

## 📊 Performance Targets

### Scalability Metrics
- **10,000 concurrent users**: Same infrastructure cost
- **100 unique tickers**: 99% overlap efficiency
- **Response time**: < 100ms from cache
- **API efficiency**: 1 call per ticker (not per user)

### Cost Efficiency
- **Per user cost**: $0.15/month vs $116/month
- **API cost reduction**: 98.7% savings
- **Infrastructure scaling**: Linear growth with user base
- **Cache hit rate**: > 95% for market data

### Quality Assurance
- **Uptime target**: 99.9% availability
- **Data consistency**: Real-time sync across all users
- **Alert accuracy**: < 1% false positives
- **Summarization quality**: Human-level comprehension

---

## 🔧 Monitoring & Optimization

### Key Metrics to Track
1. **Cost per user per month**
2. **API calls per unique ticker**
3. **Cache hit rates by data type**
4. **WebSocket connection efficiency**
5. **Alert processing latency**
6. **Summarization batch processing time**

### Optimization Strategies
1. **Dynamic TTL adjustment** based on market hours
2. **Predictive caching** for popular tickers
3. **Load balancing** for high-traffic periods
4. **Intelligent batching** with demand-based sizing
5. **Cost-aware LLM usage** with smart fallbacks

---

*Last updated: 2025-01-18 - Server-side cost optimization strategy without on-device LLM*