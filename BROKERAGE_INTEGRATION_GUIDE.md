# Brokerage Integration Guide

This guide explains how to use the new brokerage integration feature for Robinhood and Webull in your personal trading app.

## Overview

The brokerage integration allows you to authenticate with Robinhood and Webull through their web platforms and then reuse those sessions to fetch real-time market data, news, and account information directly from their APIs.

## Features Implemented

### 1. WebView Authentication (`src/services/brokerageAuth.ts`)
- Secure session management with encrypted storage
- Support for Robinhood and Webull login
- Automatic session validation and refresh
- Cookie and token extraction from authenticated sessions

### 2. API Service (`src/services/brokerageApiService.ts`)
- Real-time quotes and market data
- Historical candle data
- News feeds specific to symbols
- User positions and portfolio data
- Watchlist management
- Provider-specific API endpoint handling

### 3. Session Heartbeat (`src/services/sessionHeartbeat.ts`)
- Automatic session keep-alive every 10-15 minutes
- Background/foreground state handling
- Retry logic with exponential backoff
- Session expiration detection
- Connection health monitoring

### 4. Enhanced Market Data Service (`src/services/enhancedMarketData.ts`)
- Unified interface for all data sources
- Automatic fallback to traditional APIs
- Real-time vs delayed data preference
- Intelligent provider selection
- Quote caching for performance

### 5. UI Components
- **BrokerageAuthWebView**: WebView-based authentication flow
- **BrokerageConnectionManager**: Settings UI for managing connections
- **Profile Screen Integration**: Easy access to brokerage settings

## How to Use

### 1. Connect Your Brokerage Account

1. Open the app and go to Profile
2. Tap "Brokerage Accounts"
3. Select either Robinhood or Webull
4. Log in through the secure WebView
5. Complete any 2FA if required
6. Wait for automatic session detection

### 2. Use Enhanced Market Data

```typescript
import { enhancedMarketDataService } from '../services/enhancedMarketData';

// Get real-time quote (prefers brokerage data)
const quote = await enhancedMarketDataService.getQuote('AAPL', {
  preferBrokerage: true,
  brokerageProvider: 'robinhood'
});

// Get candles with brokerage data
const candles = await enhancedMarketDataService.getCandles('AAPL', {
  preferBrokerage: true,
  resolution: '1',  // 1-minute candles
});

// Get news from brokerage
const news = await enhancedMarketDataService.getNews('AAPL', {
  preferBrokerage: true
});

// Get your positions
const positions = await enhancedMarketDataService.getPositions();

// Get your watchlist
const watchlist = await enhancedMarketDataService.getWatchlist();
```

### 3. Update Existing Components

To use brokerage data in existing components, simply update your imports:

```typescript
// Before
import { fetchCandles } from '../services/marketProviders';

// After
import { enhancedMarketDataService } from '../services/enhancedMarketData';

// Usage
const candles = await enhancedMarketDataService.getCandles(symbol, {
  preferBrokerage: true,
  resolution: '1D'
});
```

## API Endpoints Used

### Robinhood
- Quotes: `https://robinhood.com/api/quotes/?symbols={symbol}`
- Candles: `https://robinhood.com/api/marketdata/historicals/{symbol}/`
- News: `https://robinhood.com/api/midlands/news/{symbol}/`
- Positions: `https://robinhood.com/api/positions/`
- Watchlist: `https://robinhood.com/api/watchlists/`

### Webull
- Quotes: `https://quotes-gw.webullfintech.com/api/stock/tickerRealTime/getQuote`
- Candles: `https://quotes-gw.webullfintech.com/api/stock/capitalflow/ticker`
- News: `https://infoapi.webullfintech.com/api/information/news/query`
- Positions: `https://trade-gw.webullfintech.com/api/trade/account/getPositions`
- Watchlist: `https://userapi.webullfintech.com/api/user/watchlist/query`

## Security Considerations

### Encrypted Storage
- All session data is encrypted using AES encryption
- Stored locally on device using AsyncStorage
- Encryption key is app-specific

### Session Management
- Sessions auto-expire after 24 hours by default
- Automatic refresh using refresh tokens when available
- Session validation before each API call

### Rate Limiting
- Automatic 10-15 minute refresh intervals to avoid detection
- Request queuing to prevent concurrent duplicate calls
- Graceful fallback to traditional APIs on failure

## Data Flow

```
User Login (WebView) 
    ↓
Session Extraction (cookies + tokens)
    ↓
Encrypted Storage
    ↓
API Calls with Session
    ↓
Real-time Data / News / Positions
    ↓
Automatic Session Refresh
```

## Fallback Strategy

1. **Primary**: Use brokerage API if session is active and healthy
2. **Secondary**: Fall back to traditional APIs (Yahoo, Alpha Vantage, etc.)
3. **Caching**: Cache responses to minimize API calls
4. **Error Handling**: Graceful degradation with user notifications

## Configuration

### Environment Variables
```typescript
// app.config.ts or expo config
export default {
  extra: {
    marketProvider: 'robinhood', // Default provider
    enableBrokerageIntegration: true,
    // ... other config
  }
};
```

### Usage Options
```typescript
// Prefer brokerage data
const options = {
  preferBrokerage: true,
  brokerageProvider: 'robinhood', // or 'webull'
  resolution: '1',
  outputSize: 'compact'
};
```

## Monitoring and Health Checks

### Connection Status
```typescript
// Check all connections
const status = await enhancedMarketDataService.checkAllConnections();

// Get heartbeat status
const heartbeat = sessionHeartbeatService.getHeartbeatStatus();

// Manual session refresh
await enhancedMarketDataService.refreshAllSessions();
```

### Cache Management
```typescript
// Clear quote cache
enhancedMarketDataService.clearQuoteCache();

// Get cache stats
const stats = enhancedMarketDataService.getCacheStats();
```

## Best Practices

### 1. Error Handling
Always implement proper error handling with fallbacks:

```typescript
try {
  const quote = await enhancedMarketDataService.getQuote('AAPL', {
    preferBrokerage: true
  });
} catch (error) {
  console.error('Failed to get quote:', error);
  // App continues with cached data or alternative provider
}
```

### 2. User Experience
- Show connection status in UI
- Provide clear feedback during authentication
- Handle session expiration gracefully
- Offer manual retry options

### 3. Rate Limiting
- Don't refresh data more frequently than every 30 seconds for quotes
- Use 10-15 minute intervals for background updates
- Implement request queuing for multiple symbols

### 4. Privacy
- Never log sensitive session data
- Clear sessions on app uninstall
- Provide easy disconnect options

## Troubleshooting

### Common Issues

1. **Session Expired**
   - Solution: Re-authenticate through settings
   - Prevention: Monitor heartbeat service

2. **Rate Limited**
   - Solution: Increase refresh intervals
   - Prevention: Implement proper queuing

3. **API Changes**
   - Solution: Update endpoint URLs
   - Prevention: Monitor error patterns

4. **2FA Required**
   - Solution: Complete 2FA in WebView
   - Prevention: Keep sessions fresh

### Debug Information
```typescript
// Check session status
const sessions = brokerageAuthService.getActiveSessions();

// Test connection
const isConnected = await brokerageApiService.checkConnection('robinhood');

// View heartbeat status
const status = sessionHeartbeatService.getHeartbeatStatus();
```

## Legal and Compliance

⚠️ **Important**: This integration is intended for personal use only. Users must:

1. Respect platform Terms of Service
2. Not use for commercial redistribution
3. Implement reasonable rate limiting
4. Handle user data responsibly
5. Provide clear privacy policies

## Future Enhancements

Potential improvements for future versions:

1. **Additional Brokerages**: TD Ameritrade, E*TRADE, Fidelity
2. **Real-time Streaming**: WebSocket connections for live data
3. **Advanced Orders**: Place trades through connected accounts
4. **Portfolio Sync**: Automatic watchlist synchronization
5. **Options Data**: Real-time options chains and pricing
6. **Earnings Calendar**: Upcoming earnings from brokerage feeds

---

This integration provides a powerful foundation for real-time market data while maintaining security and respecting platform constraints. The modular design allows for easy expansion and maintenance as requirements evolve.