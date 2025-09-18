// Market feature types
export interface MarketSummary {
  indices: MarketIndex[];
  movers: {
    gainers: StockMover[];
    losers: StockMover[];
  };
  sectors: SectorPerformance[];
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface StockMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface SectorPerformance {
  sector: string;
  change: number;
  changePercent: number;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
  createdAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  symbols?: string[];
}