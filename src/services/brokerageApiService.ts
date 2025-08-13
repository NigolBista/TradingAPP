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

  // Generic authenticated request method
  private async makeAuthenticatedRequest(
    provider: BrokerageProvider,
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const session = brokerageAuthService.getSession(provider);
    if (!session) {
      throw new Error(`No active session for ${provider}`);
    }

    // Validate and refresh session if needed
    const isValid = await brokerageAuthService.validateAndRefreshSession(
      provider
    );
    if (!isValid) {
      throw new Error(`Invalid or expired session for ${provider}`);
    }

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: session.cookies,
    };

    // Merge additional headers if provided
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    // Add provider-specific headers
    this.addProviderHeaders(provider, headers, session.tokens);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
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
        if (tokens.authToken) {
          headers["Authorization"] = `Token ${tokens.authToken}`;
        }
        headers["X-Robinhood-API-Version"] = "1.315.0";
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
    const url = this.getWatchlistUrl(provider);
    const response = await this.makeAuthenticatedRequest(provider, url);
    const data = await response.json();

    return this.parseWatchlistResponse(provider, data);
  }

  // Provider-specific URL builders
  private getQuoteUrl(provider: BrokerageProvider, symbol: string): string {
    switch (provider) {
      case "robinhood":
        return `https://robinhood.com/api/quotes/?symbols=${symbol}`;
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
        return `https://robinhood.com/api/marketdata/historicals/${symbol}/?interval=${timeframe}&bounds=regular&span=week`;
      case "webull":
        return `https://quotes-gw.webullfintech.com/api/stock/capitalflow/ticker?tickerId=${symbol}&type=1&count=${limit}`;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getNewsUrl(provider: BrokerageProvider, symbol: string): string {
    switch (provider) {
      case "robinhood":
        return `https://robinhood.com/api/midlands/news/${symbol}/`;
      case "webull":
        return `https://infoapi.webullfintech.com/api/information/news/query?tickerId=${symbol}&pageSize=20`;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getPositionsUrl(provider: BrokerageProvider): string {
    switch (provider) {
      case "robinhood":
        return "https://robinhood.com/api/positions/";
      case "webull":
        return "https://trade-gw.webullfintech.com/api/trade/account/getPositions";
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private getWatchlistUrl(provider: BrokerageProvider): string {
    switch (provider) {
      case "robinhood":
        return "https://robinhood.com/api/watchlists/";
      case "webull":
        return "https://userapi.webullfintech.com/api/user/watchlist/query";
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
        const rhPositions = data.results || [];
        return rhPositions
          .filter((pos: any) => parseFloat(pos.quantity) > 0)
          .map((pos: any) => ({
            symbol: pos.symbol,
            quantity: parseFloat(pos.quantity),
            averageCost: parseFloat(pos.average_buy_price),
            currentPrice: parseFloat(pos.last_trade_price),
            marketValue:
              parseFloat(pos.quantity) * parseFloat(pos.last_trade_price),
            unrealizedPnL: parseFloat(pos.total_return_today),
            unrealizedPnLPercent: parseFloat(pos.total_return_today_percent),
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
        const rhWatchlists = data.results || [];
        const items: BrokerageWatchlistItem[] = [];
        rhWatchlists.forEach((watchlist: any) => {
          watchlist.results?.forEach((item: any) => {
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
        });
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
      // Try to fetch a simple endpoint to verify connection
      const url =
        provider === "robinhood"
          ? "https://robinhood.com/api/user/"
          : "https://userapi.webullfintech.com/api/user";

      const response = await this.makeAuthenticatedRequest(provider, url);
      return response.ok;
    } catch (error) {
      console.error(`Connection check failed for ${provider}:`, error);
      return false;
    }
  }
}

export const brokerageApiService = new BrokerageApiService();
