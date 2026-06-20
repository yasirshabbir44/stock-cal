import { Holding } from './holding.model';

export interface HoldingMetrics {
  holding: Holding;
  assetValue: number;
  costBasis: number;
  unrealizedGainLoss: number;
  assetGrowthPercent: number;
  annualDividendIncome: number;
  yieldOnCostPercent: number;
}

export interface PortfolioMetrics {
  totalPortfolioValue: number;
  totalCostBasis: number;
  totalUnrealizedGainLoss: number;
  totalAssetGrowthPercent: number;
  totalAnnualDividendIncome: number;
  projectedMonthlyIncome: number;
  portfolioDividendYieldPercent: number;
  holdings: HoldingMetrics[];
}
