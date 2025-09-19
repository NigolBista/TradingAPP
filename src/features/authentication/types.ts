// Authentication feature types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface BrokerageAuthConfig {
  broker: string;
  authUrl: string;
  redirectUrl: string;
}