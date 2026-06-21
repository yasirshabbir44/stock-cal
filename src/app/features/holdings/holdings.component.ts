import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DecimalPipe, NgTemplateOutlet, PercentPipe } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { injectVirtualizer } from '@tanstack/angular-virtual';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SaveFeedbackService } from '../../core/services/save-feedback.service';
import { POPULAR_STOCKS } from '../../core/constants/popular-stocks';
import { getSectorForTicker } from '../../core/constants/stock-sectors';
import { StockSuggestion } from '../../core/models/stock-search.model';
import {
  PortfolioTableRow,
  SourceFilter,
} from '../../core/models/portfolio-table-row.model';
import { DividendFrequency, inferDividendFrequency } from '../../core/utils/dividend-frequency.util';
import { StockIconComponent } from '../../shared/components/stock-icon.component';
import { TickerAutocompleteComponent } from '../../shared/components/ticker-autocomplete.component';
import { FacetedFilterBarComponent } from '../../shared/components/faceted-filter-bar.component';
import { VirtualRowMeasureDirective } from '../../shared/directives/virtual-row-measure.directive';
import { GetStartedGuideComponent } from '../../shared/components/get-started-guide.component';

type SortKey = 'ticker' | 'value' | 'income' | 'custom';

/** Enable windowing once the filtered list is large enough to stress the DOM. */
const VIRTUAL_SCROLL_MIN_ROWS = 50;

interface QuickPick {
  ticker: string;
  name: string;
  hint: string;
}

@Component({
  selector: 'app-holdings',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyPipe,
    DecimalPipe,
    PercentPipe,
    NgTemplateOutlet,
    TickerAutocompleteComponent,
    StockIconComponent,
    FacetedFilterBarComponent,
    VirtualRowMeasureDirective,
    RouterLink,
    GetStartedGuideComponent,
    DragDropModule,
  ],
  templateUrl: './holdings.component.html',
  styleUrl: './holdings.component.scss',
})
export class HoldingsComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmDialogService);
  readonly feedback = inject(SaveFeedbackService);

  readonly holdings = this.portfolio.holdings;
  readonly watchlist = this.portfolio.watchlist;
  readonly dividendSchedules = this.portfolio.dividendSchedules;
  readonly loading = this.portfolio.loading;
  readonly usingLiveQuotes = this.portfolio.usingLiveQuotes;
  readonly hasActiveSimulations = this.portfolio.hasActiveSimulations;
  readonly baseMetrics = this.portfolio.baseMetrics;
  readonly metrics = this.portfolio.metrics;

  private readonly tickerAutocomplete = viewChild(TickerAutocompleteComponent);
  private readonly tableScroll = viewChild<ElementRef<HTMLDivElement>>('tableScroll');

  ticker = '';
  selectedStock: StockSuggestion | null = null;
  shares: number | null = null;
  purchasePrice: number | null = null;
  searchQuery = signal('');
  sourceFilter = signal<SourceFilter>('all');
  selectedSectors = signal<Set<string>>(new Set());
  selectedFrequencies = signal<Set<DividendFrequency>>(new Set());
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

  readonly allTableRows = computed(() => {
    const schedules = this.dividendSchedules();
    const rows: PortfolioTableRow[] = [];

    for (const holding of this.holdings()) {
      rows.push({
        id: holding.id,
        ticker: holding.ticker,
        companyName: holding.companyName,
        logoUrl: holding.logoUrl,
        source: 'portfolio',
        sector: getSectorForTicker(holding.ticker),
        dividendFrequency: inferDividendFrequency(holding.ticker, schedules),
        currentPrice: holding.currentPrice,
        annualDividendPerShare: holding.annualDividendPerShare,
        shares: holding.shares,
        purchasePrice: holding.purchasePrice,
      });
    }

    for (const item of this.watchlist()) {
      rows.push({
        id: item.id,
        ticker: item.ticker,
        companyName: item.companyName,
        logoUrl: item.logoUrl,
        source: 'watchlist',
        sector: getSectorForTicker(item.ticker),
        dividendFrequency: inferDividendFrequency(item.ticker, schedules),
        currentPrice: item.currentPrice,
        annualDividendPerShare: item.annualDividendPerShare,
        targetPrice: item.targetPrice,
      });
    }

    return rows;
  });

  readonly availableSectors = computed(() => {
    const sectors = new Set(this.allTableRows().map((row) => row.sector));
    return [...sectors].sort((a, b) => a.localeCompare(b));
  });

  readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toUpperCase();
    const source = this.sourceFilter();
    const sectors = this.selectedSectors();
    const frequencies = this.selectedFrequencies();

    let list = this.allTableRows();

    if (source !== 'all') {
      list = list.filter((row) => row.source === source);
    }

    if (sectors.size > 0) {
      list = list.filter((row) => sectors.has(row.sector));
    }

    if (frequencies.size > 0) {
      list = list.filter((row) => frequencies.has(row.dividendFrequency));
    }

    if (query) {
      list = list.filter(
        (row) =>
          row.ticker.includes(query) ||
          (row.companyName?.toUpperCase().includes(query) ?? false),
      );
    }

    const key = this.sortKey();
    if (key === 'custom') {
      const order = new Map(this.holdings().map((holding, index) => [holding.id, index]));
      return [...list].sort((a, b) => {
        const orderA = a.source === 'portfolio' ? (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        const orderB = b.source === 'portfolio' ? (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.ticker.localeCompare(b.ticker);
      });
    }

    return [...list].sort((a, b) => {
      if (key === 'ticker') {
        return a.ticker.localeCompare(b.ticker);
      }

      const incomeA = a.annualDividendPerShare * (a.shares ?? 0);
      const incomeB = b.annualDividendPerShare * (b.shares ?? 0);
      if (key === 'income') {
        return incomeB - incomeA;
      }

      const valueA = a.currentPrice * (a.shares ?? 0);
      const valueB = b.currentPrice * (b.shares ?? 0);
      return valueB - valueA;
    });
  });

  readonly hasAnyPositions = computed(
    () => this.holdings().length > 0 || this.watchlist().length > 0,
  );

  readonly useVirtualScroll = computed(
    () => this.sortKey() !== 'custom' && this.filteredRows().length >= VIRTUAL_SCROLL_MIN_ROWS,
  );

  readonly dragEnabled = computed(
    () =>
      this.sortKey() === 'custom' &&
      this.sourceFilter() !== 'watchlist' &&
      !this.searchQuery().trim() &&
      this.selectedSectors().size === 0 &&
      this.selectedFrequencies().size === 0 &&
      !this.editingId() &&
      this.holdings().length > 1,
  );

  readonly virtualizer = injectVirtualizer(() => ({
    scrollElement: this.tableScroll(),
    count: this.filteredRows().length,
    estimateSize: (index) => this.estimateRowSize(this.filteredRows()[index]),
    overscan: 10,
    enabled: this.useVirtualScroll(),
    getItemKey: (index) => this.filteredRows()[index]?.id ?? index,
  }));

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
    }, false);
    this.feedback.persisted(`holding-${id}`);
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

  async removeFromWatchlist(id: string, ticker: string): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: 'Remove from watchlist',
      message: `Remove ${ticker} from your watchlist?`,
      confirmLabel: 'Remove',
      danger: true,
    });

    if (confirmed) {
      await this.portfolio.removeWatchlistItem(id);
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

  isRowDraggable(row: PortfolioTableRow): boolean {
    return this.dragEnabled() && row.source === 'portfolio';
  }

  async onHoldingDrop(event: CdkDragDrop<PortfolioTableRow[]>): Promise<void> {
    if (!this.dragEnabled() || event.previousIndex === event.currentIndex) {
      return;
    }

    const portfolioCount = this.filteredRows().filter((row) => row.source === 'portfolio').length;
    if (
      event.previousIndex >= portfolioCount ||
      event.currentIndex >= portfolioCount
    ) {
      return;
    }

    const portfolioIds = this.filteredRows()
      .filter((row) => row.source === 'portfolio')
      .map((row) => row.id);

    moveItemInArray(portfolioIds, event.previousIndex, event.currentIndex);
    await this.portfolio.reorderHoldings(portfolioIds);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  onSourceFilterChange(source: SourceFilter): void {
    this.sourceFilter.set(source);
  }

  toggleSector(sector: string): void {
    this.selectedSectors.update((current) => {
      const next = new Set(current);
      if (next.has(sector)) {
        next.delete(sector);
      } else {
        next.add(sector);
      }
      return next;
    });
  }

  toggleFrequency(frequency: DividendFrequency): void {
    this.selectedFrequencies.update((current) => {
      const next = new Set(current);
      if (next.has(frequency)) {
        next.delete(frequency);
      } else {
        next.add(frequency);
      }
      return next;
    });
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.sourceFilter.set('all');
    this.selectedSectors.set(new Set());
    this.selectedFrequencies.set(new Set());
  }

  prefillFromWatchlist(row: PortfolioTableRow): void {
    this.ticker = row.ticker;
    this.selectedStock = {
      symbol: row.ticker,
      name: row.companyName ?? row.ticker,
      type: 'Common Stock',
      logoUrl: row.logoUrl,
    };
    this.purchasePrice = row.currentPrice;
    this.tickerAutocomplete()?.focus();
  }

  rowValue(row: PortfolioTableRow): number {
    return row.currentPrice * (row.shares ?? 0);
  }

  rowIncome(row: PortfolioTableRow): number {
    return row.annualDividendPerShare * (row.shares ?? 0);
  }

  rowYield(row: PortfolioTableRow): number {
    return row.currentPrice > 0 ? row.annualDividendPerShare / row.currentPrice : 0;
  }

  isSimulating(id: string): boolean {
    return this.portfolio.isSimulating(id);
  }

  additionalShares(id: string): number {
    return this.portfolio.getSimulation(id)?.additionalShares ?? 10;
  }

  toggleSimulate(id: string): void {
    this.portfolio.toggleSimulation(id);
  }

  onAdditionalSharesChange(id: string, value: number | string): void {
    const shares = typeof value === 'string' ? parseFloat(value) : value;
    if (!Number.isFinite(shares)) {
      return;
    }
    this.portfolio.setSimulationAdditionalShares(id, shares);
    this.feedback.flash(`sim-${id}`);
  }

  simulatedShares(row: PortfolioTableRow): number {
    const sim = this.portfolio.getSimulation(row.id);
    if (!sim?.enabled || !sim.additionalShares || row.shares == null) {
      return row.shares ?? 0;
    }
    return row.shares + sim.additionalShares;
  }

  simulatedIncome(row: PortfolioTableRow): number {
    return row.annualDividendPerShare * this.simulatedShares(row);
  }

  clearAllSimulations(): void {
    this.portfolio.clearAllSimulations();
  }

  frequencyLabel(frequency: DividendFrequency): string {
    return frequency === 'monthly' ? 'Monthly' : 'Quarterly';
  }

  measureVirtualRow = (element: Element): void => {
    this.virtualizer.measureElement(element);
  };

  private estimateRowSize(row: PortfolioTableRow | undefined): number {
    if (!row) {
      return 56;
    }
    if (row.source === 'portfolio' && this.editingId() === row.id) {
      return 56;
    }
    if (row.source === 'portfolio' && this.isSimulating(row.id)) {
      return 108;
    }
    return 56;
  }
}
