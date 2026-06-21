import { HoldingInput } from '../models/holding.model';
import { WatchlistItemInput } from '../models/watchlist-item.model';

export interface DemoPortfolioHolding extends HoldingInput {
  companyName: string;
}

export interface DemoPortfolioWatchlistItem extends WatchlistItemInput {
  companyName: string;
}

export const DEMO_PORTFOLIO = {
  name: 'Sample Income Portfolio',
  description:
    'A balanced mix of dividend ETFs, REITs, and blue-chip stocks — perfect for exploring wealth, income, and planning tools.',
  holdings: [
    { ticker: 'SCHD', companyName: 'Schwab US Dividend Equity ETF', shares: 45, purchasePrice: 78.5 },
    { ticker: 'O', companyName: 'Realty Income Corporation', shares: 25, purchasePrice: 58 },
    { ticker: 'KO', companyName: 'The Coca-Cola Company', shares: 35, purchasePrice: 62 },
    { ticker: 'JNJ', companyName: 'Johnson & Johnson', shares: 12, purchasePrice: 158 },
    { ticker: 'AAPL', companyName: 'Apple Inc', shares: 8, purchasePrice: 185 },
    { ticker: 'MSFT', companyName: 'Microsoft Corporation', shares: 4, purchasePrice: 415 },
  ] satisfies DemoPortfolioHolding[],
  watchlist: [
    { ticker: 'NVDA', companyName: 'NVIDIA Corporation', targetPrice: 120, notes: 'Watching for a pullback' },
    { ticker: 'MAIN', companyName: 'Main Street Capital Corporation', targetPrice: 45 },
  ] satisfies DemoPortfolioWatchlistItem[],
};

export function estimateDemoPortfolioCost(): number {
  return DEMO_PORTFOLIO.holdings.reduce((sum, h) => sum + h.shares * h.purchasePrice, 0);
}
