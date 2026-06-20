import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Holding, HoldingInput } from '../models/holding.model';
import { DividendSchedule } from '../models/dividend-schedule.model';
import { PortfolioSnapshot } from '../models/portfolio-snapshot.model';
import { PortfolioMetrics } from '../models/portfolio-metrics.model';
import { DEFAULT_SETTINGS, PortfolioExport, UserSettings } from '../models/user-settings.model';
import { PortfolioDbService } from './portfolio-db.service';
import { PortfolioCalculatorService } from './portfolio-calculator.service';
import { StockApiService } from './stock-api.service';
import { ToastService } from './toast.service';

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

  readonly holdings = signal<Holding[]>([]);
  readonly dividendSchedules = signal<DividendSchedule[]>([]);
  readonly portfolioSnapshots = signal<PortfolioSnapshot[]>([]);
  readonly settings = signal<UserSettings>({ ...DEFAULT_SETTINGS });
  readonly metrics = signal<PortfolioMetrics | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly incomeGoalProgress = computed(() => {
    const goal = this.settings().monthlyIncomeGoal;
    const monthly = this.metrics()?.projectedMonthlyIncome ?? 0;
    if (goal <= 0) {
      return 0;
    }
    return Math.min(100, (monthly / goal) * 100);
  });

  readonly lastUpdated = computed(() => {
    const holdings = this.holdings();
    if (holdings.length === 0) {
      return null;
    }
    return holdings.reduce((latest, h) => (h.lastUpdated > latest ? h.lastUpdated : latest), holdings[0].lastUpdated);
  });

  async init(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.initialized) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const [holdings, schedules, snapshots, settings] = await Promise.all([
        this.db.getAllHoldings(),
        this.db.getAllDividendSchedules(),
        this.db.getPortfolioSnapshots(),
        this.db.getSettings(),
      ]);

      this.holdings.set(holdings);
      this.dividendSchedules.set(schedules);
      this.portfolioSnapshots.set(snapshots);
      this.settings.set(settings);
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

  async importData(data: PortfolioExport): Promise<void> {
    if (data.version !== 1 || !Array.isArray(data.holdings)) {
      this.toast.error('Invalid backup file format');
      throw new Error('Invalid backup file format');
    }

    await this.db.importPortfolio(data);

    this.holdings.set(data.holdings);
    this.dividendSchedules.set(data.dividendSchedules ?? []);
    this.portfolioSnapshots.set(data.portfolioSnapshots ?? []);
    this.settings.set(data.settings ?? { ...DEFAULT_SETTINGS });
    this.refreshMetrics();
    this.toast.success('Portfolio restored from backup');
  }

  async clearPortfolio(): Promise<void> {
    await this.db.clearAll();
    this.holdings.set([]);
    this.dividendSchedules.set([]);
    this.portfolioSnapshots.set([]);
    this.settings.set({ ...DEFAULT_SETTINGS });
    this.metrics.set(null);
    this.toast.info('Portfolio cleared');
  }

  monthlyDividendTotals(): Map<string, number> {
    return this.calculator.aggregateDividendsByMonth(this.dividendSchedules(), this.holdings());
  }

  allocationByTicker(): { ticker: string; value: number; percent: number }[] {
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
