import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Import mock data
import mockAccountsData from "../data/mockPlaidAccounts.json";
import mockHoldingsData from "../data/mockPlaidHoldings.json";

const { plaidClientId, plaidSecret, plaidEnvironment } = Constants.expoConfig
  ?.extra as any;

// Mock mode flag - set to true to use mock data instead of real API calls
const USE_MOCK_DATA = true;

// Plaid Integration Service
// This shows how to integrate with Plaid for real brokerage connections

export interface PlaidAccount {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    iso_currency_code: string;
    limit: number | null;
    unofficial_currency_code: string | null;
  };
  mask: string;
  name: string;
  official_name: string;
  subtype: string;
  type: string;
}

export interface PlaidHolding {
  account_id: string;
  security_id: string;
  institution_price: number;
  institution_price_as_of: string;
  institution_value: number;
  iso_currency_code: string;
  quantity: number;
  unofficial_currency_code: string | null;
  cost_basis: number | null;
}

export interface PlaidSecurity {
  security_id: string;
  isin: string | null;
  cusip: string | null;
  sedol: string | null;
  institution_security_id: string | null;
  institution_id: string | null;
  proxy_security_id: string | null;
  name: string;
  ticker_symbol: string;
  is_cash_equivalent: boolean;
  type: string;
  close_price: number | null;
  close_price_as_of: string | null;
  iso_currency_code: string;
  unofficial_currency_code: string | null;
}

class PlaidIntegrationService {
  private readonly STORAGE_KEY = "plaid_access_tokens";
  private accessTokens: Map<string, string> = new Map();

  constructor() {
    this.loadTokens();
  }

  // Load stored access tokens
  private async loadTokens() {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const tokens = JSON.parse(stored);
        this.accessTokens = new Map(Object.entries(tokens));
      }
    } catch (error) {
      console.error("Failed to load Plaid tokens:", error);
    }
  }

  // Save access tokens
  private async saveTokens() {
    try {
      const tokens = Object.fromEntries(this.accessTokens);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.error("Failed to save Plaid tokens:", error);
    }
  }

  // Create link token for Plaid Link initialization
  async createLinkToken(): Promise<string> {
    if (USE_MOCK_DATA) {
      // Return a mock link token
      console.log("🔧 Using mock link token");
      return (
        "link-sandbox-mock-token-" + Math.random().toString(36).substring(7)
      );
    }

    // Debug: Check if credentials are loaded
    console.log("Creating link token with credentials:", {
      clientId: plaidClientId?.substring(0, 8) + "...",
      secret: plaidSecret?.substring(0, 8) + "...",
      environment: plaidEnvironment,
    });

    const response = await fetch(
      `https://${plaidEnvironment}.plaid.com/link/token/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: plaidClientId,
          secret: plaidSecret,
          client_name: "TradingApp Trading App",
          country_codes: ["US"],
          language: "en",
          user: {
            client_user_id: "user_" + Math.random().toString(36).substring(7),
          },
          products: ["investments"],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Plaid link token creation failed: ${data.error_message}`
      );
    }

    return data.link_token;
  }

  // Exchange public token for access token
  async exchangePublicToken(publicToken: string): Promise<string> {
    if (USE_MOCK_DATA) {
      // Return a mock access token and store it
      console.log("🔧 Using mock access token exchange");
      const mockAccessToken =
        "access-sandbox-mock-token-" + Math.random().toString(36).substring(7);
      const mockItemId = "item-mock-" + Math.random().toString(36).substring(7);

      this.accessTokens.set(mockItemId, mockAccessToken);
      await this.saveTokens();

      return mockAccessToken;
    }

    const response = await fetch(
      `https://${plaidEnvironment}.plaid.com/item/public_token/exchange`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: plaidClientId,
          secret: plaidSecret,
          public_token: publicToken,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Plaid token exchange failed: ${data.error_message}`);
    }

    // Store the access token
    const itemId = data.item_id;
    this.accessTokens.set(itemId, data.access_token);
    await this.saveTokens();

    return data.access_token;
  }

  // Get accounts for a connected institution
  async getAccounts(accessToken: string): Promise<PlaidAccount[]> {
    if (USE_MOCK_DATA) {
      console.log("🔧 Using mock accounts data");
      // Return mock accounts data
      return mockAccountsData.accounts as PlaidAccount[];
    }

    const response = await fetch(
      `https://${plaidEnvironment}.plaid.com/accounts/get`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: Constants.expoConfig?.extra?.plaidClientId,
          secret: Constants.expoConfig?.extra?.plaidSecret,
          access_token: accessToken,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Plaid accounts fetch failed: ${data.error_message}`);
    }

    return data.accounts;
  }

  // Get investment holdings
  async getHoldings(accessToken: string): Promise<{
    accounts: PlaidAccount[];
    holdings: PlaidHolding[];
    securities: PlaidSecurity[];
  }> {
    if (USE_MOCK_DATA) {
      console.log("🔧 Using mock holdings data");
      return {
        accounts: mockAccountsData.accounts as PlaidAccount[],
        holdings: mockHoldingsData.holdings as PlaidHolding[],
        securities: mockHoldingsData.securities as PlaidSecurity[],
      };
    }

    const response = await fetch(
      `https://${plaidEnvironment}.plaid.com/investments/holdings/get`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: plaidClientId,
          secret: plaidSecret,
          access_token: accessToken,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Plaid holdings fetch failed: ${data.error_message}`);
    }

    return {
      accounts: data.accounts,
      holdings: data.holdings,
      securities: data.securities,
    };
  }

  // Get investment transactions
  async getInvestmentTransactions(
    accessToken: string,
    startDate: string,
    endDate: string
  ) {
    if (USE_MOCK_DATA) {
      console.log("🔧 Using mock investment transactions data");
      // Return mock transactions data (empty for now, can be expanded)
      return {
        accounts: mockAccountsData.accounts,
        investment_transactions: [],
        securities: mockHoldingsData.securities,
        total_investment_transactions: 0,
      };
    }

    const response = await fetch(
      `https://${plaidEnvironment}.plaid.com/investments/transactions/get`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: plaidClientId,
          secret: plaidSecret,
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Plaid transactions fetch failed: ${data.error_message}`);
    }

    return data;
  }

  // Convert Plaid holdings to our portfolio format
  convertToPortfolioPositions(
    holdings: PlaidHolding[],
    securities: PlaidSecurity[]
  ) {
    const securityMap = new Map(
      securities.map((sec) => [sec.security_id, sec])
    );

    return holdings.map((holding) => {
      const security = securityMap.get(holding.security_id);
      const currentPrice = holding.institution_price;
      const quantity = holding.quantity;
      const marketValue = holding.institution_value;
      const costBasis = holding.cost_basis || 0;
      const averageCost = quantity > 0 ? costBasis / quantity : 0;
      const unrealizedPnL = marketValue - costBasis;
      const unrealizedPnLPercent =
        costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

      return {
        symbol: security?.ticker_symbol || "UNKNOWN",
        name: security?.name || "Unknown Security",
        quantity,
        averageCost,
        currentPrice,
        marketValue,
        unrealizedPnL,
        unrealizedPnLPercent,
        provider: "plaid" as const,
      };
    });
  }

  // Check if Plaid credentials are configured
  hasCredentials(): boolean {
    return !!(plaidClientId && plaidSecret);
  }

  // Get all stored access tokens
  getStoredTokens(): string[] {
    if (USE_MOCK_DATA) {
      // Ensure we have at least one mock token for testing
      if (this.accessTokens.size === 0) {
        const mockToken = "access-sandbox-mock-token-default";
        const mockItemId = "item-mock-default";
        this.accessTokens.set(mockItemId, mockToken);
      }
    }
    return Array.from(this.accessTokens.values());
  }
}

export const plaidIntegrationService = new PlaidIntegrationService();
