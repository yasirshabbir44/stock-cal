import { DividendFrequency } from '../utils/dividend-frequency.util';

export type PortfolioRowSource = 'portfolio' | 'watchlist';

export type SourceFilter = 'all' | 'portfolio' | 'watchlist';

export interface PortfolioTableRow {
  id: string;
  ticker: string;
  companyName?: string;
  logoUrl?: string;
  source: PortfolioRowSource;
  sector: string;
  dividendFrequency: DividendFrequency;
  currentPrice: number;
  annualDividendPerShare: number;
  shares?: number;
  purchasePrice?: number;
  targetPrice?: number;
}
