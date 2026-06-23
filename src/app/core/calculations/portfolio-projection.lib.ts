import { getSectorForTicker } from '../constants/stock-sectors';
import { FirePlanSummary, FireProjectionYear } from '../models/fire-projection.model';
import { PortfolioMilestone } from '../models/portfolio-milestone.model';
import { PortfolioSnapshot } from '../models/portfolio-snapshot.model';
import {
  BenchmarkComparison,
  IncomeProjectionYear,
  InsightAlert,
  PerformanceChartSeries,
  PortfolioInsights,
  RebalanceSuggestion,
  SectorAllocation,
} from '../models/portfolio-insights.model';
import { PortfolioMetrics } from '../models/portfolio-metrics.model';

export function computePortfolioInsights(metrics: PortfolioMetrics): PortfolioInsights {
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

  const diversificationScore = computeDiversificationScore(allocation, metrics.holdings.length);
  const healthScore = computeHealthScore(
    diversificationScore,
    metrics.portfolioDividendYieldPercent,
    metrics.totalAssetGrowthPercent,
    metrics.holdings.length,
    largestHoldingPercent,
  );

  const rebalanceSuggestions = computeRebalanceSuggestions(metrics);

  return {
    healthScore,
    healthLabel: healthLabel(healthScore),
    alerts,
    sectorAllocation,
    topGainers,
    topLosers,
    diversificationScore,
    largestHoldingPercent,
    rebalanceSuggestions,
  };
}

export function computeRebalanceSuggestions(metrics: PortfolioMetrics): RebalanceSuggestion[] {
  const count = metrics.holdings.length;
  if (count < 2) {
    return [];
  }

  const targetPercent = 100 / count;
  const totalValue = metrics.totalPortfolioValue;

  return metrics.holdings
    .map((h) => {
      const currentPercent = totalValue > 0 ? (h.assetValue / totalValue) * 100 : 0;
      const driftPercent = currentPercent - targetPercent;
      const suggestedAmount = Math.abs((driftPercent / 100) * totalValue);

      let action: RebalanceSuggestion['action'] = 'hold';
      if (driftPercent >= 5) {
        action = 'sell';
      } else if (driftPercent <= -5) {
        action = 'buy';
      }

      return {
        ticker: h.holding.ticker,
        currentPercent,
        targetPercent,
        driftPercent,
        action,
        suggestedAmount,
      };
    })
    .filter((s) => s.action !== 'hold')
    .sort((a, b) => Math.abs(b.driftPercent) - Math.abs(a.driftPercent));
}

export const SP500_ANNUAL_RETURN_PERCENT = 10;

export function computeBenchmarkComparison(
  snapshots: PortfolioSnapshot[],
  portfolioGrowthPercent: number,
): BenchmarkComparison | null {
  if (snapshots.length < 2) {
    return null;
  }

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const daysBetween = Math.max(
    1,
    (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24),
  );

  const annualizedPortfolio =
    first.totalValue > 0
      ? (Math.pow(last.totalValue / first.totalValue, 365 / daysBetween) - 1) * 100
      : portfolioGrowthPercent;

  const benchmarkGrowthPercent = SP500_ANNUAL_RETURN_PERCENT * (daysBetween / 365);
  const alphaPercent = annualizedPortfolio - SP500_ANNUAL_RETURN_PERCENT;

  return {
    portfolioGrowthPercent: annualizedPortfolio,
    benchmarkGrowthPercent,
    alphaPercent,
    benchmarkLabel: `S&P 500 (${SP500_ANNUAL_RETURN_PERCENT}% annualized)`,
    trackingDays: Math.round(daysBetween),
  };
}

export function computePerformanceChartSeries(
  snapshots: PortfolioSnapshot[],
  sp500AnnualReturnPercent = SP500_ANNUAL_RETURN_PERCENT,
): PerformanceChartSeries | null {
  if (snapshots.length < 2) {
    return null;
  }

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const firstDate = new Date(first.date).getTime();
  const dailyRate = Math.pow(1 + sp500AnnualReturnPercent / 100, 1 / 365) - 1;

  return {
    dates: sorted.map((s) => s.date),
    portfolioValues: sorted.map((s) => s.totalValue),
    benchmarkValues: sorted.map((s) => {
      const days = (new Date(s.date).getTime() - firstDate) / (1000 * 60 * 60 * 24);
      return first.totalValue * Math.pow(1 + dailyRate, days);
    }),
    benchmarkLabel: `S&P 500 (${sp500AnnualReturnPercent}% annualized)`,
  };
}

export function computePortfolioMilestones(
  metrics: PortfolioMetrics,
  monthlyIncomeGoal: number,
): PortfolioMilestone[] {
  return [
    {
      id: 'wealth-10k',
      title: '$10K Portfolio',
      description: 'First major wealth milestone',
      category: 'wealth',
      target: 10_000,
      current: metrics.totalPortfolioValue,
      achieved: metrics.totalPortfolioValue >= 10_000,
      progress: Math.min(100, (metrics.totalPortfolioValue / 10_000) * 100),
    },
    {
      id: 'wealth-100k',
      title: '$100K Portfolio',
      description: 'Six-figure investor club',
      category: 'wealth',
      target: 100_000,
      current: metrics.totalPortfolioValue,
      achieved: metrics.totalPortfolioValue >= 100_000,
      progress: Math.min(100, (metrics.totalPortfolioValue / 100_000) * 100),
    },
    {
      id: 'wealth-1m',
      title: '$1M Portfolio',
      description: 'Millionaire milestone',
      category: 'wealth',
      target: 1_000_000,
      current: metrics.totalPortfolioValue,
      achieved: metrics.totalPortfolioValue >= 1_000_000,
      progress: Math.min(100, (metrics.totalPortfolioValue / 1_000_000) * 100),
    },
    {
      id: 'income-100',
      title: '$100/mo Income',
      description: 'First passive income paycheck',
      category: 'income',
      target: 100,
      current: metrics.projectedMonthlyIncome,
      achieved: metrics.projectedMonthlyIncome >= 100,
      progress: Math.min(100, (metrics.projectedMonthlyIncome / 100) * 100),
    },
    {
      id: 'income-1k',
      title: '$1K/mo Income',
      description: 'Covers a major bill',
      category: 'income',
      target: 1_000,
      current: metrics.projectedMonthlyIncome,
      achieved: metrics.projectedMonthlyIncome >= 1_000,
      progress: Math.min(100, (metrics.projectedMonthlyIncome / 1_000) * 100),
    },
    {
      id: 'income-goal',
      title: 'Income Goal',
      description: 'Hit your monthly target',
      category: 'income',
      target: monthlyIncomeGoal,
      current: metrics.projectedMonthlyIncome,
      achieved: monthlyIncomeGoal > 0 && metrics.projectedMonthlyIncome >= monthlyIncomeGoal,
      progress:
        monthlyIncomeGoal > 0
          ? Math.min(100, (metrics.projectedMonthlyIncome / monthlyIncomeGoal) * 100)
          : 0,
    },
    {
      id: 'holdings-5',
      title: '5 Holdings',
      description: 'Basic diversification',
      category: 'portfolio',
      target: 5,
      current: metrics.holdings.length,
      achieved: metrics.holdings.length >= 5,
      progress: Math.min(100, (metrics.holdings.length / 5) * 100),
    },
    {
      id: 'holdings-10',
      title: '10 Holdings',
      description: 'Well-diversified portfolio',
      category: 'portfolio',
      target: 10,
      current: metrics.holdings.length,
      achieved: metrics.holdings.length >= 10,
      progress: Math.min(100, (metrics.holdings.length / 10) * 100),
    },
  ];
}

export function computeFreedomNumber(
  monthlyIncomeGoal: number,
  withdrawalRatePercent: number,
): number {
  return withdrawalRatePercent > 0 ? (monthlyIncomeGoal * 12) / (withdrawalRatePercent / 100) : 0;
}

export function computeMonthlyIncomeFromFreedomNumber(
  freedomNumber: number,
  withdrawalRatePercent: number,
): number {
  return withdrawalRatePercent > 0 ? (freedomNumber * (withdrawalRatePercent / 100)) / 12 : 0;
}

export function computeFirePlan(
  metrics: PortfolioMetrics,
  monthlyIncomeGoal: number,
  monthlyContribution: number,
  dividendGrowthRatePercent: number,
  portfolioGrowthRatePercent: number,
  withdrawalRatePercent: number,
): FirePlanSummary {
  const freedomNumber = computeFreedomNumber(monthlyIncomeGoal, withdrawalRatePercent);
  const monthlyGap =
    monthlyIncomeGoal > 0 ? Math.max(0, monthlyIncomeGoal - metrics.projectedMonthlyIncome) : 0;
  const goalReached = monthlyIncomeGoal > 0 && metrics.projectedMonthlyIncome >= monthlyIncomeGoal;

  let yearsToGoal: number | null = null;
  if (monthlyIncomeGoal <= 0) {
    yearsToGoal = null;
  } else if (goalReached) {
    yearsToGoal = 0;
  } else {
    const projection = projectFirePath(
      metrics.totalPortfolioValue,
      metrics.totalAnnualDividendIncome,
      monthlyContribution,
      dividendGrowthRatePercent,
      portfolioGrowthRatePercent,
      50,
    );

    for (const year of projection) {
      if (year.monthlyIncome >= monthlyIncomeGoal) {
        yearsToGoal = year.year - new Date().getFullYear();
        break;
      }
    }
  }

  return {
    freedomNumber,
    yearsToGoal,
    monthlyGap,
    goalReached,
    withdrawalRatePercent,
  };
}

export function projectFirePath(
  startingPortfolioValue: number,
  startingAnnualIncome: number,
  monthlyContribution: number,
  dividendGrowthRatePercent: number,
  portfolioGrowthRatePercent: number,
  years: number,
): FireProjectionYear[] {
  const projections: FireProjectionYear[] = [];
  const currentYear = new Date().getFullYear();
  let portfolioValue = startingPortfolioValue;
  let annualIncome = startingAnnualIncome;

  for (let i = 0; i <= years; i++) {
    projections.push({
      year: currentYear + i,
      portfolioValue,
      annualIncome,
      monthlyIncome: annualIncome / 12,
    });

    if (i < years) {
      portfolioValue = portfolioValue * (1 + portfolioGrowthRatePercent / 100) + monthlyContribution * 12;
      annualIncome *= 1 + dividendGrowthRatePercent / 100;
    }
  }

  return projections;
}

export function projectIncome(
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

function computeDiversificationScore(
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

function computeHealthScore(
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

function healthLabel(score: number): string {
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
