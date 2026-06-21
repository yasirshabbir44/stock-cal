import { Injectable } from '@angular/core';
import { Holding } from '../models/holding.model';
import { DividendSchedule } from '../models/dividend-schedule.model';
import { HoldingMetrics, PortfolioMetrics } from '../models/portfolio-metrics.model';

@Injectable({ providedIn: 'root' })
export class PortfolioCalculatorService {
  computeHoldingMetrics(holding: Holding): HoldingMetrics {
    const assetValue = holding.currentPrice * holding.shares;
    const costBasis = holding.purchasePrice * holding.shares;
    const unrealizedGainLoss = assetValue - costBasis;
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
      unrealizedGainLoss,
      assetGrowthPercent,
      annualDividendIncome,
      yieldOnCostPercent,
    };
  }

  computeAverageYieldOnCost(metrics: PortfolioMetrics): number {
    if (metrics.holdings.length === 0) {
      return 0;
    }
    const total = metrics.holdings.reduce((sum, h) => sum + h.yieldOnCostPercent, 0);
    return total / metrics.holdings.length;
  }

  computePortfolioMetrics(holdings: Holding[]): PortfolioMetrics {
    const holdingMetrics = holdings.map((h) => this.computeHoldingMetrics(h));
    const totalPortfolioValue = holdingMetrics.reduce((sum, m) => sum + m.assetValue, 0);
    const totalCostBasis = holdingMetrics.reduce((sum, m) => sum + m.costBasis, 0);
    const totalUnrealizedGainLoss = holdingMetrics.reduce((sum, m) => sum + m.unrealizedGainLoss, 0);
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
      totalUnrealizedGainLoss,
      totalAssetGrowthPercent,
      totalAnnualDividendIncome,
      projectedMonthlyIncome: totalAnnualDividendIncome / 12,
      portfolioDividendYieldPercent,
      holdings: holdingMetrics,
    };
  }

  formatHoldingsCsv(metrics: PortfolioMetrics | null): string {
    const header =
      'Ticker,Shares,Purchase Price,Current Price,Cost Basis,Market Value,Unrealized P&L,Growth %,Annual Dividend,Yield on Cost %';

    if (!metrics) {
      return `${header}\n`;
    }

    const rows = metrics.holdings.map((h) =>
      [
        h.holding.ticker,
        h.holding.shares,
        h.holding.purchasePrice.toFixed(2),
        h.holding.currentPrice.toFixed(2),
        h.costBasis.toFixed(2),
        h.assetValue.toFixed(2),
        h.unrealizedGainLoss.toFixed(2),
        h.assetGrowthPercent.toFixed(2),
        h.annualDividendIncome.toFixed(2),
        h.yieldOnCostPercent.toFixed(2),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  computeUpcomingDividendTotal(
    schedules: DividendSchedule[],
    holdings: Holding[],
    days = 30,
  ): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const sharesByTicker = new Map(holdings.map((h) => [h.ticker, h.shares]));
    const today = new Date();

    return schedules
      .filter((s) => {
        const payDate = new Date(s.payDate);
        return payDate >= today && payDate <= cutoff;
      })
      .reduce((sum, s) => sum + s.amountPerShare * (sharesByTicker.get(s.ticker) ?? 0), 0);
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
