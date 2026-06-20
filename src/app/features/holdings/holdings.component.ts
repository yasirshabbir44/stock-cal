import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';

type SortKey = 'ticker' | 'value' | 'income';

interface QuickPick {
  ticker: string;
  hint: string;
}

@Component({
  selector: 'app-holdings',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DecimalPipe],
  templateUrl: './holdings.component.html',
  styleUrl: './holdings.component.scss',
})
export class HoldingsComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);
  private readonly route = inject(ActivatedRoute);

  readonly holdings = this.portfolio.holdings;
  readonly loading = this.portfolio.loading;

  ticker = '';
  shares: number | null = null;
  purchasePrice: number | null = null;
  searchQuery = '';
  sortKey = signal<SortKey>('value');
  editingId = signal<string | null>(null);
  editShares: number | null = null;
  editPrice: number | null = null;
  submitting = signal(false);

  readonly quickPicks: QuickPick[] = [
    { ticker: 'AAPL', hint: 'Growth' },
    { ticker: 'MSFT', hint: 'Growth' },
    { ticker: 'SCHD', hint: 'Dividend ETF' },
    { ticker: 'O', hint: 'Monthly REIT' },
    { ticker: 'KO', hint: 'Dividend' },
    { ticker: 'JNJ', hint: 'Dividend' },
  ];

  readonly filteredHoldings = computed(() => {
    const query = this.searchQuery.trim().toUpperCase();
    let list = this.holdings();

    if (query) {
      list = list.filter((h) => h.ticker.includes(query));
    }

    const key = this.sortKey();
    return [...list].sort((a, b) => {
      if (key === 'ticker') {
        return a.ticker.localeCompare(b.ticker);
      }
      if (key === 'income') {
        return b.annualDividendPerShare * b.shares - a.annualDividendPerShare * a.shares;
      }
      return b.currentPrice * b.shares - a.currentPrice * a.shares;
    });
  });

  ngOnInit(): void {
    void this.portfolio.init();

    this.route.queryParams.subscribe((params) => {
      if (params['ticker']) {
        this.ticker = String(params['ticker']).toUpperCase();
      }
    });
  }

  pickStock(ticker: string): void {
    this.ticker = ticker;
    document.getElementById('ticker-input')?.focus();
  }

  async onSubmit(): Promise<void> {
    if (!this.ticker.trim() || !this.shares || !this.purchasePrice) {
      return;
    }

    if (this.shares <= 0 || this.purchasePrice <= 0) {
      return;
    }

    this.submitting.set(true);

    try {
      await this.portfolio.addHolding({
        ticker: this.ticker,
        shares: this.shares,
        purchasePrice: this.purchasePrice,
      });

      this.ticker = '';
      this.shares = null;
      this.purchasePrice = null;
    } finally {
      this.submitting.set(false);
    }
  }

  startEdit(id: string, shares: number, purchasePrice: number): void {
    this.editingId.set(id);
    this.editShares = shares;
    this.editPrice = purchasePrice;
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editShares = null;
    this.editPrice = null;
  }

  async saveEdit(id: string): Promise<void> {
    if (!this.editShares || !this.editPrice || this.editShares <= 0 || this.editPrice <= 0) {
      return;
    }

    await this.portfolio.updateHolding(id, {
      shares: this.editShares,
      purchasePrice: this.editPrice,
    });
    this.cancelEdit();
  }

  async remove(id: string, ticker: string): Promise<void> {
    if (confirm(`Remove ${ticker} from your portfolio?`)) {
      await this.portfolio.removeHolding(id);
    }
  }

  async refresh(): Promise<void> {
    await this.portfolio.refreshMarketData();
  }

  setSort(key: SortKey): void {
    this.sortKey.set(key);
  }
}
