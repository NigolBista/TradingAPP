// Trading feature types
export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  type: 'market' | 'limit' | 'stop';
  price?: number;
  stopPrice?: number;
}

export interface TradingAlert {
  id: string;
  symbol: string;
  condition: string;
  value: number;
  isActive: boolean;
}

export interface ChartTimeframe {
  label: string;
  value: string;
  interval: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}