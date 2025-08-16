import { brokerageAuthService, BrokerageProvider } from "./brokerageAuth";
import { Candle, NewsItem } from "./marketProviders";

export interface BrokerageQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  timestamp: number;
}

export interface BrokeragePosition {
  symbol: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface BrokerageWatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

class BrokerageApiService {
  private requestQueue: Map<string, Promise<any>> = new Map();
  private rateLimiter: Map<
    BrokerageProvider,
    { requests: number; resetTime: number }
  > = new Map();
  private readonly MAX_REQUESTS_PER_MINUTE = 20; // Conservative rate limit

  // Rate limiting check
  private async checkRateLimit(provider: BrokerageProvider): Promise<void> {
    const now = Date.now();
    const limiter = this.rateLimiter.get(provider);

    if (!limiter || now > limiter.resetTime) {
      // Reset or initialize rate limiter
      this.rateLimiter.set(provider, { requests: 0, resetTime: now + 60000 }); // 1 minute
      return;
    }

    if (limiter.requests >= this.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = limiter.resetTime - now;
      console.log(`Rate limit reached for ${provider}, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      // Reset after waiting
      this.rateLimiter.set(provider, {
        requests: 0,
        resetTime: Date.now() + 60000,
      });
    }

    // Increment request count
    limiter.requests++;
  }

  // Generic authenticated request method
  private async makeAuthenticatedRequest(
    provider: BrokerageProvider,
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Check rate limiting
    await this.checkRateLimit(provider);

    const session = brokerageAuthService.getSession(provider);
    if (!session) {
      throw new Error(`No active session for ${provider}`);
    }

    // Debug: Log session details
    console.log(`Making authenticated request for ${provider}:`, {
      url,
      hasCookies: !!session.cookies,
      cookiesLength: session.cookies?.length || 0,
      tokenCount: Object.keys(session.tokens).length,
      tokenKeys: Object.keys(session.tokens),
    });

    // Validate and refresh session if needed
    const isValid = await brokerageAuthService.validateAndRefreshSession(
      provider
    );
    if (!isValid) {
      throw new Error(`Invalid or expired session for ${provider}`);
    }

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9,es;q=0.8,mt;q=0.7",
      Cookie: session.cookies,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
    };

    // Add provider-specific base headers
    if (provider === "robinhood") {
      headers.Origin = "https://robinhood.com";
      headers.Referer = "https://robinhood.com/";
    }

    // Merge additional headers if provided
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    // Add provider-specific headers
    this.addProviderHeaders(provider, headers, session.tokens);

    // Debug: Log headers being sent (excluding sensitive data)
    console.log(`Request headers for ${provider}:`, {
      ...headers,
      Cookie: headers.Cookie ? `[${headers.Cookie.length} chars]` : "none",
      Authorization: headers.Authorization
        ? `[${headers.Authorization.substring(0, 20)}...]`
        : "none",
    });

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      console.error(`API request failed for ${provider}:`, {
        url,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return response;
  }

  // Add provider-specific authentication headers
  private addProviderHeaders(
    provider: BrokerageProvider,
    headers: Record<string, string>,
    tokens: Record<string, string>
  ) {
    switch (provider) {
      case "robinhood":
        // Use the JWT token from cookies if available
        if (tokens["__Host-Web-App-Secondary-Access-Token"]) {
          headers[
            "Authorization"
          ] = `Bearer ${tokens["__Host-Web-App-Secondary-Access-Token"]}`;
        } else if (tokens.access_token) {
          headers["Authorization"] = `Bearer ${tokens.access_token}`;
        } else if (tokens.authToken) {
          headers["Authorization"] = `Token ${tokens.authToken}`;
        }

        // Match the exact headers from the network call
        headers["X-Robinhood-API-Version"] = "1.431.4";
        headers["X-Hyper-Ex"] = "enabled";
        headers["X-Timezone-Id"] = "America/Los_Angeles";
        headers["Priority"] = "u=1, i";

        // Add device ID if available
        if (tokens.device_id) {
          headers["X-Device-ID"] = tokens.device_id;
        }
        break;
      case "webull":
        if (tokens.accessToken) {
          headers["Authorization"] = `Bearer ${tokens.accessToken}`;
        }
        if (tokens.deviceId) {
          headers["deviceid"] = tokens.deviceId;
        }
        break;
    }
  }

  // Get quote for a symbol
  async getQuote(
    symbol: string,
    provider: BrokerageProvider
  ): Promise<BrokerageQuote> {
    const cacheKey = `quote_${provider}_${symbol}`;

    // Check if request is already in flight
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey);
    }

    const promise = this._getQuote(symbol, provider);
    this.requestQueue.set(cacheKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  private async _getQuote(
    symbol: string,
    provider: BrokerageProvider
  ): Promise<BrokerageQuote> {
    const url = this.getQuoteUrl(provider, symbol);
    const response = await this.makeAuthenticatedRequest(provider, url);
    const data = await response.json();

    return this.parseQuoteResponse(provider, data, symbol);
  }

  // Get candle data
  async getCandles(
    symbol: string,
    provider: BrokerageProvider,
    timeframe: string = "1D",
    limit: number = 100
  ): Promise<Candle[]> {
    const url = this.getCandlesUrl(provider, symbol, timeframe, limit);
    const response = await this.makeAuthenticatedRequest(provider, url);
    const data = await response.json();

    return this.parseCandlesResponse(provider, data);
  }

  // Get news for a symbol
  async getNews(
    symbol: string,
    provider: BrokerageProvider
  ): Promise<NewsItem[]> {
    const url = this.getNewsUrl(provider, symbol);
    const response = await this.makeAuthenticatedRequest(provider, url);
    const data = await response.json();

    return this.parseNewsResponse(provider, data);
  }

  // Get user's positions
  async getPositions(
    provider: BrokerageProvider
  ): Promise<BrokeragePosition[]> {
    const url = this.getPositionsUrl(provider);
    const response = await this.makeAuthenticatedRequest(provider, url);
    const data = await response.json();

    return this.parsePositionsResponse(provider, data);
  }

  // Get user's watchlist
  async getWatchlist(
    provider: BrokerageProvider
  ): Promise<BrokerageWatchlistItem[]> {
    const cacheKey = `watchlist_${provider}`;

    // Check if request is already in flight
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey);
    }

    const promise = this._getWatchlist(provider);
    this.requestQueue.set(cacheKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  private async _getWatchlist(
    provider: BrokerageProvider
  ): Promise<BrokerageWatchlistItem[]> {
    const url = this.getWatchlistUrl(provider);
    const response = await this.makeAuthenticatedRequest(provider, url);
    const data = await response.json();

    return this.parseWatchlistResponse(provider, data);
  }

  // Add stock to watchlist
  async addToWatchlist(
    symbol: string,
    provider: BrokerageProvider
  ): Promise<boolean> {
    try {
      const url = this.getAddToWatchlistUrl(provider, symbol);
      const response = await this.makeAuthenticatedRequest(provider, url, {
        method: "POST",
        body: JSON.stringify(this.getAddToWatchlistBody(provider, symbol)),
      });

      return response.ok;
    } catch (error) {
      console.error(`Failed to add ${symbol} to ${provider} watchlist:`, error);
      return false;
    }
  }

  // Remove stock from watchlist
  async removeFromWatchlist(
    symbol: string,
    provider: BrokerageProvider
  ): Promise<boolean> {
    try {
      const url = this.getRemoveFromWatchlistUrl(provider, symbol);
      const response = await this.makeAuthenticatedRequest(provider, url, {
        method: "DELETE",
      });

      return response.ok;
    } catch (error) {
      console.error(
        `Failed to remove ${symbol} from ${provider} watchlist:`,
        error
      );
      return false;
    }
  }

  // Provider-specific URL builders
  private getQuoteUrl(provider: BrokerageProvider, symbol: string): string {
    switch (provider) {
      case "robinhood":
        return `https://api.robinhood.com/quotes/?symbols=${symbol}`;
      case "webull":
        return `https://quotes-gw.webullfintech.com/api/stock/tickerRealTime/getQuote?tickerId=${symbol}`;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getCandlesUrl(
    provider: BrokerageProvider,
    symbol: string,
    timeframe: string,
    limit: number
  ): string {
    switch (provider) {
      case "robinhood":
        return `https://api.robinhood.com/marketdata/historicals/${symbol}/?interval=${timeframe}&bounds=regular&span=week`;
      case "webull":
        return `https://quotes-gw.webullfintech.com/api/stock/capitalflow/ticker?tickerId=${symbol}&type=1&count=${limit}`;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getNewsUrl(provider: BrokerageProvider, symbol: string): string {
    switch (provider) {
      case "robinhood":
        return `https://api.robinhood.com/midlands/news/${symbol}/`;
      case "webull":
        return `https://infoapi.webullfintech.com/api/information/news/query?tickerId=${symbol}&pageSize=20`;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getPositionsUrl(provider: BrokerageProvider): string {
    switch (provider) {
      case "robinhood":
        return "https://api.robinhood.com/positions/?nonzero=true";
      case "webull":
        return "https://trade-gw.webullfintech.com/api/trade/account/getPositions";
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getWatchlistUrl(provider: BrokerageProvider): string {
    switch (provider) {
      case "robinhood":
        return "https://api.robinhood.com/watchlists/Default/";
      case "webull":
        return "https://userapi.webullfintech.com/api/user/watchlist/query";
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getAddToWatchlistUrl(
    provider: BrokerageProvider,
    symbol: string
  ): string {
    switch (provider) {
      case "robinhood":
        return "https://api.robinhood.com/watchlists/Default/";
      case "webull":
        return "https://userapi.webullfintech.com/api/user/watchlist/add";
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getRemoveFromWatchlistUrl(
    provider: BrokerageProvider,
    symbol: string
  ): string {
    switch (provider) {
      case "robinhood":
        return `https://api.robinhood.com/watchlists/Default/${symbol}/`;
      case "webull":
        return `https://userapi.webullfintech.com/api/user/watchlist/remove/${symbol}`;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getAddToWatchlistBody(
    provider: BrokerageProvider,
    symbol: string
  ): any {
    switch (provider) {
      case "robinhood":
        return {
          instrument: `https://api.robinhood.com/instruments/?symbol=${symbol}`,
        };
      case "webull":
        return { symbol };
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  // Response parsers
  private parseQuoteResponse(
    provider: BrokerageProvider,
    data: any,
    symbol: string
  ): BrokerageQuote {
    switch (provider) {
      case "robinhood":
        const rhQuote = data.results?.[0] || data;
        return {
          symbol,
          price: parseFloat(rhQuote.last_trade_price),
          change:
            parseFloat(rhQuote.last_trade_price) -
            parseFloat(rhQuote.previous_close),
          changePercent:
            ((parseFloat(rhQuote.last_trade_price) -
              parseFloat(rhQuote.previous_close)) /
              parseFloat(rhQuote.previous_close)) *
            100,
          volume: parseFloat(rhQuote.volume),
          high: parseFloat(rhQuote.high),
          low: parseFloat(rhQuote.low),
          open: parseFloat(rhQuote.open),
          previousClose: parseFloat(rhQuote.previous_close),
          timestamp: Date.now(),
        };
      case "webull":
        const wbQuote = data.data || data;
        return {
          symbol,
          price: wbQuote.close,
          change: wbQuote.change,
          changePercent: wbQuote.changeRatio * 100,
          volume: wbQuote.volume,
          high: wbQuote.high,
          low: wbQuote.low,
          open: wbQuote.open,
          previousClose: wbQuote.pClose,
          timestamp: Date.now(),
        };
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private parseCandlesResponse(
    provider: BrokerageProvider,
    data: any
  ): Candle[] {
    switch (provider) {
      case "robinhood":
        const rhResults = data.results || [];
        return rhResults.map((item: any) => ({
          time: new Date(item.begins_at).getTime(),
          open: parseFloat(item.open_price),
          high: parseFloat(item.high_price),
          low: parseFloat(item.low_price),
          close: parseFloat(item.close_price),
          volume: parseFloat(item.volume),
        }));
      case "webull":
        const wbData = data.data || [];
        return wbData.map((item: any) => ({
          time: item.timestamp * 1000,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume,
        }));
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private parseNewsResponse(
    provider: BrokerageProvider,
    data: any
  ): NewsItem[] {
    switch (provider) {
      case "robinhood":
        const rhNews = data.results || [];
        return rhNews.map((item: any, index: number) => ({
          id: item.uuid || `rh-${index}`,
          title: item.title,
          url: item.url,
          source: item.source,
          publishedAt: item.published_at,
          summary: item.summary,
        }));
      case "webull":
        const wbNews = data.data || [];
        return wbNews.map((item: any, index: number) => ({
          id: item.newsId || `wb-${index}`,
          title: item.title,
          url: item.sourceUrl,
          source: item.sourceName,
          publishedAt: new Date(item.publishTime).toISOString(),
          summary: item.summary,
        }));
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private parsePositionsResponse(
    provider: BrokerageProvider,
    data: any
  ): BrokeragePosition[] {
    switch (provider) {
      case "robinhood":
        const rhPositions = data.results || data || [];
        return rhPositions
          .filter((pos: any) => parseFloat(pos.quantity) > 0)
          .map((pos: any) => ({
            symbol:
              pos.symbol || pos.instrument?.symbol || pos?.symbol_id || "",
            quantity: parseFloat(pos.quantity),
            averageCost: parseFloat(
              pos.average_buy_price || pos.average_price || pos.cost_basis || 0
            ),
            currentPrice: parseFloat(
              pos.last_trade_price || pos.mark_price || pos.price || 0
            ),
            marketValue:
              parseFloat(pos.quantity) *
              parseFloat(
                pos.last_trade_price || pos.mark_price || pos.price || 0
              ),
            unrealizedPnL: parseFloat(
              pos.total_return_today || pos.unrealized_pl || 0
            ),
            unrealizedPnLPercent:
              parseFloat(
                pos.total_return_today_percent || pos.unrealized_plpc || 0
              ) * (pos.unrealized_plpc ? 100 : 1),
          }));
      case "webull":
        const wbPositions = data.data || [];
        return wbPositions.map((pos: any) => ({
          symbol: pos.ticker.symbol,
          quantity: pos.position,
          averageCost: pos.cost,
          currentPrice: pos.marketValue / pos.position,
          marketValue: pos.marketValue,
          unrealizedPnL: pos.unrealizedProfitLoss,
          unrealizedPnLPercent: pos.unrealizedProfitLossRate * 100,
        }));
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private parseWatchlistResponse(
    provider: BrokerageProvider,
    data: any
  ): BrokerageWatchlistItem[] {
    switch (provider) {
      case "robinhood":
        const rhWatchlists = data.results || data || [];
        const items: BrokerageWatchlistItem[] = [];
        (Array.isArray(rhWatchlists) ? rhWatchlists : [rhWatchlists]).forEach(
          (watchlist: any) => {
            (watchlist.results || watchlist || []).forEach((item: any) => {
              items.push({
                symbol: item.symbol,
                name: item.simple_name || item.symbol,
                price: parseFloat(item.last_trade_price),
                change:
                  parseFloat(item.last_trade_price) -
                  parseFloat(item.previous_close),
                changePercent:
                  ((parseFloat(item.last_trade_price) -
                    parseFloat(item.previous_close)) /
                    parseFloat(item.previous_close)) *
                  100,
              });
            });
          }
        );
        return items;
      case "webull":
        const wbItems = data.data || [];
        return wbItems.map((item: any) => ({
          symbol: item.symbol,
          name: item.name,
          price: item.close,
          change: item.change,
          changePercent: item.changeRatio * 100,
        }));
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  // Health check - verify session is working
  async checkConnection(provider: BrokerageProvider): Promise<boolean> {
    try {
      console.log(`Checking connection for ${provider}...`);

      // Try to fetch a simple endpoint to verify connection
      const url =
        provider === "robinhood"
          ? "https://api.robinhood.com/user/" // Corrected back to original endpoint
          : "https://userapi.webullfintech.com/api/user";

      console.log(`Making request to: ${url}`);
      const response = await this.makeAuthenticatedRequest(provider, url);

      console.log(`Connection check response for ${provider}:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      return response.ok;
    } catch (error) {
      console.error(`Connection check failed for ${provider}:`, error);

      // If the primary endpoint fails, try alternative endpoints
      if (provider === "robinhood") {
        try {
          console.log("Trying alternative Robinhood endpoint...");
          const altUrl = "https://api.robinhood.com/accounts/";
          const altResponse = await this.makeAuthenticatedRequest(
            provider,
            altUrl
          );
          console.log(`Alternative endpoint response:`, {
            status: altResponse.status,
            ok: altResponse.ok,
          });
          return altResponse.ok;
        } catch (altError) {
          console.error("Alternative endpoint also failed:", altError);
        }
      }

      return false;
    }
  }

  // Debug method to test data fetching
  async debugDataFetching(provider: BrokerageProvider): Promise<any> {
    const results = {
      provider,
      connectionTest: false,
      positionsTest: { success: false, count: 0, error: null as string | null },
      watchlistTest: { success: false, count: 0, error: null as string | null },
      newsTest: { success: false, count: 0, error: null as string | null },
    };

    try {
      // Test connection
      results.connectionTest = await this.checkConnection(provider);

      if (results.connectionTest) {
        // Test positions
        try {
          const positions = await this.getPositions(provider);
          results.positionsTest = {
            success: true,
            count: positions.length,
            error: null,
          };
        } catch (error) {
          results.positionsTest.error =
            error instanceof Error ? error.message : String(error);
        }

        // Test watchlist
        try {
          const watchlist = await this.getWatchlist(provider);
          results.watchlistTest = {
            success: true,
            count: watchlist.length,
            error: null,
          };
        } catch (error) {
          results.watchlistTest.error =
            error instanceof Error ? error.message : String(error);
        }

        // Test news (with a sample symbol)
        try {
          const news = await this.getNews("AAPL", provider);
          results.newsTest = { success: true, count: news.length, error: null };
        } catch (error) {
          results.newsTest.error =
            error instanceof Error ? error.message : String(error);
        }
      }
    } catch (error) {
      console.error(`Debug data fetching failed for ${provider}:`, error);
    }

    console.log(`Debug data fetching results for ${provider}:`, results);
    return results;
  }
}

export const brokerageApiService = new BrokerageApiService();
