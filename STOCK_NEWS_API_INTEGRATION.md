# Stock News API Integration Guide

This document explains how to use the Stock News API integration in your React Native app, based on the examples from [stocknewsapi.com/examples](https://stocknewsapi.com/examples).

## Overview

The Stock News API integration provides comprehensive financial news data with advanced features including:

- **Sentiment Analysis**: Positive, Negative, or Neutral sentiment for each article
- **Content Types**: Articles, Videos, and Press Releases
- **Image Support**: News articles with associated images
- **Multi-ticker Support**: News mentioning multiple stocks
- **Sector Filtering**: News filtered by industry sectors
- **Trending Analysis**: Most mentioned stocks with sentiment
- **Market Events**: Important market events and announcements

## Setup

### 1. API Key Configuration

The API key is already configured in `app.config.ts`:

```typescript
// In your .env file
STOCK_NEWS_API_KEY=your_api_key_here

// Already configured in app.config.ts
stockNewsApiKey: process.env.STOCK_NEWS_API_KEY,
```

### 2. Environment Variables

Add your Stock News API key to your `.env` file:

```bash
STOCK_NEWS_API_KEY=uc6ic8zp9crgiq9r3g9f1b0wjnkjaqfyjnzbmfuu
```

## Available Functions

### Basic News Fetching

```typescript
import { fetchNews, fetchTeslaNews } from "../services/newsProviders";

// Get news for any symbol (uses default provider settings)
const news = await fetchNews("AAPL");

// Get Tesla news (3 items by default)
const teslaNews = await fetchTeslaNews(3);
```

### Multi-Ticker News

```typescript
import {
  fetchMultipleTechStocks,
  fetchTechStocksRequireAll,
} from "../services/newsProviders";

// News mentioning META, AMZN, or NFLX
const techNews = await fetchMultipleTechStocks(20);

// News mentioning ALL three stocks in the same article
const allThreeNews = await fetchTechStocksRequireAll(20);
```

### Filtered News

```typescript
import {
  fetchNegativeAmazonNews,
  fetchVideoNewsOnTesla,
  fetchPressReleasesOnly,
} from "../services/newsProviders";

// Only negative sentiment news about Amazon
const negativeNews = await fetchNegativeAmazonNews(20);

// Only video content about Tesla
const videoNews = await fetchVideoNewsOnTesla(20);

// Only press releases
const pressReleases = await fetchPressReleasesOnly(20);
```

### Sector and Market News

```typescript
import {
  fetchTechnologySectorNews,
  fetchGeneralMarketNews,
} from "../services/newsProviders";

// Technology sector news
const techSectorNews = await fetchTechnologySectorNews(20);

// General market news
const marketNews = await fetchGeneralMarketNews(20);
```

### Advanced Features

```typescript
import {
  fetchTrendingStocks,
  fetchMarketEvents,
  type TrendingStock,
  type MarketEvent,
} from "../services/newsProviders";

// Most mentioned stocks in the last 7 days
const trending: TrendingStock[] = await fetchTrendingStocks(7);

// Important market events
const events: MarketEvent[] = await fetchMarketEvents();
```

## Data Types

### NewsItem

```typescript
export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
  symbol?: string;
  sentiment?: "Positive" | "Negative" | "Neutral";
  type?: "Article" | "Video" | "PressRelease";
  imageUrl?: string;
  topics?: string[];
  tickers?: string[];
};
```

### TrendingStock

```typescript
export interface TrendingStock {
  ticker: string;
  company_name?: string;
  mentions: number;
  sentiment: "Positive" | "Negative" | "Neutral";
  sentiment_score?: number;
}
```

### MarketEvent

```typescript
export interface MarketEvent {
  event_id: string;
  title: string;
  description: string;
  date: string;
  impact: "High" | "Medium" | "Low";
  tickers?: string[];
}
```

## Advanced Usage

### Custom Filtering

```typescript
import { fetchStockNewsApi } from "../services/newsProviders";

// Custom options for advanced filtering
const customNews = await fetchStockNewsApi("AAPL", 20, {
  sentiment: "Positive",
  type: "Article",
  excludeSources: ["source1", "source2"],
  dateFrom: "2025-01-01",
  dateTo: "2025-01-31",
});
```

### Multiple Tickers with Custom Logic

```typescript
import { fetchMultipleTickersNews } from "../services/newsProviders";

// News mentioning any of these tickers
const anyTickerNews = await fetchMultipleTickersNews(
  ["AAPL", "GOOGL", "MSFT"],
  20,
  false
);

// News mentioning ALL of these tickers
const allTickersNews = await fetchMultipleTickersNews(
  ["AAPL", "GOOGL", "MSFT"],
  20,
  true
);
```

## UI Components

### Enhanced NewsList Component

The `NewsList` component has been enhanced to display:

- **Sentiment badges** with color coding
- **Content type indicators** (Video, Press Release)
- **News images** when available
- **Ticker badges** showing related stocks
- **Improved styling** for better readability

```typescript
import NewsList from "../components/insights/NewsList";
import { fetchTeslaNews } from "../services/newsProviders";

function MyNewsScreen() {
  const [news, setNews] = useState([]);

  useEffect(() => {
    fetchTeslaNews(10).then(setNews);
  }, []);

  return <NewsList items={news} />;
}
```

### Demo Screen

A comprehensive demo screen is available at `src/screens/StockNewsApiDemoScreen.tsx` that showcases all features:

- All example endpoints from stocknewsapi.com
- Interactive buttons to switch between different data types
- Real-time loading states and error handling
- Trending stocks visualization
- Market events display

## API Examples Implemented

Based on [stocknewsapi.com/examples](https://stocknewsapi.com/examples), the following examples are implemented:

1. **Single Ticker - No Filters**: `fetchTeslaNews()`
2. **All Tickers - No Filters**: `fetchGeneralMarketNews()`
3. **Press Releases Only**: `fetchPressReleasesOnly()`
4. **News on META, AMZN and NFLX**: `fetchMultipleTechStocks()`
5. **News on "META" AND "AMZN" AND "NFLX"**: `fetchTechStocksRequireAll()`
6. **News only on AMZN**: `fetchOnlyAmazonNews()`
7. **All Tickers - Specific Sector**: `fetchTechnologySectorNews()`
8. **General Market News**: `fetchGeneralMarketNews()`
9. **Negative news about Amazon**: `fetchNegativeAmazonNews()`
10. **Only video news on Tesla**: `fetchVideoNewsOnTesla()`
11. **Most mentioned last 7 days**: `fetchTrendingStocks()`
12. **Latest News Events**: `fetchMarketEvents()`

## Error Handling

The integration includes comprehensive error handling:

```typescript
try {
  const news = await fetchTeslaNews(5);
  setNewsData(news);
} catch (error) {
  console.error("Failed to fetch news:", error);
  // Fallback to other news providers or show error message
}
```

## Caching

News data is automatically cached for 2 minutes to avoid repeated API calls and improve performance.

## Fallback Strategy

If Stock News API fails or returns no data, the system automatically falls back to:

1. GNews API (if configured)
2. Yahoo Finance RSS feeds
3. NewsAPI.org (if configured)

This ensures your app always has news content available.

## Best Practices

1. **Use specific functions** for common use cases rather than the generic `fetchNews()`
2. **Handle loading states** in your UI components
3. **Implement error boundaries** for graceful error handling
4. **Cache results** when appropriate to reduce API calls
5. **Respect rate limits** by not making too many concurrent requests

## Testing

To test the integration:

1. Set your API key in the `.env` file
2. Navigate to the demo screen: `StockNewsApiDemoScreen`
3. Try different endpoints using the interactive buttons
4. Check the console for any error messages

## Support

For issues with the Stock News API:

- Check the [official documentation](https://stocknewsapi.com/documentation)
- Verify your API key is valid and has sufficient quota
- Check the [examples page](https://stocknewsapi.com/examples) for reference

For integration issues:

- Check the console for error messages
- Verify your environment variables are set correctly
- Ensure you have a stable internet connection
