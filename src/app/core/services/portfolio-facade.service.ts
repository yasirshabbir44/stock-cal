import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Holding, HoldingInput } from '../models/holding.model';
import { DividendSchedule } from '../models/dividend-schedule.model';
import { PortfolioSnapshot } from '../models/portfolio-snapshot.model';
import { PortfolioMetrics } from '../models/portfolio-metrics.model';
import { PortfolioInsights } from '../models/portfolio-insights.model';
import { WatchlistItem, WatchlistItemInput } from '../models/watchlist-item.model';
import { DEFAULT_SETTINGS, PortfolioExport, UserSettings } from '../models/user-settings.model';
import { PortfolioDbService } from './portfolio-db.service';
import { PortfolioCalculatorService } from './portfolio-calculator.service';
import { StockApiService } from './stock-api.service';
import { ToastService } from './toast.service';
import { getStockLogoUrl } from '../utils/stock-logo.util';

export interface HoldingUpdate {
  shares: number;
  purchasePrice: number;
}

@Injectable({ providedIn: 'root' })
export class PortfolioFacadeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly db = inject(PortfolioDbService);
  private readonly calculator = inject(PortfolioCalculatorService);
  private readonly stockApi = inject(StockApiService);
  private readonly toast = inject(ToastService);

  private initialized = false;
  private initPromise: Promise<void> | null = null;

  readonly holdings = signal<Holding[]>([]);
  readonly watchlist = signal<WatchlistItem[]>([]);
  readonly dividendSchedules = signal<DividendSchedule[]>([]);
  readonly portfolioSnapshots = signal<PortfolioSnapshot[]>([]);
  readonly settings = signal<UserSettings>({ ...DEFAULT_SETTINGS });
  readonly metrics = signal<PortfolioMetrics | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly allocationByTicker = computed(() => {
    const metrics = this.metrics();
    if (!metrics || metrics.totalPortfolioValue === 0) {
      return [];
    }

    return metrics.holdings
      .map((h) => ({
        ticker: h.holding.ticker,
        value: h.assetValue,
        percent: (h.assetValue / metrics.totalPortfolioValue) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  });

  readonly portfolioInsights = computed<PortfolioInsights | null>(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return null;
    }
    return this.calculator.computePortfolioInsights(metrics);
  });

  readonly incomeGoalProgress = computed(() => {
    const goal = this.settings().monthlyIncomeGoal;
    const monthly = this.metrics()?.projectedMonthlyIncome ?? 0;
    if (goal <= 0) {
      return 0;
    }
    return Math.min(100, (monthly / goal) * 100);
  });

  readonly portfolioMilestones = computed(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return [];
    }
    return this.calculator.computePortfolioMilestones(metrics, this.settings().monthlyIncomeGoal);
  });

  readonly achievedMilestones = computed(() =>
    this.portfolioMilestones().filter((m) => m.achieved),
  );

  readonly benchmarkComparison = computed(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return null;
    }
    return this.calculator.computeBenchmarkComparison(
      this.portfolioSnapshots(),
      metrics.totalAssetGrowthPercent,
    );
  });

  readonly lastUpdated = computed(() => {
    const holdings = this.holdings();
    if (holdings.length === 0) {
      return null;
    }
    return holdings.reduce((latest, h) => (h.lastUpdated > latest ? h.lastUpdated : latest), holdings[0].lastUpdated);
  });

  async init(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadPortfolio();
    return this.initPromise;
  }

  private async loadPortfolio(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const [holdings, schedules, snapshots, settings, watchlist] = await Promise.all([
        this.db.getAllHoldings(),
        this.db.getAllDividendSchedules(),
        this.db.getPortfolioSnapshots(),
        this.db.getSettings(),
        this.db.getAllWatchlistItems(),
      ]);

      this.holdings.set(holdings);
      this.dividendSchedules.set(schedules);
      this.portfolioSnapshots.set(snapshots);
      this.settings.set(settings);
      this.watchlist.set(watchlist);
      this.refreshMetrics();
      this.initialized = true;

      if (holdings.length > 0) {
        await this.refreshMarketData(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load portfolio';
      this.error.set(message);
      this.toast.error(message);
    } finally {
      this.loading.set(false);
    }
  }

  async addHolding(input: HoldingInput): Promise<void> {
    const ticker = input.ticker.toUpperCase().trim();
    const existing = this.holdings().find((h) => h.ticker === ticker);

    if (existing) {
      const totalShares = existing.shares + input.shares;
      const weightedPrice =
        (existing.purchasePrice * existing.shares + input.purchasePrice * input.shares) / totalShares;

      await this.updateHolding(existing.id, { shares: totalShares, purchasePrice: weightedPrice });
      this.toast.success(`Merged ${input.shares} shares into ${ticker}`);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const quote = await this.stockApi.fetchQuote(ticker);
      const schedules = await this.stockApi.fetchUpcomingDividends(ticker);
      const now = new Date().toISOString();

      const holding: Holding = {
        id: crypto.randomUUID(),
        ticker,
        companyName: input.companyName,
        logoUrl: input.logoUrl ?? getStockLogoUrl(ticker),
        shares: input.shares,
        purchasePrice: input.purchasePrice,
        currentPrice: quote.currentPrice,
        annualDividendPerShare: quote.annualDividendPerShare,
        lastUpdated: now,
        createdAt: now,
      };

      await this.db.saveHolding(holding);
      await this.db.replaceDividendSchedulesForTicker(ticker, schedules);

      this.holdings.update((list) => [...list, holding]);
      this.dividendSchedules.update((list) => [
        ...list.filter((s) => s.ticker !== ticker),
        ...schedules,
      ]);

      await this.recordSnapshot();
      this.refreshMetrics();
      this.toast.success(`${ticker} added to portfolio`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add holding';
      this.error.set(message);
      this.toast.error(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateHolding(id: string, update: HoldingUpdate): Promise<void> {
    const holding = this.holdings().find((h) => h.id === id);
    if (!holding) {
      return;
    }

    const updated: Holding = {
      ...holding,
      shares: update.shares,
      purchasePrice: update.purchasePrice,
    };

    await this.db.saveHolding(updated);
    this.holdings.update((list) => list.map((h) => (h.id === id ? updated : h)));
    await this.recordSnapshot();
    this.refreshMetrics();
    this.toast.success(`${holding.ticker} updated`);
  }

  async removeHolding(id: string): Promise<void> {
    const holding = this.holdings().find((h) => h.id === id);
    if (!holding) {
      return;
    }

    await this.db.deleteHolding(id);
    this.holdings.update((list) => list.filter((h) => h.id !== id));
    this.dividendSchedules.update((list) => list.filter((s) => s.ticker !== holding.ticker));
    await this.recordSnapshot();
    this.refreshMetrics();
    this.toast.info(`${holding.ticker} removed`);
  }

  async refreshSingleHolding(id: string): Promise<void> {
    const holding = this.holdings().find((h) => h.id === id);
    if (!holding) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const quote = await this.stockApi.fetchQuote(holding.ticker);
      const schedules = await this.stockApi.fetchUpcomingDividends(holding.ticker);

      const updated: Holding = {
        ...holding,
        currentPrice: quote.currentPrice,
        annualDividendPerShare: quote.annualDividendPerShare,
        lastUpdated: new Date().toISOString(),
      };

      await this.db.saveHolding(updated);
      await this.db.replaceDividendSchedulesForTicker(holding.ticker, schedules);

      this.holdings.update((list) => list.map((h) => (h.id === id ? updated : h)));
      this.dividendSchedules.update((list) => [
        ...list.filter((s) => s.ticker !== holding.ticker),
        ...schedules,
      ]);

      await this.recordSnapshot();
      this.refreshMetrics();
      this.toast.success(`${holding.ticker} refreshed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh holding';
      this.error.set(message);
      this.toast.error(message);
    } finally {
      this.loading.set(false);
    }
  }

  async refreshMarketData(showToast = true): Promise<void> {
    const currentHoldings = this.holdings();
    if (currentHoldings.length === 0) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const updatedHoldings: Holding[] = [];
      const allSchedules: DividendSchedule[] = [];

      for (const holding of currentHoldings) {
        const quote = await this.stockApi.fetchQuote(holding.ticker);
        const schedules = await this.stockApi.fetchUpcomingDividends(holding.ticker);

        const updated: Holding = {
          ...holding,
          currentPrice: quote.currentPrice,
          annualDividendPerShare: quote.annualDividendPerShare,
          lastUpdated: new Date().toISOString(),
        };

        await this.db.saveHolding(updated);
        await this.db.replaceDividendSchedulesForTicker(holding.ticker, schedules);

        updatedHoldings.push(updated);
        allSchedules.push(...schedules);
      }

      this.holdings.set(updatedHoldings);
      this.dividendSchedules.set(allSchedules);
      await this.recordSnapshot();
      this.refreshMetrics();

      if (showToast) {
        this.toast.success('Prices refreshed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh market data';
      this.error.set(message);
      this.toast.error(message);
    } finally {
      this.loading.set(false);
    }
  }

  async addWatchlistItem(input: WatchlistItemInput): Promise<void> {
    const ticker = input.ticker.toUpperCase().trim();
    if (this.watchlist().some((w) => w.ticker === ticker)) {
      this.toast.info(`${ticker} is already on your watchlist`);
      return;
    }

    this.loading.set(true);

    try {
      const quote = await this.stockApi.fetchQuote(ticker);
      const now = new Date().toISOString();

      const item: WatchlistItem = {
        id: crypto.randomUUID(),
        ticker,
        companyName: input.companyName,
        logoUrl: input.logoUrl ?? getStockLogoUrl(ticker),
        targetPrice: input.targetPrice,
        notes: input.notes,
        currentPrice: quote.currentPrice,
        annualDividendPerShare: quote.annualDividendPerShare,
        addedAt: now,
        lastUpdated: now,
      };

      await this.db.saveWatchlistItem(item);
      this.watchlist.update((list) => [...list, item]);
      this.toast.success(`${ticker} added to watchlist`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add to watchlist';
      this.toast.error(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async removeWatchlistItem(id: string): Promise<void> {
    const item = this.watchlist().find((w) => w.id === id);
    if (!item) {
      return;
    }

    await this.db.deleteWatchlistItem(id);
    this.watchlist.update((list) => list.filter((w) => w.id !== id));
    this.toast.info(`${item.ticker} removed from watchlist`);
  }

  async refreshWatchlist(): Promise<void> {
    const items = this.watchlist();
    if (items.length === 0) {
      return;
    }

    this.loading.set(true);

    try {
      const updated: WatchlistItem[] = [];

      for (const item of items) {
        const quote = await this.stockApi.fetchQuote(item.ticker);
        const refreshed: WatchlistItem = {
          ...item,
          currentPrice: quote.currentPrice,
          annualDividendPerShare: quote.annualDividendPerShare,
          lastUpdated: new Date().toISOString(),
        };
        await this.db.saveWatchlistItem(refreshed);
        updated.push(refreshed);
      }

      this.watchlist.set(updated);
      this.checkWatchlistPriceAlerts(updated);
      this.toast.success('Watchlist refreshed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh watchlist';
      this.toast.error(message);
    } finally {
      this.loading.set(false);
    }
  }

  async promoteWatchlistToHolding(id: string, shares: number, purchasePrice: number): Promise<void> {
    const item = this.watchlist().find((w) => w.id === id);
    if (!item) {
      return;
    }

    await this.addHolding({
      ticker: item.ticker,
      companyName: item.companyName,
      logoUrl: item.logoUrl,
      shares,
      purchasePrice,
    });
    await this.removeWatchlistItem(id);
  }

  projectIncome(years = 5, dividendGrowthRatePercent = 5): ReturnType<PortfolioCalculatorService['projectIncome']> {
    const annual = this.metrics()?.totalAnnualDividendIncome ?? 0;
    return this.calculator.projectIncome(annual, years, dividendGrowthRatePercent);
  }

  computeFirePlan(
    monthlyContribution: number,
    dividendGrowthRatePercent: number,
    portfolioGrowthRatePercent: number,
    withdrawalRatePercent: number,
  ): ReturnType<PortfolioCalculatorService['computeFirePlan']> {
    const metrics = this.metrics();
    if (!metrics) {
      return {
        freedomNumber: 0,
        yearsToGoal: null,
        monthlyGap: 0,
        goalReached: false,
        withdrawalRatePercent,
      };
    }
    return this.calculator.computeFirePlan(
      metrics,
      this.settings().monthlyIncomeGoal,
      monthlyContribution,
      dividendGrowthRatePercent,
      portfolioGrowthRatePercent,
      withdrawalRatePercent,
    );
  }

  projectFirePath(
    monthlyContribution: number,
    dividendGrowthRatePercent: number,
    portfolioGrowthRatePercent: number,
    years: number,
  ): ReturnType<PortfolioCalculatorService['projectFirePath']> {
    const metrics = this.metrics();
    return this.calculator.projectFirePath(
      metrics?.totalPortfolioValue ?? 0,
      metrics?.totalAnnualDividendIncome ?? 0,
      monthlyContribution,
      dividendGrowthRatePercent,
      portfolioGrowthRatePercent,
      years,
    );
  }

  async updateMonthlyIncomeGoal(goal: number, showToast = true): Promise<void> {
    const settings: UserSettings = {
      ...this.settings(),
      monthlyIncomeGoal: Math.max(0, goal),
    };

    await this.db.saveSettings(settings);
    this.settings.set(settings);
    if (showToast) {
      this.toast.success('Income goal saved');
    }
  }

  async exportData(): Promise<PortfolioExport> {
    return this.db.exportPortfolio();
  }

  exportHoldingsCsv(): string {
    const metrics = this.metrics();
    if (!metrics) {
      return 'Ticker,Shares,Purchase Price,Current Price,Cost Basis,Market Value,Unrealized P&L,Growth %,Annual Dividend,Yield on Cost %\n';
    }

    const header =
      'Ticker,Shares,Purchase Price,Current Price,Cost Basis,Market Value,Unrealized P&L,Growth %,Annual Dividend,Yield on Cost %';
    const rows = metrics.holdings.map((h) =>
      [
        h.holding.ticker,
        h.holding.shares,
        h.holding.purchasePrice.toFixed(2),
        h.holding.currentPrice.toFixed(2),
        h.costBasis.toFixed(2),
        h.assetValue.toFixed(2),
        h.unrealizedGainLoss.toFixed(2),
        h.assetGrowthPercent.toFixed(2),
        h.annualDividendIncome.toFixed(2),
        h.yieldOnCostPercent.toFixed(2),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  async importData(data: PortfolioExport): Promise<void> {
    if ((data.version !== 1 && data.version !== 2) || !Array.isArray(data.holdings)) {
      this.toast.error('Invalid backup file format');
      throw new Error('Invalid backup file format');
    }

    await this.db.importPortfolio(data);

    this.holdings.set(data.holdings);
    this.dividendSchedules.set(data.dividendSchedules ?? []);
    this.portfolioSnapshots.set(data.portfolioSnapshots ?? []);
    this.settings.set(data.settings ?? { ...DEFAULT_SETTINGS });
    this.watchlist.set(data.watchlist ?? []);
    this.refreshMetrics();
    this.toast.success('Portfolio restored from backup');
  }

  async clearPortfolio(): Promise<void> {
    await this.db.clearAll();
    this.holdings.set([]);
    this.watchlist.set([]);
    this.dividendSchedules.set([]);
    this.portfolioSnapshots.set([]);
    this.settings.set({ ...DEFAULT_SETTINGS });
    this.metrics.set(null);
    this.toast.info('Portfolio cleared');
  }

  monthlyDividendTotals(): Map<string, number> {
    return this.calculator.aggregateDividendsByMonth(this.dividendSchedules(), this.holdings());
  }

  upcomingDividendTotal(days = 30): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const sharesByTicker = new Map(this.holdings().map((h) => [h.ticker, h.shares]));

    return this.dividendSchedules()
      .filter((s) => {
        const payDate = new Date(s.payDate);
        return payDate >= new Date() && payDate <= cutoff;
      })
      .reduce((sum, s) => sum + s.amountPerShare * (sharesByTicker.get(s.ticker) ?? 0), 0);
  }

  private checkWatchlistPriceAlerts(items: WatchlistItem[]): void {
    for (const item of items) {
      if (!item.targetPrice || item.targetPrice <= 0) {
        continue;
      }
      if (item.currentPrice <= item.targetPrice) {
        this.toast.success(
          `${item.ticker} hit your target price of $${item.targetPrice.toFixed(2)} — now at $${item.currentPrice.toFixed(2)}`,
        );
      }
    }
  }

  private refreshMetrics(): void {
    const holdings = this.holdings();
    if (holdings.length === 0) {
      this.metrics.set(null);
      return;
    }

    this.metrics.set(this.calculator.computePortfolioMetrics(holdings));
  }

  private async recordSnapshot(): Promise<void> {
    const metrics = this.calculator.computePortfolioMetrics(this.holdings());
    const today = new Date().toISOString().slice(0, 10);

    const snapshot: PortfolioSnapshot = {
      id: today,
      date: today,
      totalValue: metrics.totalPortfolioValue,
    };

    await this.db.upsertPortfolioSnapshot(snapshot);

    const snapshots = await this.db.getPortfolioSnapshots();
    this.portfolioSnapshots.set(snapshots);
  }
}
