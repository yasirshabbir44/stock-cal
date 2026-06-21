export interface Holding {
  id: string;
  ticker: string;
  companyName?: string;
  logoUrl?: string;
  shares: number;
  purchasePrice: number;
  currentPrice: number;
  annualDividendPerShare: number;
  /** Trailing yield (DPS / price) captured at the previous market refresh */
  previousDividendYieldPercent?: number;
  /** Yield on cost captured at the previous market refresh */
  previousYieldOnCostPercent?: number;
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
