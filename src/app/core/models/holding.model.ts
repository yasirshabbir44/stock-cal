export interface Holding {
  id: string;
  ticker: string;
  companyName?: string;
  logoUrl?: string;
  shares: number;
  purchasePrice: number;
  currentPrice: number;
  annualDividendPerShare: number;
  lastUpdated: string;
  createdAt: string;
}

export interface HoldingInput {
  ticker: string;
  companyName?: string;
  logoUrl?: string;
  shares: number;
  purchasePrice: number;
}
