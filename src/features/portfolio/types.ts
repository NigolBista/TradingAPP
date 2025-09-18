// Portfolio feature types
export interface PortfolioSummary {
  totalValue: number;
  todayChange: number;
  todayChangePercent: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  availableCash: number;
  positions: Position[];
}

export interface PortfolioHistoryData {
  date: string;
  value: number;
  change: number;
  changePercent: number;
}