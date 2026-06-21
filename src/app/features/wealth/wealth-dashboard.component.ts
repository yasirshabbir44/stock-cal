import { Component, computed, inject, OnInit } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChartData } from 'chart.js';
import { RouterLink } from '@angular/router';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { MetricCardComponent } from '../../shared/components/metric-card.component';
import { ChartComponent } from '../../shared/components/chart.component';

@Component({
  selector: 'app-wealth-dashboard',
  standalone: true,
  imports: [MetricCardComponent, ChartComponent, CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './wealth-dashboard.component.html',
  styleUrl: './wealth-dashboard.component.scss',
})
export class WealthDashboardComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);

  readonly metrics = this.portfolio.metrics;
  readonly snapshots = this.portfolio.portfolioSnapshots;
  readonly benchmark = this.portfolio.benchmarkComparison;
  readonly loading = this.portfolio.loading;

  readonly chartData = computed<ChartData<'line'>>(() => {
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
          callback: (value: string | number) =>
            `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        },
      },
    },
  };

  ngOnInit(): void {
    void this.portfolio.init();
    void this.portfolio.ensureProjectionsLoaded();
  }

  async refresh(): Promise<void> {
    await this.portfolio.refreshMarketData();
  }
}
