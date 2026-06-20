import { Component, computed, inject, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartData } from 'chart.js';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { ChartComponent } from '../../shared/components/chart.component';

@Component({
  selector: 'app-home-dashboard',
  standalone: true,
  imports: [ChartComponent, RouterLink, CurrencyPipe, DecimalPipe, DatePipe],
  templateUrl: './home-dashboard.component.html',
  styleUrl: './home-dashboard.component.scss',
})
export class HomeDashboardComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);

  readonly metrics = this.portfolio.metrics;
  readonly holdings = this.portfolio.holdings;
  readonly loading = this.portfolio.loading;
  readonly incomeGoalProgress = this.portfolio.incomeGoalProgress;
  readonly settings = this.portfolio.settings;
  readonly lastUpdated = this.portfolio.lastUpdated;

  readonly allocationChart = computed<ChartData<'doughnut'>>(() => {
    const allocation = this.portfolio.allocationByTicker();
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    return {
      labels: allocation.map((a) => a.ticker),
      datasets: [
        {
          data: allocation.map((a) => a.value),
          backgroundColor: allocation.map((_, i) => colors[i % colors.length]),
          borderWidth: 0,
        },
      ],
    };
  });

  readonly allocationOptions = {
    plugins: {
      legend: { position: 'right' as const, labels: { color: '#94a3b8', boxWidth: 12 } },
      tooltip: {
        callbacks: {
          label: (ctx: { label?: string; parsed: number }) =>
            `${ctx.label}: $${ctx.parsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
    },
  };

  ngOnInit(): void {
    void this.portfolio.init();
  }

  async refresh(): Promise<void> {
    await this.portfolio.refreshMarketData();
  }
}
