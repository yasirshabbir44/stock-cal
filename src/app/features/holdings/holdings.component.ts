import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { POPULAR_STOCKS } from '../../core/constants/popular-stocks';
import { StockSuggestion } from '../../core/models/stock-search.model';
import { StockIconComponent } from '../../shared/components/stock-icon.component';
import { TickerAutocompleteComponent } from '../../shared/components/ticker-autocomplete.component';

type SortKey = 'ticker' | 'value' | 'income';

interface QuickPick {
  ticker: string;
  name: string;
  hint: string;
}

@Component({
  selector: 'app-holdings',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DecimalPipe, TickerAutocompleteComponent, StockIconComponent],
  templateUrl: './holdings.component.html',
  styleUrl: './holdings.component.scss',
})
export class HoldingsComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmDialogService);

  readonly holdings = this.portfolio.holdings;
  readonly loading = this.portfolio.loading;

  private readonly tickerAutocomplete = viewChild(TickerAutocompleteComponent);

  ticker = '';
  selectedStock: StockSuggestion | null = null;
  shares: number | null = null;
  purchasePrice: number | null = null;
  searchQuery = '';
  sortKey = signal<SortKey>('value');
  editingId = signal<string | null>(null);
  editShares: number | null = null;
  editPrice: number | null = null;
  submitting = signal(false);
  refreshingId = signal<string | null>(null);
  formErrors: { ticker?: string; shares?: string; purchasePrice?: string } = {};

  readonly quickPicks: QuickPick[] = POPULAR_STOCKS.slice(0, 6).map((stock) => ({
    ticker: stock.symbol,
    name: stock.name,
    hint: stock.type,
  }));

  readonly filteredHoldings = computed(() => {
    const query = this.searchQuery.trim().toUpperCase();
    let list = this.holdings();

    if (query) {
      list = list.filter(
        (h) =>
          h.ticker.includes(query) ||
          (h.companyName?.toUpperCase().includes(query) ?? false),
      );
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

  pickStock(stock: QuickPick): void {
    this.ticker = stock.ticker;
    this.selectedStock = {
      symbol: stock.ticker,
      name: stock.name,
      type: stock.hint,
    };
    this.tickerAutocomplete()?.focus();
  }

  onStockSelected(stock: StockSuggestion): void {
    this.selectedStock = stock;
  }

  validateForm(): boolean {
    this.formErrors = {};

    const ticker = this.ticker.trim().toUpperCase();
    if (!ticker || !TickerAutocompleteComponent.isValidTicker(ticker)) {
      this.formErrors.ticker = 'Select or enter a valid ticker symbol';
    }
    if (!this.shares || this.shares <= 0) {
      this.formErrors.shares = 'Shares must be greater than 0';
    }
    if (!this.purchasePrice || this.purchasePrice <= 0) {
      this.formErrors.purchasePrice = 'Price must be greater than 0';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  async onSubmit(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    this.submitting.set(true);

    try {
      await this.portfolio.addHolding({
        ticker: this.ticker.trim().toUpperCase(),
        companyName: this.selectedStock?.name,
        logoUrl: this.selectedStock?.logoUrl,
        shares: this.shares!,
        purchasePrice: this.purchasePrice!,
      });

      this.ticker = '';
      this.selectedStock = null;
      this.shares = null;
      this.purchasePrice = null;
      this.formErrors = {};
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
    const confirmed = await this.confirm.confirm({
      title: 'Remove holding',
      message: `Remove ${ticker} from your portfolio? This cannot be undone.`,
      confirmLabel: 'Remove',
      danger: true,
    });

    if (confirmed) {
      await this.portfolio.removeHolding(id);
    }
  }

  async refresh(): Promise<void> {
    await this.portfolio.refreshMarketData();
  }

  async refreshOne(id: string): Promise<void> {
    this.refreshingId.set(id);
    try {
      await this.portfolio.refreshSingleHolding(id);
    } finally {
      this.refreshingId.set(null);
    }
  }

  setSort(key: SortKey): void {
    this.sortKey.set(key);
  }
}
