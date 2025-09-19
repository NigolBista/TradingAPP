-- Multi-Tenant Cost Optimization Database Schema
-- This migration creates the necessary tables and functions for shared data management

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types for better type safety
CREATE TYPE alert_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE alert_category AS ENUM ('price', 'volume', 'news', 'technical', 'discord', 'earnings');
CREATE TYPE alert_status AS ENUM ('active', 'triggered', 'paused', 'expired', 'failed');
CREATE TYPE queue_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'retrying');

-- Ticker subscriptions with reference counting for deduplication
CREATE TABLE ticker_subscriptions (
  ticker TEXT PRIMARY KEY,
  subscriber_count INTEGER DEFAULT 0 CHECK (subscriber_count >= 0),
  last_fetched TIMESTAMPTZ,
  cached_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_ticker_subscriptions_updated_at ON ticker_subscriptions(updated_at);
CREATE INDEX idx_ticker_subscriptions_subscriber_count ON ticker_subscriptions(subscriber_count) WHERE subscriber_count > 0;

-- User-ticker mappings for tracking individual subscriptions
CREATE TABLE user_ticker_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{}',
  UNIQUE(user_id, ticker),
  FOREIGN KEY (ticker) REFERENCES ticker_subscriptions(ticker) ON DELETE CASCADE
);

-- Indexes for efficient user queries
CREATE INDEX idx_user_ticker_subscriptions_user_id ON user_ticker_subscriptions(user_id);
CREATE INDEX idx_user_ticker_subscriptions_ticker ON user_ticker_subscriptions(ticker);
CREATE INDEX idx_user_ticker_subscriptions_last_accessed ON user_ticker_subscriptions(last_accessed);

-- Market data cache for shared real-time data
CREATE TABLE market_data_cache (
  ticker TEXT PRIMARY KEY,
  quote_data JSONB NOT NULL,
  price DECIMAL(10,4),
  change_percent DECIMAL(6,4),
  volume BIGINT,
  market_cap BIGINT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  ttl_expires_at TIMESTAMPTZ,
  data_source TEXT DEFAULT 'polygon'
);

-- Indexes for efficient market data queries
CREATE INDEX idx_market_data_cache_last_updated ON market_data_cache(last_updated);
CREATE INDEX idx_market_data_cache_ttl_expires_at ON market_data_cache(ttl_expires_at);
CREATE INDEX idx_market_data_cache_price ON market_data_cache(price) WHERE price IS NOT NULL;

-- Enhanced alerts table with priority and categories
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS priority alert_priority DEFAULT 'medium';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS category alert_category DEFAULT 'price';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status alert_status DEFAULT 'active';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS cooldown_period INTEGER DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Indexes for enhanced alerts
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol_status ON alerts(symbol, status) WHERE status = 'active';

-- Priority-based notifications queue
CREATE TABLE notifications_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  priority alert_priority NOT NULL,
  category alert_category NOT NULL,
  payload JSONB NOT NULL,
  status queue_status DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queue processing
CREATE INDEX idx_notifications_queue_status_priority ON notifications_queue(status, priority) WHERE status = 'pending';
CREATE INDEX idx_notifications_queue_scheduled_at ON notifications_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_notifications_queue_user_id ON notifications_queue(user_id);

-- User notification preferences
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category alert_category NOT NULL,
  priority alert_priority NOT NULL,
  enabled BOOLEAN DEFAULT true,
  delivery_methods TEXT[] DEFAULT ARRAY['push'],
  quiet_hours JSONB, -- {"start": "22:00", "end": "08:00", "timezone": "America/New_York"}
  throttle_minutes INTEGER DEFAULT 0, -- Minimum minutes between notifications
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, priority)
);

-- Index for notification preferences
CREATE INDEX idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);

-- Alert history and analytics
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  triggered_price DECIMAL(10,4),
  target_price DECIMAL(10,4),
  condition TEXT NOT NULL,
  notification_sent BOOLEAN DEFAULT false,
  response_time_ms INTEGER,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for alert history
CREATE INDEX idx_alert_history_alert_id ON alert_history(alert_id);
CREATE INDEX idx_alert_history_user_id ON alert_history(user_id);
CREATE INDEX idx_alert_history_ticker ON alert_history(ticker);
CREATE INDEX idx_alert_history_triggered_at ON alert_history(triggered_at);

-- News summaries cache (server-side LLM processing)
CREATE TABLE news_summaries_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id TEXT UNIQUE NOT NULL,
  article_url TEXT,
  original_title TEXT NOT NULL,
  original_content TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_points TEXT[] DEFAULT ARRAY[]::TEXT[],
  sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  related_tickers TEXT[] DEFAULT ARRAY[]::TEXT[],
  processing_time_ms INTEGER,
  llm_model TEXT DEFAULT 'gpt-3.5-turbo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes for news summaries
CREATE INDEX idx_news_summaries_cache_article_id ON news_summaries_cache(article_id);
CREATE INDEX idx_news_summaries_cache_expires_at ON news_summaries_cache(expires_at);
CREATE INDEX idx_news_summaries_cache_related_tickers ON news_summaries_cache USING GIN(related_tickers);
CREATE INDEX idx_news_summaries_cache_created_at ON news_summaries_cache(created_at);

-- Earnings summaries cache
CREATE TABLE earnings_summaries_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  quarter TEXT NOT NULL,
  year INTEGER NOT NULL,
  original_transcript TEXT,
  executive_summary TEXT NOT NULL,
  key_metrics JSONB DEFAULT '{}',
  forward_guidance TEXT,
  sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  analyst_questions TEXT[],
  management_responses TEXT[],
  processing_time_ms INTEGER,
  llm_model TEXT DEFAULT 'gpt-3.5-turbo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days',
  UNIQUE(ticker, quarter, year)
);

-- Indexes for earnings summaries
CREATE INDEX idx_earnings_summaries_cache_ticker ON earnings_summaries_cache(ticker);
CREATE INDEX idx_earnings_summaries_cache_quarter_year ON earnings_summaries_cache(quarter, year);
CREATE INDEX idx_earnings_summaries_cache_expires_at ON earnings_summaries_cache(expires_at);

-- Batch processing queue for API efficiency
CREATE TABLE batch_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_type TEXT NOT NULL, -- 'market_data', 'news_summary', 'earnings_summary'
  payload JSONB NOT NULL,
  priority INTEGER DEFAULT 5, -- 1 = highest, 10 = lowest
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for batch processing
CREATE INDEX idx_batch_processing_queue_status_priority ON batch_processing_queue(status, priority) WHERE status = 'pending';
CREATE INDEX idx_batch_processing_queue_batch_type ON batch_processing_queue(batch_type);
CREATE INDEX idx_batch_processing_queue_scheduled_at ON batch_processing_queue(scheduled_at);

-- Cost tracking table for monitoring
CREATE TABLE cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  service_type TEXT NOT NULL, -- 'polygon_api', 'openai_api', 'supabase_db', 'supabase_realtime'
  operation_type TEXT NOT NULL, -- 'quote_fetch', 'news_summary', 'earnings_summary', 'realtime_update'
  request_count INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0, -- Cost in cents for precision
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, service_type, operation_type)
);

-- Index for cost tracking
CREATE INDEX idx_cost_tracking_date ON cost_tracking(date);
CREATE INDEX idx_cost_tracking_service_type ON cost_tracking(service_type);

-- Function to subscribe user to ticker with reference counting
CREATE OR REPLACE FUNCTION subscribe_user_to_ticker(
  p_user_id UUID,
  p_ticker TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  is_first_subscriber BOOLEAN := FALSE;
BEGIN
  -- Insert or update ticker subscription count
  INSERT INTO ticker_subscriptions (ticker, subscriber_count)
  VALUES (p_ticker, 1)
  ON CONFLICT (ticker)
  DO UPDATE SET
    subscriber_count = ticker_subscriptions.subscriber_count + 1,
    updated_at = NOW();

  -- Get current subscriber count
  SELECT subscriber_count INTO current_count
  FROM ticker_subscriptions
  WHERE ticker = p_ticker;

  -- Check if this was the first subscriber
  is_first_subscriber := (current_count = 1);

  -- Add or update user-ticker mapping
  INSERT INTO user_ticker_subscriptions (user_id, ticker)
  VALUES (p_user_id, p_ticker)
  ON CONFLICT (user_id, ticker)
  DO UPDATE SET
    last_accessed = NOW();

  -- Return true if this was the first subscriber (needs API subscription)
  RETURN is_first_subscriber;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unsubscribe user from ticker with reference counting
CREATE OR REPLACE FUNCTION unsubscribe_user_from_ticker(
  p_user_id UUID,
  p_ticker TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  remaining_count INTEGER;
  is_last_subscriber BOOLEAN := FALSE;
BEGIN
  -- Remove user-ticker mapping
  DELETE FROM user_ticker_subscriptions
  WHERE user_id = p_user_id AND ticker = p_ticker;

  -- Check if mapping existed
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Decrease subscriber count
  UPDATE ticker_subscriptions
  SET
    subscriber_count = GREATEST(subscriber_count - 1, 0),
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
    is_last_subscriber := TRUE;
  END IF;

  -- Return true if this was the last subscriber (should close API subscription)
  RETURN is_last_subscriber;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all active tickers
CREATE OR REPLACE FUNCTION get_active_tickers()
RETURNS TABLE(ticker TEXT, subscriber_count INTEGER, last_fetched TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT ts.ticker, ts.subscriber_count, ts.last_fetched
  FROM ticker_subscriptions ts
  WHERE ts.subscriber_count > 0
  ORDER BY ts.subscriber_count DESC, ts.ticker;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's subscribed tickers
CREATE OR REPLACE FUNCTION get_user_tickers(p_user_id UUID)
RETURNS TABLE(ticker TEXT, subscribed_at TIMESTAMPTZ, last_accessed TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT uts.ticker, uts.subscribed_at, uts.last_accessed
  FROM user_ticker_subscriptions uts
  WHERE uts.user_id = p_user_id
  ORDER BY uts.last_accessed DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update market data cache
CREATE OR REPLACE FUNCTION update_market_data_cache(
  p_ticker TEXT,
  p_quote_data JSONB,
  p_price DECIMAL(10,4) DEFAULT NULL,
  p_change_percent DECIMAL(6,4) DEFAULT NULL,
  p_volume BIGINT DEFAULT NULL,
  p_ttl_seconds INTEGER DEFAULT 15
) RETURNS VOID AS $$
BEGIN
  INSERT INTO market_data_cache (
    ticker,
    quote_data,
    price,
    change_percent,
    volume,
    last_updated,
    ttl_expires_at
  )
  VALUES (
    p_ticker,
    p_quote_data,
    p_price,
    p_change_percent,
    p_volume,
    NOW(),
    NOW() + (p_ttl_seconds || ' seconds')::INTERVAL
  )
  ON CONFLICT (ticker)
  DO UPDATE SET
    quote_data = EXCLUDED.quote_data,
    price = EXCLUDED.price,
    change_percent = EXCLUDED.change_percent,
    volume = EXCLUDED.volume,
    last_updated = EXCLUDED.last_updated,
    ttl_expires_at = EXCLUDED.ttl_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get cached market data
CREATE OR REPLACE FUNCTION get_cached_market_data(p_ticker TEXT)
RETURNS TABLE(
  ticker TEXT,
  quote_data JSONB,
  price DECIMAL(10,4),
  change_percent DECIMAL(6,4),
  volume BIGINT,
  last_updated TIMESTAMPTZ,
  is_expired BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mdc.ticker,
    mdc.quote_data,
    mdc.price,
    mdc.change_percent,
    mdc.volume,
    mdc.last_updated,
    (mdc.ttl_expires_at < NOW()) as is_expired
  FROM market_data_cache mdc
  WHERE mdc.ticker = p_ticker;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Clean up expired market data
  DELETE FROM market_data_cache
  WHERE ttl_expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Clean up expired news summaries
  DELETE FROM news_summaries_cache
  WHERE expires_at < NOW();

  -- Clean up expired earnings summaries
  DELETE FROM earnings_summaries_cache
  WHERE expires_at < NOW();

  -- Clean up processed notifications older than 7 days
  DELETE FROM notifications_queue
  WHERE status IN ('succeeded', 'failed')
    AND processed_at < NOW() - INTERVAL '7 days';

  -- Clean up completed batch jobs older than 24 hours
  DELETE FROM batch_processing_queue
  WHERE status IN ('completed', 'failed')
    AND completed_at < NOW() - INTERVAL '24 hours';

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track API costs
CREATE OR REPLACE FUNCTION track_api_cost(
  p_service_type TEXT,
  p_operation_type TEXT,
  p_request_count INTEGER DEFAULT 1,
  p_cost_cents INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  INSERT INTO cost_tracking (
    date,
    service_type,
    operation_type,
    request_count,
    cost_cents
  )
  VALUES (
    CURRENT_DATE,
    p_service_type,
    p_operation_type,
    p_request_count,
    p_cost_cents
  )
  ON CONFLICT (date, service_type, operation_type)
  DO UPDATE SET
    request_count = cost_tracking.request_count + EXCLUDED.request_count,
    cost_cents = cost_tracking.cost_cents + EXCLUDED.cost_cents;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for security
ALTER TABLE ticker_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ticker_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_ticker_subscriptions
CREATE POLICY "Users can manage their own ticker subscriptions"
  ON user_ticker_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

-- RLS policies for notifications_queue
CREATE POLICY "Users can view their own notifications"
  ON notifications_queue
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS policies for user_notification_preferences
CREATE POLICY "Users can manage their own notification preferences"
  ON user_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id);

-- RLS policies for alert_history
CREATE POLICY "Users can view their own alert history"
  ON alert_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Public access for shared data (market data cache, ticker subscriptions)
CREATE POLICY "Market data cache is publicly readable"
  ON market_data_cache
  FOR SELECT
  USING (true);

CREATE POLICY "Ticker subscriptions are publicly readable"
  ON ticker_subscriptions
  FOR SELECT
  USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Create indexes for optimal performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_active_symbol
  ON alerts(symbol) WHERE status = 'active' AND is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_ticker_subscriptions_composite
  ON user_ticker_subscriptions(user_id, ticker, last_accessed);

-- Comments for documentation
COMMENT ON TABLE ticker_subscriptions IS 'Manages reference counting for ticker subscriptions to enable cost optimization';
COMMENT ON TABLE user_ticker_subscriptions IS 'Maps users to their subscribed tickers with access tracking';
COMMENT ON TABLE market_data_cache IS 'Caches market data to reduce API calls and improve performance';
COMMENT ON TABLE notifications_queue IS 'Priority-based queue for processing notifications efficiently';
COMMENT ON TABLE news_summaries_cache IS 'Caches AI-generated news summaries to avoid reprocessing';
COMMENT ON TABLE earnings_summaries_cache IS 'Caches AI-generated earnings summaries for quarterly reports';
COMMENT ON TABLE cost_tracking IS 'Tracks API usage and costs for monitoring and optimization';

-- Initial data for testing (optional)
-- INSERT INTO user_notification_preferences (user_id, category, priority, enabled)
-- SELECT
--   gen_random_uuid(),
--   category,
--   priority,
--   true
-- FROM
--   (VALUES ('price'), ('volume'), ('news')) AS cats(category),
--   (VALUES ('critical'), ('high'), ('medium'), ('low')) AS prios(priority);