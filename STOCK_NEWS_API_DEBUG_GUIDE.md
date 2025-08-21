# Stock News API Debug Guide

## 🚨 Current Issue: HTTP 403 Error

You're getting a **403 Forbidden** error when trying to access the Stock News API. Here's how to debug and fix it:

## 🔧 Step 1: Test Your API Key

1. **Navigate to the Stock News API Demo screen**:

   - Go to Profile → "Stock News API Demo"
   - You'll see red debug buttons at the top

2. **Click "🧪 Test API Key"** and check the console logs:

   - Look for: `🔑 Stock News API Key: xxxxxxxx...`
   - If it shows "NOT SET", your API key isn't configured properly

3. **Check the console output** for:
   - The actual URL being called (with API key masked)
   - Response status and error details

## 🔧 Step 2: Verify Your API Key

### Check Your .env File

Make sure your `.env` file contains:

```bash
STOCK_NEWS_API_KEY=uc6ic8zp9crgiq9r3g9f1b0wjnkjaqfyjnzbmfuu
```

### Restart Your Development Server

After adding/changing the API key:

```bash
# Stop your current server (Ctrl+C)
# Then restart
npm start
# or
yarn start
# or
expo start
```

## 🔧 Step 3: Test Different Endpoints

Click the **"🔍 Test All Endpoints"** button to see which endpoints work:

1. **Single Ticker (AAPL)** - Tests individual stock news
2. **General Market News** - Tests market-wide news
3. **All Tickers** - Tests the general category endpoint

## 🔧 Step 4: Common 403 Error Causes

### 1. **Invalid API Key**

- Double-check the API key in your .env file
- Make sure there are no extra spaces or characters
- Verify the key is exactly: `uc6ic8zp9crgiq9r3g9f1b0wjnkjaqfyjnzbmfuu`

### 2. **API Key Permissions**

- Some API keys have limited endpoint access
- Try the basic endpoint first: `/api/v1?tickers=AAPL&items=1`

### 3. **Rate Limiting**

- You might have exceeded the rate limit
- Wait a few minutes and try again
- Check if your plan has rate limits

### 4. **Account Issues**

- API key might be expired or suspended
- Check your Stock News API account status
- Verify your subscription is active

## 🔧 Step 5: Manual Testing

You can also test the API directly in your browser or with curl:

```bash
# Replace YOUR_API_KEY with your actual key
curl "https://stocknewsapi.com/api/v1?tickers=AAPL&items=1&token=YOUR_API_KEY"
```

Expected response:

```json
{
  "data": [
    {
      "news_url": "...",
      "title": "...",
      "text": "...",
      "source_name": "...",
      "date": "...",
      "sentiment": "...",
      "type": "..."
    }
  ]
}
```

## 🔧 Step 6: Fallback Strategy

The app is designed to fallback to other news providers if Stock News API fails:

1. **Stock News API** (Primary) - Enhanced features
2. **GNews API** (Fallback 1) - If configured
3. **Yahoo Finance RSS** (Fallback 2) - Always available
4. **NewsAPI.org** (Fallback 3) - If configured

So even if Stock News API doesn't work, you should still see news content.

## 🔧 Step 7: Debug Console Commands

Add these to your debug console to test manually:

```javascript
// Test the API key configuration
import Constants from "expo-constants";
const apiKey = Constants.expoConfig?.extra?.stockNewsApiKey;
console.log("API Key:", apiKey ? `${apiKey.substring(0, 8)}...` : "NOT SET");

// Test a simple fetch
fetch("https://stocknewsapi.com/api/v1?tickers=AAPL&items=1&token=" + apiKey)
  .then((r) => r.json())
  .then((data) => console.log("Success:", data))
  .catch((err) => console.error("Error:", err));
```

## 🔧 Step 8: Alternative API Keys

If the provided API key doesn't work, you can:

1. **Get your own free API key** from [stocknewsapi.com](https://stocknewsapi.com)
2. **Update your .env file** with the new key
3. **Restart your development server**

## 📊 Expected Debug Output

When working correctly, you should see:

```
🔑 Stock News API Key: uc6ic8zp...
📡 Stock News API URL: https://stocknewsapi.com/api/v1?tickers=AAPL&items=1&token=***
✅ Stock News API Response: 1 items
```

When failing, you'll see:

```
🔑 Stock News API Key: uc6ic8zp...
📡 Stock News API URL: https://stocknewsapi.com/api/v1?tickers=AAPL&items=1&token=***
❌ Stock News API Error: [Error: HTTP 403]
📡 Failed URL: https://stocknewsapi.com/api/v1?tickers=AAPL&items=1&token=***
```

## 🎯 Next Steps

1. **Use the debug buttons** in the demo screen
2. **Check the console logs** for detailed error information
3. **Verify your API key** is correctly set in .env
4. **Restart your development server** after any changes
5. **Test with a different API key** if needed

The enhanced logging will show you exactly what's happening with each API call, making it easier to identify and fix the issue.

## 🔄 Fallback Behavior

Even if Stock News API fails, your app will still work because:

- Individual ticker news will fallback to other providers
- Market news will fallback to other providers
- Users will still see news content, just without the enhanced features (sentiment, images, etc.)

This ensures a good user experience regardless of API issues.
