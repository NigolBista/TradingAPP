// Brokerage authentication service
export interface BrokerageAuth {
  provider: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface BrokerageProviderInfo {
  id: string;
  name: string;
  logoUrl?: string;
  isSupported: boolean;
  features: string[];
}

export type BrokerageProvider = 'robinhood' | 'webull' | 'schwab' | 'fidelity' | 'etrade';

export interface AuthResult {
  success: boolean;
  connection?: BrokerageConnection;
  session?: BrokerageConnection;
  error?: string;
}

export interface BrokerageConnection {
  id: string;
  provider: string;
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export class BrokerageAuthService {
  async initiateAuth(provider: string): Promise<string> {
    // Implementation would handle OAuth flow initiation
    throw new Error('BrokerageAuth service not implemented');
  }

  async handleAuthCallback(code: string, state: string): Promise<BrokerageConnection> {
    // Implementation would handle OAuth callback
    throw new Error('BrokerageAuth service not implemented');
  }

  async refreshConnection(connection: BrokerageConnection): Promise<BrokerageConnection> {
    // Implementation would refresh tokens
    throw new Error('BrokerageAuth service not implemented');
  }

  async disconnectBrokerage(connectionId: string): Promise<void> {
    // Implementation would revoke tokens and disconnect
    throw new Error('BrokerageAuth service not implemented');
  }

  async getActiveSessions(): Promise<BrokerageConnection[]> {
    // Implementation would return active brokerage sessions
    throw new Error('BrokerageAuth service not implemented');
  }

  async clearSession(sessionId: string): Promise<void> {
    // Implementation would clear a specific session
    throw new Error('BrokerageAuth service not implemented');
  }
}

export const brokerageAuthService = new BrokerageAuthService();