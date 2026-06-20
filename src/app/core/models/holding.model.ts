export interface Holding {
  id: string;
  ticker: string;
  shares: number;
  purchasePrice: number;
  currentPrice: number;
  annualDividendPerShare: number;
  lastUpdated: string;
  createdAt: string;
}

export interface HoldingInput {
  ticker: string;
  shares: number;
  purchasePrice: number;
}
