import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartConfiguration, ChartData } from 'chart.js';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { ThemeService } from '../../core/services/theme.service';
import { ChartComponent } from '../../shared/components/chart.component';
import { QuickAddHoldingComponent } from '../../shared/components/quick-add-holding.component';

@Component({
  selector: 'app-home-dashboard',
  standalone: true,
  imports: [ChartComponent, RouterLink, CurrencyPipe, DecimalPipe, DatePipe, QuickAddHoldingComponent],
  templateUrl: './home-dashboard.component.html',
  styleUrl: './home-dashboard.component.scss',
})
export class HomeDashboardComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);
  private readonly theme = inject(ThemeService);

  readonly metrics = this.portfolio.metrics;
  readonly holdings = this.portfolio.holdings;
  readonly loading = this.portfolio.loading;
  readonly incomeGoalProgress = this.portfolio.incomeGoalProgress;
  readonly settings = this.portfolio.settings;
  readonly lastUpdated = this.portfolio.lastUpdated;
  readonly showQuickAdd = signal(false);
  readonly quickAddTicker = signal('');

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

  readonly allocationOptions = computed<ChartConfiguration<'doughnut'>['options']>(() => ({
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 16,
          color: this.theme.theme() === 'dark' ? '#94a3b8' : '#64748b',
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label?: string; parsed: number }) =>
            `${ctx.label}: $${ctx.parsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
    },
  }));

  ngOnInit(): void {
    void this.portfolio.init();
  }

  openQuickAdd(ticker = ''): void {
    this.quickAddTicker.set(ticker);
    this.showQuickAdd.set(true);
  }

  closeQuickAdd(): void {
    this.showQuickAdd.set(false);
    this.quickAddTicker.set('');
  }

  async refresh(): Promise<void> {
    await this.portfolio.refreshMarketData();
  }
}
