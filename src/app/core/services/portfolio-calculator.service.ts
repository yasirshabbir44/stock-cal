import { Injectable } from '@angular/core';
import { Holding } from '../models/holding.model';
import { DividendSchedule } from '../models/dividend-schedule.model';
import { HoldingMetrics, PortfolioMetrics } from '../models/portfolio-metrics.model';

@Injectable({ providedIn: 'root' })
export class PortfolioCalculatorService {
  computeHoldingMetrics(holding: Holding): HoldingMetrics {
    const assetValue = holding.currentPrice * holding.shares;
    const costBasis = holding.purchasePrice * holding.shares;
    const assetGrowthPercent =
      costBasis > 0 ? ((holding.currentPrice - holding.purchasePrice) / holding.purchasePrice) * 100 : 0;
    const annualDividendIncome = holding.annualDividendPerShare * holding.shares;
    const yieldOnCostPercent =
      holding.purchasePrice > 0
        ? (holding.annualDividendPerShare / holding.purchasePrice) * 100
        : 0;

    return {
      holding,
      assetValue,
      costBasis,
      assetGrowthPercent,
      annualDividendIncome,
      yieldOnCostPercent,
    };
  }

  computePortfolioMetrics(holdings: Holding[]): PortfolioMetrics {
    const holdingMetrics = holdings.map((h) => this.computeHoldingMetrics(h));
    const totalPortfolioValue = holdingMetrics.reduce((sum, m) => sum + m.assetValue, 0);
    const totalCostBasis = holdingMetrics.reduce((sum, m) => sum + m.costBasis, 0);
    const totalAnnualDividendIncome = holdingMetrics.reduce((sum, m) => sum + m.annualDividendIncome, 0);

    const totalAssetGrowthPercent =
      totalCostBasis > 0
        ? ((totalPortfolioValue - totalCostBasis) / totalCostBasis) * 100
        : 0;

    const portfolioDividendYieldPercent =
      totalPortfolioValue > 0 ? (totalAnnualDividendIncome / totalPortfolioValue) * 100 : 0;

    return {
      totalPortfolioValue,
      totalCostBasis,
      totalAssetGrowthPercent,
      totalAnnualDividendIncome,
      projectedMonthlyIncome: totalAnnualDividendIncome / 12,
      portfolioDividendYieldPercent,
      holdings: holdingMetrics,
    };
  }

  aggregateDividendsByMonth(schedules: DividendSchedule[], holdings: Holding[]): Map<string, number> {
    const sharesByTicker = new Map(holdings.map((h) => [h.ticker, h.shares]));
    const monthlyTotals = new Map<string, number>();

    for (const schedule of schedules) {
      const shares = sharesByTicker.get(schedule.ticker) ?? 0;
      const payout = schedule.amountPerShare * shares;
      const monthKey = schedule.payDate.slice(0, 7);

      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) ?? 0) + payout);
    }

    return new Map([...monthlyTotals.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }
}
