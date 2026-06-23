import { Component, computed, inject, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import type { ChartData } from 'chart.js';
import { METRIC_FORMULAS } from '../../core/constants/metric-formulas';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { MetricCardComponent } from '../../shared/components/metric-card.component';
import { ChartComponent } from '../../shared/components/chart.component';
import { GetStartedGuideComponent } from '../../shared/components/get-started-guide.component';

@Component({
  selector: 'app-wealth-dashboard',
  standalone: true,
  imports: [MetricCardComponent, ChartComponent, CurrencyPipe, DatePipe, DecimalPipe, GetStartedGuideComponent],
  templateUrl: './wealth-dashboard.component.html',
  styleUrl: './wealth-dashboard.component.scss',
})
export class WealthDashboardComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);

  readonly formulas = METRIC_FORMULAS;
  readonly metrics = this.portfolio.metrics;
  readonly snapshots = this.portfolio.portfolioSnapshots;
  readonly benchmark = this.portfolio.benchmarkComparison;
  readonly performanceSeries = this.portfolio.performanceChartSeries;
  readonly loading = this.portfolio.loading;

  readonly chartData = computed<ChartData<'line'>>(() => {
    const performance = this.performanceSeries();
    if (performance) {
      return {
        labels: performance.dates.map((date) =>
          new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
        ),
        datasets: [
          {
            label: 'Your Portfolio',
            data: performance.portfolioValues,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
          },
          {
            label: performance.benchmarkLabel,
            data: performance.benchmarkValues,
            borderColor: '#94a3b8',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderDash: [6, 4],
          },
        ],
      };
    }

    const snapshots = this.snapshots();
    return {
      labels: snapshots.map((s) => s.date),
      datasets: [
        {
          label: 'Portfolio Value',
          data: snapshots.map((s) => s.totalValue),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
        },
      ],
    };
  });

  readonly chartOptions = computed(() => ({
    plugins: {
      legend: {
        display: this.performanceSeries() != null,
        position: 'top' as const,
        labels: { boxWidth: 12, padding: 16 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label ?? 'Value'}: $${(ctx.parsed.y ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value: string | number) =>
            `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        },
      },
    },
  }));

  ngOnInit(): void {
    void this.portfolio.init();
    void this.portfolio.ensureProjectionsLoaded();
  }

  async refresh(): Promise<void> {
    await this.portfolio.refreshMarketData();
  }
}
