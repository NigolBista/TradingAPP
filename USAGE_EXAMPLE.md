# Brokerage Integration Usage Example

Here's a practical example of how to use the new brokerage integration in your trading app:

## Quick Start

### 1. Connect Your Account

Go to Profile → Brokerage Accounts → Connect to Robinhood/Webull

### 2. Use in Your Components

```typescript
import React, { useEffect, useState } from "react";
import { enhancedMarketDataService } from "../services/enhancedMarketData";

function StockDetailScreen({ symbol }: { symbol: string }) {
  const [quote, setQuote] = useState(null);
  const [candles, setCandles] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStockData();
  }, [symbol]);

  const loadStockData = async () => {
    try {
      setLoading(true);

      // Get real-time quote (prefers brokerage data)
      const quoteData = await enhancedMarketDataService.getQuote(symbol, {
        preferBrokerage: true,
      });

      // Get 1-minute candles for intraday chart
      const candleData = await enhancedMarketDataService.getCandles(symbol, {
        preferBrokerage: true,
        resolution: "1", // 1-minute
      });

      // Get latest news
      const newsData = await enhancedMarketDataService.getNews(symbol, {
        preferBrokerage: true,
      });

      setQuote(quoteData);
      setCandles(candleData);
      setNews(newsData);
    } catch (error) {
      console.error("Failed to load stock data:", error);
      // App will automatically fall back to traditional APIs
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      {quote && (
        <View>
          <Text>${quote.price.toFixed(2)}</Text>
          <Text style={{ color: quote.change >= 0 ? "green" : "red" }}>
            {quote.change >= 0 ? "+" : ""}
            {quote.change.toFixed(2)}({quote.changePercent.toFixed(2)}%)
          </Text>
          <Text>
            {quote.isRealTime ? "Real-time" : "Delayed"} • {quote.provider}
          </Text>
        </View>
      )}

      {/* Your chart component using candles */}
      {/* Your news component using news */}
    </View>
  );
}
```

### 3. Portfolio Integration

```typescript
import { enhancedMarketDataService } from "../services/enhancedMarketData";

function PortfolioScreen() {
  const [positions, setPositions] = useState([]);
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    loadPortfolioData();
  }, []);

  const loadPortfolioData = async () => {
    try {
      // Get all positions from connected accounts
      const userPositions = await enhancedMarketDataService.getPositions();

      // Get watchlist from connected accounts
      const userWatchlist = await enhancedMarketDataService.getWatchlist();

      setPositions(userPositions);
      setWatchlist(userWatchlist);
    } catch (error) {
      console.error("Failed to load portfolio:", error);
    }
  };

  return (
    <ScrollView>
      <Text>Your Positions</Text>
      {positions.map((position) => (
        <View key={position.symbol}>
          <Text>{position.symbol}</Text>
          <Text>{position.quantity} shares</Text>
          <Text>${position.marketValue.toFixed(2)}</Text>
          <Text
            style={{ color: position.unrealizedPnL >= 0 ? "green" : "red" }}
          >
            {position.unrealizedPnL >= 0 ? "+" : ""}$
            {position.unrealizedPnL.toFixed(2)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
```

### 4. Connection Status Monitoring

```typescript
import { sessionHeartbeatService } from "../services/sessionHeartbeat";
import { brokerageAuthService } from "../services/brokerageAuth";

function ConnectionStatusWidget() {
  const [connections, setConnections] = useState([]);
  const [heartbeatStatus, setHeartbeatStatus] = useState({});

  useEffect(() => {
    checkConnections();
    const interval = setInterval(checkConnections, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const checkConnections = async () => {
    const active = brokerageAuthService.getActiveSessions();
    const status = sessionHeartbeatService.getHeartbeatStatus();

    setConnections(active);
    setHeartbeatStatus(status);
  };

  return (
    <View>
      {connections.map((provider) => (
        <View
          key={provider}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: heartbeatStatus[provider]?.active
                ? "green"
                : "red",
              marginRight: 8,
            }}
          />
          <Text>{provider.charAt(0).toUpperCase() + provider.slice(1)}</Text>
          <Text style={{ marginLeft: "auto" }}>
            {heartbeatStatus[provider]?.retries > 0
              ? `${heartbeatStatus[provider].retries} retries`
              : "Connected"}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

### 5. Settings Integration

The brokerage settings are already integrated into your ProfileScreen. Users can:

1. Connect new accounts
2. Test existing connections
3. Disconnect accounts
4. View connection status

### 6. Error Handling Best Practices

```typescript
import { enhancedMarketDataService } from "../services/enhancedMarketData";

async function safeGetQuote(symbol: string) {
  try {
    // Try brokerage first
    return await enhancedMarketDataService.getQuote(symbol, {
      preferBrokerage: true,
    });
  } catch (error) {
    console.warn("Brokerage failed, trying fallback:", error);

    try {
      // Fall back to traditional APIs
      return await enhancedMarketDataService.getQuote(symbol, {
        preferBrokerage: false,
      });
    } catch (fallbackError) {
      console.error("All providers failed:", fallbackError);
      // Return cached data or show error to user
      throw new Error("Unable to fetch quote data");
    }
  }
}
```

## Integration Checklist

- [ ] Users can connect brokerage accounts via Profile settings
- [ ] App prefers brokerage data when available
- [ ] Graceful fallback to traditional APIs
- [ ] Real-time vs delayed data indicators
- [ ] Connection status monitoring
- [ ] Session keep-alive working
- [ ] Error handling implemented
- [ ] User can disconnect accounts

## Performance Tips

1. **Cache Quotes**: Quotes are cached for 30 seconds automatically
2. **Batch Requests**: Load multiple symbols together when possible
3. **Background Updates**: Use 10-15 minute intervals for background data
4. **Connection Pooling**: Reuse sessions across requests

## Monitoring

Check these in your app:

```typescript
// Cache statistics
const stats = enhancedMarketDataService.getCacheStats();
console.log("Cache size:", stats.quoteCacheSize);
console.log("Heartbeat status:", stats.heartbeatStatus);

// Connection health
const connections = await enhancedMarketDataService.checkAllConnections();
console.log("Connection status:", connections);

// Data sources available
const sources = enhancedMarketDataService.getAvailableDataSources();
console.log("Available brokerage accounts:", sources.brokerage);
console.log("Traditional providers:", sources.traditional);
```

This integration gives you access to real-time market data while maintaining compatibility with existing code and providing robust fallback mechanisms.
