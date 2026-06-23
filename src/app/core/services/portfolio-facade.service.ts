import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Holding, HoldingInput } from '../models/holding.model';
import {
  DEFAULT_ADDITIONAL_SHARES,
  HoldingSimulation,
  applySimulationToHolding,
  isSimulationActive,
} from '../models/holding-simulation.model';
import { DividendSchedule } from '../models/dividend-schedule.model';
import { PortfolioSnapshot } from '../models/portfolio-snapshot.model';
import { FirePlanSummary, FireProjectionYear } from '../models/fire-projection.model';
import { PortfolioMetrics } from '../models/portfolio-metrics.model';
import { PortfolioInsights, IncomeProjectionYear } from '../models/portfolio-insights.model';
import { WatchlistItem, WatchlistItemInput } from '../models/watchlist-item.model';
import { DEFAULT_SETTINGS, PortfolioExport, UserSettings } from '../models/user-settings.model';
import {
  getPortfolioProjectionLibSync,
  loadPortfolioProjectionLib,
  type PortfolioProjectionLib,
} from '../calculations/portfolio-projection.loader';
import {
  computeDividendYieldPercent,
  computeYieldOnCostPercent,
} from '../calculations/dividend-yield.lib';
import {
  computeFreedomNumber,
  computeMonthlyIncomeFromFreedomNumber,
} from '../calculations/portfolio-projection.lib';
import { PortfolioDbService } from './portfolio-db.service';
import { PortfolioCalculatorService } from './portfolio-calculator.service';
import { StockApiService } from './stock-api.service';
import { ToastService } from './toast.service';
import { getStockLogoUrl } from '../utils/stock-logo.util';
import { generateDemoPortfolioSnapshots } from '../utils/demo-portfolio-snapshots.util';
import { DEMO_PORTFOLIO } from '../constants/demo-portfolio';
import {
  nextHoldingSortOrder,
  normalizeHoldingsSortOrder,
  sortHoldingsByOrder,
} from '../utils/holding-order.util';

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
  private projectionLoadPromise: Promise<PortfolioProjectionLib> | null = null;
  private autoRefreshInterval: ReturnType<typeof setInterval> | null = null;
  private readonly autoRefreshMs = 60_000;

  private readonly projectionLib = signal<PortfolioProjectionLib | null>(null);

  readonly holdings = signal<Holding[]>([]);
  readonly holdingSimulations = signal<Record<string, HoldingSimulation>>({});
  readonly watchlist = signal<WatchlistItem[]>([]);
  readonly dividendSchedules = signal<DividendSchedule[]>([]);
  readonly portfolioSnapshots = signal<PortfolioSnapshot[]>([]);
  readonly settings = signal<UserSettings>({ ...DEFAULT_SETTINGS });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly usingLiveQuotes = this.stockApi.usingLiveQuotes;

  readonly hasActiveSimulations = computed(() =>
    Object.values(this.holdingSimulations()).some(isSimulationActive),
  );

  readonly effectiveHoldings = computed(() => {
    const simulations = this.holdingSimulations();
    return this.holdings().map((holding) => {
      const sim = simulations[holding.id];
      return sim ? applySimulationToHolding(holding, sim) : holding;
    });
  });

  readonly metrics = computed<PortfolioMetrics | null>(() => {
    const holdings = this.effectiveHoldings();
    if (holdings.length === 0) {
      return null;
    }
    return this.calculator.computePortfolioMetrics(holdings);
  });

  readonly baseMetrics = computed<PortfolioMetrics | null>(() => {
    const holdings = this.holdings();
    if (holdings.length === 0) {
      return null;
    }
    return this.calculator.computePortfolioMetrics(holdings);
  });

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
    const lib = this.projectionLib();
    const metrics = this.metrics();
    if (!lib || !metrics) {
      return null;
    }
    return lib.computePortfolioInsights(metrics);
  });

  readonly incomeGoalProgress = computed(() => {
    const goal = this.settings().monthlyIncomeGoal;
    const monthly = this.metrics()?.projectedMonthlyIncome ?? 0;
    if (goal <= 0) {
      return 0;
    }
    return Math.min(100, (monthly / goal) * 100);
  });

  readonly freedomNumber = computed(() => {
    const settings = this.settings();
    return computeFreedomNumber(settings.monthlyIncomeGoal, settings.withdrawalRatePercent);
  });

  readonly fireProgress = computed(() => {
    const target = this.freedomNumber();
    const portfolioValue = this.metrics()?.totalPortfolioValue ?? 0;
    if (target <= 0) {
      return 0;
    }
    return Math.min(100, (portfolioValue / target) * 100);
  });

  readonly portfolioMilestones = computed(() => {
    const lib = this.projectionLib();
    const metrics = this.metrics();
    if (!lib || !metrics) {
      return [];
    }
    return lib.computePortfolioMilestones(metrics, this.settings().monthlyIncomeGoal);
  });

  readonly achievedMilestones = computed(() =>
    this.portfolioMilestones().filter((m) => m.achieved),
  );

  readonly benchmarkComparison = computed(() => {
    const lib = this.projectionLib();
    const metrics = this.metrics();
    if (!lib || !metrics) {
      return null;
    }
    return lib.computeBenchmarkComparison(
      this.portfolioSnapshots(),
      metrics.totalAssetGrowthPercent,
    );
  });

  readonly performanceChartSeries = computed(() => {
    const lib = this.projectionLib();
    if (!lib) {
      return null;
    }
    return lib.computePerformanceChartSeries(this.portfolioSnapshots());
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

    this.initPromise = this.loadPortfolio().finally(() => {
      if (!this.initialized) {
        this.initPromise = null;
      }
    });
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

      const normalizedHoldings = sortHoldingsByOrder(normalizeHoldingsSortOrder(holdings));
      const needsSortMigration = holdings.some((h) => h.sortOrder == null);
      if (needsSortMigration) {
        await Promise.all(normalizedHoldings.map((h) => this.db.saveHolding(h)));
      }

      this.holdings.set(normalizedHoldings);
      this.dividendSchedules.set(schedules);
      this.portfolioSnapshots.set(snapshots);
      this.settings.set({ ...DEFAULT_SETTINGS, ...settings, id: 'settings' });
      this.watchlist.set(watchlist);
      this.applyApiKeyFromSettings(settings);
      this.initialized = true;

      if (normalizedHoldings.length > 0) {
        await this.refreshMarketData(false);
      }
    } catch (err) {
      const message = this.errorMessage(err, 'Failed to load portfolio');
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

    await this.runWithLoading(
      async () => {
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
          sortOrder: nextHoldingSortOrder(this.holdings()),
        };

        await this.persistHoldingMarketData(holding, schedules);
        this.appendHoldingMarketData(holding, schedules);
        await this.recordSnapshot();
        this.toast.success(`${ticker} added to portfolio`);
      },
      'Failed to add holding',
      true,
    );
  }

  async loadDemoPortfolio(): Promise<boolean> {
    if (this.holdings().length > 0) {
      this.toast.info('Demo portfolio is only available when you have no holdings');
      return false;
    }

    let loaded = false;

    await this.runWithLoading(async () => {
      const now = new Date().toISOString();
      const holdings: Holding[] = [];
      const allSchedules: DividendSchedule[] = [];

      for (const [index, input] of DEMO_PORTFOLIO.holdings.entries()) {
        const ticker = input.ticker.toUpperCase();
        const quote = await this.stockApi.fetchQuote(ticker);
        const schedules = await this.stockApi.fetchUpcomingDividends(ticker);

        const holding: Holding = {
          id: crypto.randomUUID(),
          ticker,
          companyName: input.companyName,
          logoUrl: getStockLogoUrl(ticker),
          shares: input.shares,
          purchasePrice: input.purchasePrice,
          currentPrice: quote.currentPrice,
          annualDividendPerShare: quote.annualDividendPerShare,
          lastUpdated: now,
          createdAt: now,
          sortOrder: index,
        };

        await this.persistHoldingMarketData(holding, schedules);
        holdings.push(holding);
        allSchedules.push(...schedules);
      }

      const watchlist: WatchlistItem[] = [];

      for (const input of DEMO_PORTFOLIO.watchlist) {
        const ticker = input.ticker.toUpperCase();
        const quote = await this.stockApi.fetchQuote(ticker);

        const item: WatchlistItem = {
          id: crypto.randomUUID(),
          ticker,
          companyName: input.companyName,
          logoUrl: getStockLogoUrl(ticker),
          targetPrice: input.targetPrice,
          notes: input.notes,
          currentPrice: quote.currentPrice,
          annualDividendPerShare: quote.annualDividendPerShare,
          addedAt: now,
          lastUpdated: now,
        };

        await this.db.saveWatchlistItem(item);
        watchlist.push(item);
      }

      this.holdings.set(holdings);
      this.dividendSchedules.set(allSchedules);
      this.watchlist.set(watchlist);

      const metrics = this.calculator.computePortfolioMetrics(holdings);
      const demoSnapshots = generateDemoPortfolioSnapshots({
        currentValue: metrics.totalPortfolioValue,
        costBasis: metrics.totalCostBasis,
        annualDividendIncome: metrics.totalAnnualDividendIncome,
        averageYieldOnCostPercent: this.calculator.computeAverageYieldOnCost(metrics),
      });

      for (const snapshot of demoSnapshots) {
        await this.db.upsertPortfolioSnapshot(snapshot);
      }

      const snapshots = await this.db.getPortfolioSnapshots();
      this.portfolioSnapshots.set(snapshots);
      this.toast.success('Demo portfolio loaded — explore dashboards and experiment freely');
      loaded = true;
    }, 'Failed to load demo portfolio');

    return loaded;
  }

  async updateHolding(id: string, update: HoldingUpdate, showToast = true): Promise<void> {
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
    if (showToast) {
      this.toast.saved(`${holding.ticker} saved to local storage`);
    }
  }

  async reorderHoldings(orderedIds: string[]): Promise<void> {
    const byId = new Map(this.holdings().map((holding) => [holding.id, holding]));
    const reordered: Holding[] = [];

    for (const [index, id] of orderedIds.entries()) {
      const holding = byId.get(id);
      if (holding) {
        reordered.push({ ...holding, sortOrder: index });
      }
    }

    for (const holding of this.holdings()) {
      if (!orderedIds.includes(holding.id)) {
        reordered.push({ ...holding, sortOrder: reordered.length });
      }
    }

    for (const holding of reordered) {
      await this.db.saveHolding(holding);
    }

    this.holdings.set(reordered);
    this.toast.saved('Holdings order saved');
  }

  async removeHolding(id: string): Promise<void> {
    const holding = this.holdings().find((h) => h.id === id);
    if (!holding) {
      return;
    }

    await this.db.deleteHolding(id);
    this.holdings.update((list) => list.filter((h) => h.id !== id));
    this.dividendSchedules.update((list) => list.filter((s) => s.ticker !== holding.ticker));
    this.clearSimulation(id);
    await this.recordSnapshot();
    this.toast.info(`${holding.ticker} removed`);
  }

  async refreshSingleHolding(id: string): Promise<void> {
    const holding = this.holdings().find((h) => h.id === id);
    if (!holding) {
      return;
    }

    await this.runWithLoading(async () => {
      const { updated, schedules } = await this.fetchMarketDataForHolding(holding);
      await this.persistHoldingMarketData(updated, schedules);
      this.applyHoldingMarketUpdate(id, updated, schedules);
      await this.recordSnapshot();
      this.toast.success(`${holding.ticker} refreshed`);
    }, 'Failed to refresh holding');
  }

  async refreshMarketData(showToast = true): Promise<void> {
    const currentHoldings = this.holdings();
    const currentWatchlist = this.watchlist();
    if (currentHoldings.length === 0 && currentWatchlist.length === 0) {
      return;
    }

    await this.runWithLoading(async () => {
      if (currentHoldings.length > 0) {
        const results: { updated: Holding; schedules: DividendSchedule[] }[] = [];

        for (const holding of currentHoldings) {
          results.push(await this.fetchMarketDataForHolding(holding));
        }

        for (const { updated, schedules } of results) {
          await this.persistHoldingMarketData(updated, schedules);
        }

        this.holdings.set(sortHoldingsByOrder(results.map((r) => r.updated)));
        this.dividendSchedules.set(results.flatMap((r) => r.schedules));
        await this.recordSnapshot();
      }

      if (currentWatchlist.length > 0) {
        const previous = [...currentWatchlist];
        const updated: WatchlistItem[] = [];

        for (const item of currentWatchlist) {
          updated.push(await this.fetchMarketDataForWatchlistItem(item));
        }

        for (const item of updated) {
          await this.db.saveWatchlistItem(item);
        }

        this.watchlist.set(updated);
        this.checkWatchlistPriceAlerts(previous, updated);
      }

      if (showToast) {
        this.toast.success('Prices refreshed');
      }
    }, 'Failed to refresh market data');
  }

  async addWatchlistItem(input: WatchlistItemInput): Promise<void> {
    const ticker = input.ticker.toUpperCase().trim();
    if (this.holdings().some((h) => h.ticker === ticker)) {
      this.toast.info(`${ticker} is already in your portfolio`);
      return;
    }
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

  async refreshWatchlist(showToast = true): Promise<void> {
    const items = this.watchlist();
    if (items.length === 0) {
      return;
    }

    await this.runWithLoading(async () => {
      const previous = [...items];
      const updated: WatchlistItem[] = [];

      for (const item of items) {
        const refreshed = await this.fetchMarketDataForWatchlistItem(item);
        updated.push(refreshed);
      }

      for (const item of updated) {
        await this.db.saveWatchlistItem(item);
      }

      this.watchlist.set(updated);
      this.checkWatchlistPriceAlerts(previous, updated);
      if (showToast) {
        this.toast.success('Watchlist refreshed');
      }
    }, 'Failed to refresh watchlist');
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

  ensureProjectionsLoaded(): Promise<void> {
    const synced = this.syncProjectionLibFromCache();
    if (synced) {
      return Promise.resolve();
    }

    this.projectionLoadPromise ??= loadPortfolioProjectionLib().then((lib) => {
      this.projectionLib.set(lib);
      return lib;
    });

    return this.projectionLoadPromise.then(() => undefined);
  }

  private syncProjectionLibFromCache(): PortfolioProjectionLib | null {
    const cached = this.projectionLib() ?? getPortfolioProjectionLibSync();
    if (cached && !this.projectionLib()) {
      this.projectionLib.set(cached);
    }
    return cached;
  }

  projectIncome(years = 5, dividendGrowthRatePercent = 5): IncomeProjectionYear[] {
    const lib = this.projectionLib();
    if (!lib) {
      return [];
    }

    const annual = this.metrics()?.totalAnnualDividendIncome ?? 0;
    return lib.projectIncome(annual, years, dividendGrowthRatePercent);
  }

  computeFirePlan(
    monthlyContribution: number,
    dividendGrowthRatePercent: number,
    portfolioGrowthRatePercent: number,
    withdrawalRatePercent: number,
  ): FirePlanSummary {
    const lib = this.projectionLib();
    const metrics = this.metrics();
    if (!lib) {
      return {
        freedomNumber: 0,
        yearsToGoal: null,
        monthlyGap: 0,
        goalReached: false,
        withdrawalRatePercent,
      };
    }
    if (!metrics) {
      return {
        freedomNumber: 0,
        yearsToGoal: null,
        monthlyGap: 0,
        goalReached: false,
        withdrawalRatePercent,
      };
    }
    return lib.computeFirePlan(
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
  ): FireProjectionYear[] {
    const lib = this.projectionLib();
    if (!lib) {
      return [];
    }

    const metrics = this.metrics();
    return lib.projectFirePath(
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

  async updateWithdrawalRate(rate: number, showToast = false): Promise<void> {
    const settings: UserSettings = {
      ...this.settings(),
      withdrawalRatePercent: Math.min(10, Math.max(1, rate)),
    };

    await this.db.saveSettings(settings);
    this.settings.set(settings);
    if (showToast) {
      this.toast.success('Withdrawal rate saved');
    }
  }

  async updateFreedomTarget(freedomNumber: number, showToast = false): Promise<void> {
    const settings = this.settings();
    const monthlyIncomeGoal = computeMonthlyIncomeFromFreedomNumber(
      Math.max(0, freedomNumber),
      settings.withdrawalRatePercent,
    );
    await this.updateMonthlyIncomeGoal(monthlyIncomeGoal, showToast);
  }

  async updateFinnhubApiKey(apiKey: string, showToast = true): Promise<void> {
    const trimmed = apiKey.trim();
    const settings: UserSettings = {
      ...this.settings(),
      finnhubApiKey: trimmed,
    };

    await this.db.saveSettings(settings);
    this.settings.set(settings);
    this.applyApiKeyFromSettings(settings);

    if (this.holdings().length > 0 || this.watchlist().length > 0) {
      await this.refreshMarketData(false);
    }

    if (showToast) {
      this.toast.success(trimmed ? 'Live quotes enabled' : 'Using demo quotes');
    }
  }

  async exportData(): Promise<PortfolioExport> {
    return this.db.exportPortfolio();
  }

  exportHoldingsCsv(): string {
    return this.calculator.formatHoldingsCsv(this.metrics());
  }

  async importData(data: PortfolioExport): Promise<void> {
    if ((data.version !== 1 && data.version !== 2) || !Array.isArray(data.holdings)) {
      this.toast.error('Invalid backup file format');
      throw new Error('Invalid backup file format');
    }

    await this.db.importPortfolio(data);

    const orderedHoldings = sortHoldingsByOrder(normalizeHoldingsSortOrder(data.holdings));
    await Promise.all(orderedHoldings.map((h) => this.db.saveHolding(h)));
    this.holdings.set(orderedHoldings);
    this.dividendSchedules.set(data.dividendSchedules ?? []);
    this.portfolioSnapshots.set(data.portfolioSnapshots ?? []);
    this.settings.set({ ...DEFAULT_SETTINGS, ...data.settings, id: 'settings' });
    this.watchlist.set(data.watchlist ?? []);
    this.applyApiKeyFromSettings(this.settings());
    this.holdingSimulations.set({});
    this.toast.success('Portfolio restored from backup');
  }

  async clearPortfolio(): Promise<void> {
    await this.db.clearAll();
    this.holdings.set([]);
    this.watchlist.set([]);
    this.dividendSchedules.set([]);
    this.portfolioSnapshots.set([]);
    this.settings.set({ ...DEFAULT_SETTINGS });
    this.holdingSimulations.set({});
    this.applyApiKeyFromSettings(this.settings());
    this.toast.info('Portfolio cleared');
  }

  monthlyDividendTotals(): Map<string, number> {
    return this.calculator.aggregateDividendsByMonth(this.dividendSchedules(), this.holdings());
  }

  upcomingDividendTotal(days = 30): number {
    return this.calculator.computeUpcomingDividendTotal(
      this.dividendSchedules(),
      this.holdings(),
      days,
    );
  }

  toggleSimulation(holdingId: string): void {
    const current = this.holdingSimulations()[holdingId];
    if (isSimulationActive(current)) {
      this.setSimulation(holdingId, { enabled: false, additionalShares: current!.additionalShares });
      return;
    }

    this.setSimulation(holdingId, {
      enabled: true,
      additionalShares: current?.additionalShares ?? DEFAULT_ADDITIONAL_SHARES,
    });
  }

  setSimulationAdditionalShares(holdingId: string, additionalShares: number): void {
    const current = this.holdingSimulations()[holdingId];
    this.setSimulation(holdingId, {
      enabled: current?.enabled ?? true,
      additionalShares: Math.max(0, additionalShares),
    });
  }

  clearSimulation(holdingId: string): void {
    this.holdingSimulations.update((sims) => {
      const next = { ...sims };
      delete next[holdingId];
      return next;
    });
  }

  clearAllSimulations(): void {
    this.holdingSimulations.set({});
  }

  isSimulating(holdingId: string): boolean {
    return isSimulationActive(this.holdingSimulations()[holdingId]);
  }

  getSimulation(holdingId: string): HoldingSimulation | undefined {
    return this.holdingSimulations()[holdingId];
  }

  private setSimulation(holdingId: string, sim: HoldingSimulation): void {
    this.holdingSimulations.update((sims) => ({ ...sims, [holdingId]: sim }));
  }

  private applyApiKeyFromSettings(settings: UserSettings): void {
    this.stockApi.setUserApiKey(settings.finnhubApiKey ?? '');
    this.configureAutoRefresh();
  }

  private configureAutoRefresh(): void {
    this.clearAutoRefresh();

    if (!isPlatformBrowser(this.platformId) || !this.stockApi.hasLiveData()) {
      return;
    }

    this.autoRefreshInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      if (this.holdings().length === 0 && this.watchlist().length === 0) {
        return;
      }

      void this.refreshMarketData(false);
    }, this.autoRefreshMs);
  }

  private clearAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  private async runWithLoading(
    operation: () => Promise<void>,
    fallbackMessage: string,
    rethrow = false,
  ): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await operation();
    } catch (err) {
      const message = this.errorMessage(err, fallbackMessage);
      this.error.set(message);
      this.toast.error(message);
      if (rethrow) {
        throw err;
      }
    } finally {
      this.loading.set(false);
    }
  }

  private errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback;
  }

  private async fetchMarketDataForHolding(
    holding: Holding,
  ): Promise<{ updated: Holding; schedules: DividendSchedule[] }> {
    const quote = await this.stockApi.fetchQuote(holding.ticker);
    const schedules = await this.stockApi.fetchUpcomingDividends(holding.ticker);

    return {
      updated: {
        ...holding,
        currentPrice: quote.currentPrice,
        annualDividendPerShare: quote.annualDividendPerShare,
        previousDividendYieldPercent: computeDividendYieldPercent(
          holding.annualDividendPerShare,
          holding.currentPrice,
        ),
        previousYieldOnCostPercent: computeYieldOnCostPercent(
          holding.annualDividendPerShare,
          holding.purchasePrice,
        ),
        lastUpdated: new Date().toISOString(),
      },
      schedules,
    };
  }

  private async fetchMarketDataForWatchlistItem(item: WatchlistItem): Promise<WatchlistItem> {
    const quote = await this.stockApi.fetchQuote(item.ticker);

    return {
      ...item,
      currentPrice: quote.currentPrice,
      annualDividendPerShare: quote.annualDividendPerShare,
      previousDividendYieldPercent: computeDividendYieldPercent(
        item.annualDividendPerShare,
        item.currentPrice,
      ),
      lastUpdated: new Date().toISOString(),
    };
  }

  private async persistHoldingMarketData(
    holding: Holding,
    schedules: DividendSchedule[],
  ): Promise<void> {
    await this.db.saveHolding(holding);
    await this.db.replaceDividendSchedulesForTicker(holding.ticker, schedules);
  }

  private appendHoldingMarketData(holding: Holding, schedules: DividendSchedule[]): void {
    this.holdings.update((list) => [...list, holding]);
    this.dividendSchedules.update((list) => [
      ...list.filter((s) => s.ticker !== holding.ticker),
      ...schedules,
    ]);
  }

  private applyHoldingMarketUpdate(
    id: string,
    updated: Holding,
    schedules: DividendSchedule[],
  ): void {
    this.holdings.update((list) => list.map((h) => (h.id === id ? updated : h)));
    this.dividendSchedules.update((list) => [
      ...list.filter((s) => s.ticker !== updated.ticker),
      ...schedules,
    ]);
  }

  private checkWatchlistPriceAlerts(previous: WatchlistItem[], updated: WatchlistItem[]): void {
    const previousById = new Map(previous.map((item) => [item.id, item]));

    for (const item of updated) {
      if (!item.targetPrice || item.targetPrice <= 0) {
        continue;
      }

      const prior = previousById.get(item.id);
      const wasAboveTarget = !prior || prior.currentPrice > item.targetPrice;
      if (wasAboveTarget && item.currentPrice <= item.targetPrice) {
        this.toast.success(
          `${item.ticker} hit your target price of $${item.targetPrice.toFixed(2)} — now at $${item.currentPrice.toFixed(2)}`,
        );
      }
    }
  }

  async ensureTodayIncomeSnapshot(): Promise<void> {
    if (this.holdings().length === 0) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const existing = this.portfolioSnapshots().find((s) => s.id === today);
    if (existing?.annualDividendIncome != null) {
      return;
    }

    await this.recordSnapshot();
  }

  private async recordSnapshot(): Promise<void> {
    const metrics = this.calculator.computePortfolioMetrics(this.holdings());
    const today = new Date().toISOString().slice(0, 10);

    const snapshot: PortfolioSnapshot = {
      id: today,
      date: today,
      totalValue: metrics.totalPortfolioValue,
      annualDividendIncome: metrics.totalAnnualDividendIncome,
      averageYieldOnCostPercent: this.calculator.computeAverageYieldOnCost(metrics),
    };

    await this.db.upsertPortfolioSnapshot(snapshot);

    const snapshots = await this.db.getPortfolioSnapshots();
    this.portfolioSnapshots.set(snapshots);
  }
}
