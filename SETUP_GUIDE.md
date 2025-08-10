# 🚀 Webull Clone Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
# or
yarn install
```

### 2. Configure API Keys

Create or update `app.config.ts`:

```javascript
export default {
  expo: {
    name: "GPT5 Trading Platform",
    slug: "gpt5-trading",
    // ... other expo config
  },
  extra: {
    // Required for real market data
    marketDataApiToken: "YOUR_MARKETDATA_TOKEN",
    
    // Required for AI features
    openaiApiKey: "YOUR_OPENAI_API_KEY",
    
    // Optional - fallback providers
    alphaVantageApiKey: "YOUR_ALPHAVANTAGE_KEY",
    yahooApiKey: "YOUR_YAHOO_KEY", // Usually not required
    newsApiKey: "YOUR_NEWS_API_KEY",
    
    // Default market data provider
    marketProvider: "marketData", // or "alphaVantage", "yahoo"
  }
};
```

### 3. Get API Keys

#### MarketData.app (Recommended - Free tier available)
1. Visit [MarketData.app](https://marketdata.app)
2. Sign up for free account
3. Get API token from dashboard
4. Add to `marketDataApiToken` in config

#### OpenAI (Required for AI features)
1. Visit [OpenAI Platform](https://platform.openai.com)
2. Create account and get API key
3. Add to `openaiApiKey` in config
4. Ensure you have credits/billing set up

#### Alpha Vantage (Optional - Backup provider)
1. Visit [Alpha Vantage](https://www.alphavantage.co)
2. Get free API key
3. Add to `alphaVantageApiKey` in config

#### News API (Optional - Enhanced news features)
1. Visit [NewsAPI](https://newsapi.org)
2. Get free API key
3. Add to `newsApiKey` in config

### 4. Run the App

```bash
# Start Expo development server
npm start

# For specific platforms
npm run ios     # iOS Simulator
npm run android # Android Emulator  
npm run web     # Web browser
```

## 🔧 Configuration Options

### Market Data Providers

The app supports multiple data providers with automatic fallbacks:

1. **MarketData.app** (Primary)
   - ✅ Real-time data
   - ✅ Multiple timeframes
   - ✅ High reliability
   - ✅ Free tier available

2. **Alpha Vantage** (Secondary)
   - ✅ Comprehensive coverage
   - ✅ News integration
   - ⚠️ Rate limits on free tier

3. **Yahoo Finance** (Fallback)
   - ✅ No API key required
   - ✅ Always available
   - ⚠️ Limited features

### Provider Priority

Set your preferred provider in `app.config.ts`:

```javascript
extra: {
  marketProvider: "marketData", // Primary choice
  // App will automatically fallback to other providers if needed
}
```

## 🎯 Features Configuration

### AI Analytics
```javascript
// Enable/disable AI features
extra: {
  openaiApiKey: "sk-...", // Required for AI features
  // Without this key, app will use basic technical analysis only
}
```

### News Sentiment
```javascript
// Enable enhanced news analysis
extra: {
  newsApiKey: "your_key", // Optional - enables advanced news features
  // Without this, app will use basic RSS news feeds
}
```

### Real-time Updates
```javascript
// Configure update frequency
extra: {
  updateInterval: 30000, // 30 seconds (default)
  maxConcurrentRequests: 5, // API rate limiting
}
```

## 📱 Platform-Specific Setup

### iOS
```bash
# Install iOS dependencies
cd ios && pod install && cd ..

# Run on iOS
npm run ios
```

### Android
```bash
# Ensure Android SDK is installed
# Run on Android
npm run android
```

### Web
```bash
# Run on web
npm run web
```

## 🐛 Troubleshooting

### Common Issues

#### "No market data available"
- ✅ Check API keys in `app.config.ts`
- ✅ Verify internet connection
- ✅ Check API provider status
- ✅ Try switching to different provider

#### "AI features not working"
- ✅ Verify OpenAI API key is set
- ✅ Check OpenAI account has credits
- ✅ Ensure API key has correct permissions

#### "Charts not loading"
- ✅ Enable WebView in development
- ✅ Check TradingView script loading
- ✅ Verify symbol format (e.g., "NASDAQ:AAPL")

#### "App crashes on startup"
- ✅ Clear Expo cache: `expo r -c`
- ✅ Reinstall dependencies: `rm -rf node_modules && npm install`
- ✅ Check for syntax errors in config files

### Debug Mode

Enable debug logging:

```javascript
// In app.config.ts
extra: {
  debugMode: true, // Enables console logging
  apiDebug: true,  // Logs API requests/responses
}
```

### Performance Issues

If app is slow:

1. **Reduce scan frequency**:
```javascript
extra: {
  scanInterval: 60000, // Scan every 60 seconds instead of 30
}
```

2. **Limit concurrent requests**:
```javascript
extra: {
  maxConcurrentRequests: 3, // Reduce from default 5
}
```

3. **Disable heavy features temporarily**:
```javascript
extra: {
  enableAI: false, // Disable AI features temporarily
  enableScanner: false, // Disable market scanner
}
```

## 🔄 Updates & Maintenance

### Keeping Dependencies Updated
```bash
# Check for updates
npm outdated

# Update packages
npm update

# Update Expo SDK
npx expo install --fix
```

### API Key Rotation
- Regularly rotate API keys for security
- Monitor API usage and costs
- Set up alerts for rate limit issues

### Performance Monitoring
- Monitor app performance metrics
- Check API response times
- Optimize based on usage patterns

## 📚 Additional Resources

### Documentation
- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [TradingView Charting Library](https://www.tradingview.com/charting-library/)

### API Documentation
- [MarketData.app API](https://docs.marketdata.app)
- [Alpha Vantage API](https://www.alphavantage.co/documentation/)
- [OpenAI API](https://platform.openai.com/docs)

### Support
- Check GitHub issues for common problems
- Review logs for specific error messages
- Test with minimal configuration first

## 🎉 You're Ready!

Once configured, your Webull clone will provide:

- ✅ Real-time market data and charts
- ✅ AI-powered trading signals
- ✅ Advanced technical analysis
- ✅ Market sentiment analysis
- ✅ Comprehensive watchlist management
- ✅ Professional market scanner

Start the app and explore the features! The dashboard will guide you through the main functionality.