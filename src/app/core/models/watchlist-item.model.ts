export interface WatchlistItem {
  id: string;
  ticker: string;
  companyName?: string;
  logoUrl?: string;
  targetPrice?: number;
  notes?: string;
  currentPrice: number;
  annualDividendPerShare: number;
  /** Trailing yield (DPS / price) captured at the previous market refresh */
  previousDividendYieldPercent?: number;
  addedAt: string;
  lastUpdated: string;
}

export interface WatchlistItemInput {
  ticker: string;
  companyName?: string;
  logoUrl?: string;
  targetPrice?: number;
  notes?: string;
}
