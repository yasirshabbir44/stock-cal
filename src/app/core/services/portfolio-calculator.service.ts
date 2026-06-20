import { Injectable } from '@angular/core';
import { getSectorForTicker } from '../constants/stock-sectors';
import { Holding } from '../models/holding.model';
import { DividendSchedule } from '../models/dividend-schedule.model';
import {
  IncomeProjectionYear,
  InsightAlert,
  PortfolioInsights,
  SectorAllocation,
} from '../models/portfolio-insights.model';
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

  computePortfolioInsights(metrics: PortfolioMetrics): PortfolioInsights {
    const alerts: InsightAlert[] = [];
    const totalValue = metrics.totalPortfolioValue;

    const allocation = metrics.holdings
      .map((h) => ({
        ticker: h.holding.ticker,
        percent: totalValue > 0 ? (h.assetValue / totalValue) * 100 : 0,
        value: h.assetValue,
        growthPercent: h.assetGrowthPercent,
      }))
      .sort((a, b) => b.percent - a.percent);

    const largestHoldingPercent = allocation[0]?.percent ?? 0;
    const topThreePercent = allocation.slice(0, 3).reduce((sum, a) => sum + a.percent, 0);

    for (const item of allocation) {
      if (item.percent >= 40) {
        alerts.push({
          id: `concentration-critical-${item.ticker}`,
          severity: 'critical',
          title: 'High concentration risk',
          message: `${item.ticker} makes up ${item.percent.toFixed(1)}% of your portfolio. Consider diversifying to reduce single-stock risk.`,
        });
      } else if (item.percent >= 25) {
        alerts.push({
          id: `concentration-warning-${item.ticker}`,
          severity: 'warning',
          title: 'Position size alert',
          message: `${item.ticker} is ${item.percent.toFixed(1)}% of your portfolio — above the 25% guideline for diversified investors.`,
        });
      }
    }

    if (topThreePercent >= 70 && metrics.holdings.length >= 3) {
      alerts.push({
        id: 'top-three-concentration',
        severity: 'warning',
        title: 'Top-heavy portfolio',
        message: `Your top 3 holdings account for ${topThreePercent.toFixed(1)}% of total value. Spreading capital across more positions can improve resilience.`,
      });
    }

    if (metrics.holdings.length < 5 && metrics.holdings.length > 0) {
      alerts.push({
        id: 'low-holding-count',
        severity: 'info',
        title: 'Room to diversify',
        message: `You hold ${metrics.holdings.length} position${metrics.holdings.length === 1 ? '' : 's'}. Many income investors target 10–20 holdings for smoother dividend flow.`,
      });
    }

    if (metrics.portfolioDividendYieldPercent < 1 && totalValue > 0) {
      alerts.push({
        id: 'low-yield',
        severity: 'info',
        title: 'Low dividend yield',
        message: `Portfolio yield is ${metrics.portfolioDividendYieldPercent.toFixed(2)}%. If passive income is your goal, consider adding dividend-focused ETFs or aristocrats.`,
      });
    }

    if (metrics.totalUnrealizedGainLoss < 0 && Math.abs(metrics.totalAssetGrowthPercent) >= 10) {
      alerts.push({
        id: 'unrealized-loss',
        severity: 'warning',
        title: 'Unrealized loss',
        message: `Portfolio is down ${Math.abs(metrics.totalAssetGrowthPercent).toFixed(1)}% from cost basis ($${Math.abs(metrics.totalUnrealizedGainLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })} unrealized).`,
      });
    }

    const sectorMap = new Map<string, number>();
    for (const h of metrics.holdings) {
      const sector = getSectorForTicker(h.holding.ticker);
      sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.assetValue);
    }

    const sectorAllocation: SectorAllocation[] = [...sectorMap.entries()]
      .map(([sector, value]) => ({
        sector,
        value,
        percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const sortedByGrowth = [...allocation].sort((a, b) => b.growthPercent - a.growthPercent);
    const topGainers = sortedByGrowth
      .filter((a) => a.growthPercent > 0)
      .slice(0, 3)
      .map((a) => ({ ticker: a.ticker, growthPercent: a.growthPercent, assetValue: a.value }));
    const topLosers = [...sortedByGrowth]
      .reverse()
      .filter((a) => a.growthPercent < 0)
      .slice(0, 3)
      .map((a) => ({ ticker: a.ticker, growthPercent: a.growthPercent, assetValue: a.value }));

    const diversificationScore = this.computeDiversificationScore(allocation, metrics.holdings.length);
    const healthScore = this.computeHealthScore(
      diversificationScore,
      metrics.portfolioDividendYieldPercent,
      metrics.totalAssetGrowthPercent,
      metrics.holdings.length,
      largestHoldingPercent,
    );

    return {
      healthScore,
      healthLabel: this.healthLabel(healthScore),
      alerts,
      sectorAllocation,
      topGainers,
      topLosers,
      diversificationScore,
      largestHoldingPercent,
    };
  }

  projectIncome(
    annualIncome: number,
    years: number,
    dividendGrowthRatePercent: number,
  ): IncomeProjectionYear[] {
    const projections: IncomeProjectionYear[] = [];
    const currentYear = new Date().getFullYear();
    let income = annualIncome;

    for (let i = 0; i <= years; i++) {
      projections.push({
        year: currentYear + i,
        annualIncome: income,
        monthlyIncome: income / 12,
      });
      income *= 1 + dividendGrowthRatePercent / 100;
    }

    return projections;
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

  private computeDiversificationScore(
    allocation: Array<{ percent: number }>,
    holdingCount: number,
  ): number {
    let score = 100;

    if (holdingCount === 1) {
      score -= 40;
    } else if (holdingCount < 5) {
      score -= 20;
    } else if (holdingCount >= 10) {
      score += 10;
    }

    const maxPercent = allocation[0]?.percent ?? 0;
    if (maxPercent >= 40) {
      score -= 30;
    } else if (maxPercent >= 25) {
      score -= 15;
    } else if (maxPercent <= 15) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private computeHealthScore(
    diversificationScore: number,
    yieldPercent: number,
    growthPercent: number,
    holdingCount: number,
    largestPercent: number,
  ): number {
    let score = diversificationScore * 0.5;

    if (yieldPercent >= 2 && yieldPercent <= 6) {
      score += 20;
    } else if (yieldPercent >= 1) {
      score += 10;
    }

    if (growthPercent >= 0) {
      score += 15;
    } else if (growthPercent >= -10) {
      score += 5;
    }

    if (holdingCount >= 8) {
      score += 10;
    } else if (holdingCount >= 5) {
      score += 5;
    }

    if (largestPercent <= 20) {
      score += 5;
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private healthLabel(score: number): string {
    if (score >= 80) {
      return 'Excellent';
    }
    if (score >= 65) {
      return 'Good';
    }
    if (score >= 45) {
      return 'Fair';
    }
    return 'Needs Attention';
  }
}
