import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { StockAnalysisService } from '../../core/services/stock-analysis.service';
import {
  StockAnalysisReport,
  AnalysisRating,
  SuggestionSeverity,
  HealthStatus,
} from '../../core/models/stock-analysis.model';
import { StockSuggestion } from '../../core/models/stock-search.model';
import { POPULAR_STOCKS } from '../../core/constants/popular-stocks';
import { MetricCardComponent } from '../../shared/components/metric-card.component';
import { StockIconComponent } from '../../shared/components/stock-icon.component';
import { TickerAutocompleteComponent } from '../../shared/components/ticker-autocomplete.component';

type ResearchTab = 'overview' | 'health' | 'income' | 'analysis';

interface QuickPickGroup {
  label: string;
  hint: string;
  symbols: string[];
}

@Component({
  selector: 'app-stock-research',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DecimalPipe,
    DatePipe,
    MetricCardComponent,
    StockIconComponent,
    TickerAutocompleteComponent,
  ],
  templateUrl: './stock-research.component.html',
  styleUrl: './stock-research.component.scss',
})
export class StockResearchComponent implements OnInit {
  private readonly analysisService = inject(StockAnalysisService);
  private readonly portfolio = inject(PortfolioFacadeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly searchTicker = signal('');
  readonly selectedStock = signal<StockSuggestion | null>(null);
  readonly report = signal<StockAnalysisReport | null>(null);
  readonly analyzing = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeTab = signal<ResearchTab>('overview');

  readonly quickPickGroups: QuickPickGroup[] = [
    { label: 'Dividend favorites', hint: 'Reliable income', symbols: ['JNJ', 'KO', 'O', 'SCHD'] },
    { label: 'Blue chips', hint: 'Large & stable', symbols: ['AAPL', 'MSFT', 'JPM', 'PG'] },
    { label: 'ETFs', hint: 'Instant diversification', symbols: ['SCHD', 'VYM', 'SPY', 'VTI'] },
  ];

  readonly holdings = this.portfolio.holdings;
  readonly portfolioTickers = computed(() => this.holdings().map((h) => h.ticker));

  readonly monthlyIncomePer10k = computed(() => {
    const f = this.report()?.fundamentals;
    if (!f || f.dividendYieldPercent <= 0) return 0;
    return (10_000 * f.dividendYieldPercent) / 100 / 12;
  });

  readonly week52Position = computed(() => {
    const f = this.report()?.fundamentals;
    if (!f?.week52High || !f?.week52Low || f.currentPrice <= 0) return null;
    const range = f.week52High - f.week52Low;
    if (range <= 0) return null;
    return ((f.currentPrice - f.week52Low) / range) * 100;
  });

  ngOnInit(): void {
    void this.portfolio.init();

    this.route.paramMap.subscribe((params) => {
      const symbol = params.get('symbol');
      if (symbol) {
        this.searchTicker.set(symbol.toUpperCase());
        void this.runAnalysis(symbol);
      }
    });
  }

  onStockSelected(suggestion: StockSuggestion): void {
    this.searchTicker.set(suggestion.symbol);
    this.selectedStock.set(suggestion);
    void this.analyze();
  }

  setTab(tab: ResearchTab): void {
    this.activeTab.set(tab);
  }

  async analyze(): Promise<void> {
    const ticker = this.searchTicker().trim();
    if (!ticker) return;

    this.router.navigate(['/research', ticker.toUpperCase()]);
    await this.runAnalysis(ticker);
  }

  async analyzeSymbol(symbol: string): Promise<void> {
    this.searchTicker.set(symbol);
    this.router.navigate(['/research', symbol.toUpperCase()]);
    await this.runAnalysis(symbol);
  }

  private async runAnalysis(ticker: string): Promise<void> {
    const symbol = ticker.toUpperCase().trim();
    if (!symbol) return;

    this.analyzing.set(true);
    this.error.set(null);
    this.report.set(null);
    this.activeTab.set('overview');

    try {
      const result = await this.analysisService.analyze(
        symbol,
        this.selectedStock(),
        this.portfolioTickers(),
      );
      this.report.set(result);
      this.selectedStock.set(result.suggestion);
    } catch {
      this.error.set(`Could not analyze ${symbol}. Try another ticker or check your connection.`);
    } finally {
      this.analyzing.set(false);
    }
  }

  async addToWatchlist(): Promise<void> {
    const r = this.report();
    if (!r) return;

    await this.portfolio.addWatchlistItem({
      ticker: r.suggestion.symbol,
      companyName: r.suggestion.name,
      logoUrl: r.suggestion.logoUrl,
      targetPrice: r.fundamentals.currentPrice * 0.95,
    });
  }

  formatMarketCap(millions: number): string {
    if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`;
    if (millions >= 1_000) return `$${(millions / 1_000).toFixed(1)}B`;
    return `$${millions.toFixed(0)}M`;
  }

  formatMetric(value: number | undefined, suffix = '', fallback = '—'): string {
    if (value == null) return fallback;
    return `${value.toFixed(suffix === '%' ? 1 : suffix === 'x' ? 1 : 2)}${suffix}`;
  }

  ratingLabel(rating: AnalysisRating): string {
    const labels: Record<AnalysisRating, string> = {
      bullish: 'Good',
      neutral: 'OK',
      bearish: 'Weak',
      caution: 'Caution',
    };
    return labels[rating];
  }

  severityIcon(severity: SuggestionSeverity): string {
    const icons: Record<SuggestionSeverity, string> = {
      positive: '✓',
      neutral: '○',
      warning: '!',
      critical: '✕',
    };
    return icons[severity];
  }

  healthStatusLabel(status: HealthStatus): string {
    const labels: Record<HealthStatus, string> = {
      good: 'Good',
      fair: 'Fair',
      poor: 'Weak',
      unknown: 'N/A',
    };
    return labels[status];
  }

  healthStatusIcon(status: HealthStatus): string {
    const icons: Record<HealthStatus, string> = {
      good: '✓',
      fair: '–',
      poor: '!',
      unknown: '?',
    };
    return icons[status];
  }

  categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      income: 'Income',
      valuation: 'Value',
      risk: 'Risk',
      momentum: 'Price',
      quality: 'Quality',
      financial: 'Financial',
    };
    return labels[category] ?? category;
  }

  scoreColor(score: number): string {
    if (score >= 80) return 'var(--success)';
    if (score >= 65) return 'var(--accent-income)';
    if (score >= 45) return 'var(--accent-wealth)';
    if (score >= 30) return '#f59e0b';
    return 'var(--danger)';
  }

  pillarBarColor(status: HealthStatus): string {
    if (status === 'good') return 'var(--success)';
    if (status === 'fair') return '#f59e0b';
    if (status === 'poor') return 'var(--danger)';
    return 'var(--text-muted)';
  }
}
