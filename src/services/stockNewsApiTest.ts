import Constants from "expo-constants";

/**
 * Test function to debug Stock News API issues
 * Call this from your demo screen or console to test the API
 */
export async function testStockNewsApi() {
  console.log("🧪 Testing Stock News API...");

  // Check API key
  const apiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;
  console.log(
    "🔑 API Key:",
    apiKey ? `${apiKey.substring(0, 8)}...` : "NOT SET"
  );

  if (!apiKey) {
    console.error(
      "❌ No API key found! Check your .env file and app.config.ts"
    );
    return;
  }

  // Test basic endpoint
  const testUrl = `https://stocknewsapi.com/api/v1?tickers=AAPL&items=1&token=${apiKey}`;
  console.log("📡 Test URL:", testUrl.replace(apiKey, "***"));

  try {
    const response = await fetch(testUrl);
    console.log("📊 Response Status:", response.status);
    console.log(
      "📊 Response Headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error Response:", errorText);

      if (response.status === 403) {
        console.error("🚫 403 Forbidden - Possible causes:");
        console.error("   1. Invalid API key");
        console.error(
          "   2. API key doesn't have permission for this endpoint"
        );
        console.error("   3. Rate limit exceeded");
        console.error("   4. Account suspended or expired");
      }
      return;
    }

    const data = await response.json();
    console.log("✅ Success! Response:", data);
    console.log("📰 News items:", data?.data?.length || 0);

    if (data?.data?.[0]) {
      console.log("📄 First article:", {
        title: data.data[0].title,
        source: data.data[0].source_name,
        sentiment: data.data[0].sentiment,
        type: data.data[0].type,
      });
    }
  } catch (error) {
    console.error("❌ Network Error:", error);
  }
}

/**
 * Test market news endpoint specifically
 */
export async function testMarketNewsApi() {
  console.log("🌍 Testing Market News API...");

  const apiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;
  if (!apiKey) {
    console.error("❌ No API key found!");
    return;
  }

  // Test market news endpoint
  const testUrl = `https://stocknewsapi.com/api/v1/category?section=general&items=1&token=${apiKey}`;
  console.log("📡 Market Test URL:", testUrl.replace(apiKey, "***"));

  try {
    const response = await fetch(testUrl);
    console.log("📊 Market Response Status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Market Error Response:", errorText);
      return;
    }

    const data = await response.json();
    console.log("✅ Market Success! Response:", data);
    console.log("📰 Market news items:", data?.data?.length || 0);
  } catch (error) {
    console.error("❌ Market Network Error:", error);
  }
}

/**
 * Test different endpoints to see which ones work
 */
export async function testAllEndpoints() {
  console.log("🔍 Testing all Stock News API endpoints...");

  const apiKey = (Constants.expoConfig?.extra as any)?.stockNewsApiKey;
  if (!apiKey) {
    console.error("❌ No API key found!");
    return;
  }

  const endpoints = [
    {
      name: "Single Ticker (AAPL)",
      url: `https://stocknewsapi.com/api/v1?tickers=AAPL&items=1&token=${apiKey}`,
    },
    {
      name: "General Market News",
      url: `https://stocknewsapi.com/api/v1/category?section=general&items=1&token=${apiKey}`,
    },
    {
      name: "All Tickers",
      url: `https://stocknewsapi.com/api/v1/category?section=alltickers&items=1&token=${apiKey}`,
    },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n🧪 Testing: ${endpoint.name}`);
    console.log(`📡 URL: ${endpoint.url.replace(apiKey, "***")}`);

    try {
      const response = await fetch(endpoint.url);
      console.log(`📊 Status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Success: ${data?.data?.length || 0} items`);
      } else {
        const errorText = await response.text();
        console.log(`❌ Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`❌ Network Error: ${error}`);
    }
  }
}
