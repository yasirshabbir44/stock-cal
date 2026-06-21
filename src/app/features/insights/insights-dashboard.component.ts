import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ChartConfiguration, ChartData } from 'chart.js';
import { METRIC_FORMULAS } from '../../core/constants/metric-formulas';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { ThemeService } from '../../core/services/theme.service';
import { ChartComponent } from '../../shared/components/chart.component';
import { MetricCardComponent } from '../../shared/components/metric-card.component';
import { StockIconComponent } from '../../shared/components/stock-icon.component';
import { TickerAutocompleteComponent } from '../../shared/components/ticker-autocomplete.component';
import { YieldTrendCellComponent } from '../../shared/components/yield-trend-cell.component';
import { GetStartedGuideComponent } from '../../shared/components/get-started-guide.component';
import { SaveFeedbackService } from '../../core/services/save-feedback.service';
import { computeDividendYieldPercent } from '../../core/calculations/dividend-yield.lib';
import { StockSuggestion } from '../../core/models/stock-search.model';

@Component({
  selector: 'app-insights-dashboard',
  standalone: true,
  imports: [
    FormsModule,
    ChartComponent,
    MetricCardComponent,
    StockIconComponent,
    TickerAutocompleteComponent,
    YieldTrendCellComponent,
    RouterLink,
    CurrencyPipe,
    DecimalPipe,
    GetStartedGuideComponent,
  ],
  templateUrl: './insights-dashboard.component.html',
  styleUrl: './insights-dashboard.component.scss',
})
export class InsightsDashboardComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);
  private readonly theme = inject(ThemeService);
  readonly feedback = inject(SaveFeedbackService);

  readonly formulas = METRIC_FORMULAS;
  readonly metrics = this.portfolio.metrics;
  readonly insights = this.portfolio.portfolioInsights;
  readonly watchlist = this.portfolio.watchlist;
  readonly loading = this.portfolio.loading;

  readonly watchTicker = signal('');
  readonly watchTargetPrice = signal<number | undefined>(undefined);
  readonly watchSelectedStock = signal<StockSuggestion | null>(null);
  readonly promotingId = signal<string | null>(null);
  readonly promoteShares = signal<number | null>(null);
  readonly promotePrice = signal<number | null>(null);

  readonly sectorChart = computed<ChartData<'doughnut'>>(() => {
    const sectors = this.insights()?.sectorAllocation ?? [];
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b'];

    return {
      labels: sectors.map((s) => s.sector),
      datasets: [
        {
          data: sectors.map((s) => s.value),
          backgroundColor: sectors.map((_, i) => colors[i % colors.length]),
          borderWidth: 0,
        },
      ],
    };
  });

  readonly sectorOptions = computed<ChartConfiguration<'doughnut'>['options']>(() => ({
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 12,
          color: this.theme.theme() === 'dark' ? '#94a3b8' : '#64748b',
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label?: string; parsed: number }) =>
            `${ctx.label}: $${ctx.parsed.toLocaleString(undefined, { minimumFractionDigits: 0 })}`,
        },
      },
    },
  }));

  ngOnInit(): void {
    void this.portfolio.init();
    void this.portfolio.ensureProjectionsLoaded();
  }

  onWatchTickerSelected(suggestion: StockSuggestion): void {
    this.watchTicker.set(suggestion.symbol);
    this.watchSelectedStock.set(suggestion);
  }

  async addToWatchlist(): Promise<void> {
    const ticker = this.watchTicker().trim();
    if (!ticker) {
      return;
    }

    await this.portfolio.addWatchlistItem({
      ticker,
      companyName: this.watchSelectedStock()?.name,
      logoUrl: this.watchSelectedStock()?.logoUrl,
      targetPrice: this.watchTargetPrice(),
    });

    this.feedback.flash('watchlist-form');

    this.watchTicker.set('');
    this.watchTargetPrice.set(undefined);
    this.watchSelectedStock.set(null);
  }

  startPromote(id: string, currentPrice: number): void {
    this.promotingId.set(id);
    this.promoteShares.set(null);
    this.promotePrice.set(currentPrice);
  }

  cancelPromote(): void {
    this.promotingId.set(null);
    this.promoteShares.set(null);
    this.promotePrice.set(null);
  }

  async confirmPromote(id: string): Promise<void> {
    const shares = this.promoteShares();
    const price = this.promotePrice();
    if (!shares || !price || shares <= 0 || price <= 0) {
      return;
    }

    await this.portfolio.promoteWatchlistToHolding(id, shares, price);
    this.feedback.flash(`promote-${id}`);
    this.cancelPromote();
  }

  async removeFromWatchlist(id: string): Promise<void> {
    await this.portfolio.removeWatchlistItem(id);
  }

  async refreshWatchlist(): Promise<void> {
    await this.portfolio.refreshWatchlist();
  }

  targetDistance(item: { currentPrice: number; targetPrice?: number }): number | null {
    if (!item.targetPrice || item.targetPrice <= 0) {
      return null;
    }
    return ((item.currentPrice - item.targetPrice) / item.targetPrice) * 100;
  }

  dividendYield(item: { annualDividendPerShare: number; currentPrice: number }): number {
    return computeDividendYieldPercent(item.annualDividendPerShare, item.currentPrice);
  }

  healthScoreColor(score: number): string {
    if (score >= 80) {
      return 'var(--success)';
    }
    if (score >= 65) {
      return 'var(--accent-wealth)';
    }
    if (score >= 45) {
      return '#f59e0b';
    }
    return 'var(--danger)';
  }
}
