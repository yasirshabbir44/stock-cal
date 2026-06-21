import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ChartData } from 'chart.js';
import { METRIC_FORMULAS } from '../../core/constants/metric-formulas';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { PaycheckViewService } from '../../core/services/paycheck-view.service';
import { SaveFeedbackService } from '../../core/services/save-feedback.service';
import { MetricCardComponent } from '../../shared/components/metric-card.component';
import { ChartComponent } from '../../shared/components/chart.component';
import { YieldTrendCellComponent } from '../../shared/components/yield-trend-cell.component';
import { GetStartedGuideComponent } from '../../shared/components/get-started-guide.component';

@Component({
  selector: 'app-paycheck-dashboard',
  standalone: true,
  imports: [FormsModule, MetricCardComponent, ChartComponent, YieldTrendCellComponent, RouterLink, CurrencyPipe, DecimalPipe, DatePipe, GetStartedGuideComponent],
  templateUrl: './paycheck-dashboard.component.html',
  styleUrl: './paycheck-dashboard.component.scss',
})
export class PaycheckDashboardComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);
  readonly feedback = inject(SaveFeedbackService);
  readonly paycheckView = inject(PaycheckViewService);

  readonly formulas = METRIC_FORMULAS;
  readonly metrics = this.portfolio.metrics;
  readonly baseMetrics = this.portfolio.baseMetrics;
  readonly hasActiveSimulations = this.portfolio.hasActiveSimulations;
  readonly schedules = this.portfolio.dividendSchedules;
  readonly settings = this.portfolio.settings;
  readonly incomeGoalProgress = this.portfolio.incomeGoalProgress;
  readonly loading = this.portfolio.loading;
  readonly snapshots = this.portfolio.portfolioSnapshots;

  readonly monthlyTotals = computed(() => this.portfolio.monthlyDividendTotals());

  readonly yearlyTotals = computed(() => {
    const yearly = new Map<string, number>();
    for (const [monthKey, total] of this.monthlyTotals()) {
      const year = monthKey.slice(0, 4);
      yearly.set(year, (yearly.get(year) ?? 0) + total);
    }
    return new Map([...yearly.entries()].sort(([a], [b]) => a.localeCompare(b)));
  });

  readonly dividendChartTotals = computed(() =>
    this.paycheckView.dividendChartGranularity() === 'yearly'
      ? this.yearlyTotals()
      : this.monthlyTotals(),
  );

  readonly chartData = computed<ChartData<'bar'>>(() => {
    const totals = this.dividendChartTotals();
    const isYearly = this.paycheckView.dividendChartGranularity() === 'yearly';
    const labels = [...totals.keys()].map((key) => {
      if (isYearly) {
        return key;
      }
      const [year, month] = key.split('-');
      return new Date(Number(year), Number(month) - 1).toLocaleDateString(undefined, {
        month: 'short',
        year: '2-digit',
      });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Projected Dividends',
          data: [...totals.values()],
          backgroundColor: '#10b981',
          borderRadius: 6,
        },
      ],
    };
  });

  readonly chartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) =>
            `$${(ctx.parsed.y ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value: string | number) => `$${Number(value).toFixed(0)}`,
        },
      },
    },
  };

  readonly upcomingTotal = computed(() => this.portfolio.upcomingDividendTotal(30));

  readonly sortedSchedules = computed(() =>
    [...this.schedules()].sort((a, b) => a.payDate.localeCompare(b.payDate)),
  );

  readonly averageYieldOnCost = computed(() => {
    const m = this.metrics();
    if (!m || m.holdings.length === 0) {
      return 0;
    }
    return m.holdings.reduce((sum, h) => sum + h.yieldOnCostPercent, 0) / m.holdings.length;
  });

  readonly incomeDelta = computed(() => {
    const current = this.metrics()?.totalAnnualDividendIncome ?? 0;
    const base = this.baseMetrics()?.totalAnnualDividendIncome ?? 0;
    return current - base;
  });

  isSimulating(holdingId: string): boolean {
    return this.portfolio.isSimulating(holdingId);
  }

  simulatedAdditionalShares(holdingId: string): number {
    return this.portfolio.getSimulation(holdingId)?.additionalShares ?? 0;
  }

  clearAllSimulations(): void {
    this.portfolio.clearAllSimulations();
  }

  readonly incomeHistory = computed(() => {
    const m = this.metrics();
    const today = new Date().toISOString().slice(0, 10);

    const points = this.snapshots()
      .filter((s) => s.annualDividendIncome != null)
      .map((s) => ({
        date: s.date,
        income: s.annualDividendIncome!,
        yieldOnCost: s.averageYieldOnCostPercent ?? 0,
      }));

    if (m) {
      const last = points[points.length - 1];
      if (!last || last.date !== today) {
        points.push({
          date: today,
          income: m.totalAnnualDividendIncome,
          yieldOnCost: this.averageYieldOnCost(),
        });
      } else if (last.income !== m.totalAnnualDividendIncome) {
        last.income = m.totalAnnualDividendIncome;
        last.yieldOnCost = this.averageYieldOnCost();
      }
    }

    return points;
  });

  readonly incomeSparkline = computed(() => this.incomeHistory().map((p) => p.income));

  readonly yieldOnCostSparkline = computed(() => this.incomeHistory().map((p) => p.yieldOnCost));

  readonly incomeGrowthPercent = computed(() => {
    const history = this.incomeHistory();
    if (history.length < 2) {
      return null;
    }
    const first = history[0].income;
    const last = history[history.length - 1].income;
    if (first <= 0) {
      return null;
    }
    return ((last - first) / first) * 100;
  });

  readonly incomeTrendChart = computed<ChartData<'line'>>(() => {
    const history = this.incomeHistory();
    return {
      labels: history.map((p) =>
        new Date(p.date + 'T00:00:00').toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: '2-digit',
        }),
      ),
      datasets: [
        {
          label: 'Annual Income',
          data: history.map((p) => p.income),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          yAxisID: 'y',
        },
        {
          label: 'Avg Yield on Cost',
          data: history.map((p) => p.yieldOnCost),
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          borderDash: [4, 3],
          yAxisID: 'y1',
        },
      ],
    };
  });

  readonly incomeTrendOptions = {
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { boxWidth: 12, padding: 16 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const val = ctx.parsed.y ?? 0;
            if (ctx.dataset.label === 'Avg Yield on Cost') {
              return `${ctx.dataset.label}: ${val.toFixed(2)}%`;
            }
            return `${ctx.dataset.label}: $${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
          },
        },
      },
    },
    scales: {
      y: {
        position: 'left' as const,
        ticks: {
          callback: (value: string | number) =>
            `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        },
      },
      y1: {
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: {
          callback: (value: string | number) => `${Number(value).toFixed(1)}%`,
        },
      },
    },
  };

  readonly dividendGrowthRate = signal(5);

  readonly incomeProjection = computed(() =>
    this.portfolio.projectIncome(5, this.dividendGrowthRate()),
  );

  readonly projectionChart = computed<ChartData<'line'>>(() => {
    const projection = this.incomeProjection();
    return {
      labels: projection.map((p) => String(p.year)),
      datasets: [
        {
          label: 'Projected Annual Income',
          data: projection.map((p) => p.annualIncome),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
        },
      ],
    };
  });

  readonly projectionOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) =>
            `$${(ctx.parsed.y ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}/yr`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value: string | number) => `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        },
      },
    },
  };

  ngOnInit(): void {
    void this.portfolio.init().then(() => this.portfolio.ensureTodayIncomeSnapshot());
    void this.portfolio.ensureProjectionsLoaded();
  }

  onGrowthRateChange(value: number | string): void {
    this.dividendGrowthRate.set(+value);
    this.feedback.flashValue('dividendGrowthRate');
  }

  payoutAmount(ticker: string, amountPerShare: number): number {
    const holding = this.portfolio.holdings().find((h) => h.ticker === ticker);
    return (holding?.shares ?? 0) * amountPerShare;
  }
}
