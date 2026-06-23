import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { Holding } from '../models/holding.model';
import { DividendSchedule } from '../models/dividend-schedule.model';
import { PortfolioSnapshot } from '../models/portfolio-snapshot.model';
import { WatchlistItem } from '../models/watchlist-item.model';
import { DEFAULT_SETTINGS, PortfolioExport, UserSettings } from '../models/user-settings.model';

interface StockCalDB extends DBSchema {
  holdings: {
    key: string;
    value: Holding;
    indexes: { 'by-ticker': string };
  };
  dividendSchedules: {
    key: string;
    value: DividendSchedule;
    indexes: { 'by-ticker': string; 'by-pay-date': string };
  };
  portfolioSnapshots: {
    key: string;
    value: PortfolioSnapshot;
    indexes: { 'by-date': string };
  };
  settings: {
    key: string;
    value: UserSettings;
  };
  watchlist: {
    key: string;
    value: WatchlistItem;
    indexes: { 'by-ticker': string };
  };
}

const DB_NAME = 'stock-cal';
const DB_VERSION = 3;

@Injectable({ providedIn: 'root' })
export class PortfolioDbService {
  private readonly platformId = inject(PLATFORM_ID);
  private dbPromise: Promise<IDBPDatabase<StockCalDB>> | null = null;

  private getDb(): Promise<IDBPDatabase<StockCalDB>> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject(new Error('IndexedDB is only available in the browser'));
    }

    if (!this.dbPromise) {
      this.dbPromise = openDB<StockCalDB>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            const holdingsStore = db.createObjectStore('holdings', { keyPath: 'id' });
            holdingsStore.createIndex('by-ticker', 'ticker');

            const schedulesStore = db.createObjectStore('dividendSchedules', { keyPath: 'id' });
            schedulesStore.createIndex('by-ticker', 'ticker');
            schedulesStore.createIndex('by-pay-date', 'payDate');

            const snapshotsStore = db.createObjectStore('portfolioSnapshots', { keyPath: 'id' });
            snapshotsStore.createIndex('by-date', 'date');
          }

          if (oldVersion < 2 && !db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }

          if (oldVersion < 3 && !db.objectStoreNames.contains('watchlist')) {
            const watchlistStore = db.createObjectStore('watchlist', { keyPath: 'id' });
            watchlistStore.createIndex('by-ticker', 'ticker');
          }
        },
      });
    }

    return this.dbPromise;
  }

  async getAllHoldings(): Promise<Holding[]> {
    const db = await this.getDb();
    return db.getAll('holdings');
  }

  async saveHolding(holding: Holding): Promise<void> {
    const db = await this.getDb();
    await db.put('holdings', holding);
  }

  async deleteHolding(id: string): Promise<void> {
    const db = await this.getDb();
    const holding = await db.get('holdings', id);
    if (!holding) {
      return;
    }

    const existing = await db.getAll('dividendSchedules');
    const toRemove = existing.filter((s) => s.ticker === holding.ticker);

    const tx = db.transaction(['holdings', 'dividendSchedules'], 'readwrite');
    await tx.objectStore('holdings').delete(id);
    await Promise.all(toRemove.map((s) => tx.objectStore('dividendSchedules').delete(s.id)));
    await tx.done;
  }

  async getAllDividendSchedules(): Promise<DividendSchedule[]> {
    const db = await this.getDb();
    return db.getAll('dividendSchedules');
  }

  async replaceDividendSchedulesForTicker(
    ticker: string,
    schedules: DividendSchedule[],
  ): Promise<void> {
    const db = await this.getDb();
    const existing = await db.getAll('dividendSchedules');
    const toRemove = existing.filter((s) => s.ticker === ticker);

    const tx = db.transaction('dividendSchedules', 'readwrite');
    await Promise.all([
      ...toRemove.map((s) => tx.store.delete(s.id)),
      ...schedules.map((s) => tx.store.put(s)),
      tx.done,
    ]);
  }

  async getPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
    const db = await this.getDb();
    const snapshots = await db.getAll('portfolioSnapshots');
    return snapshots.sort((a, b) => a.date.localeCompare(b.date));
  }

  async upsertPortfolioSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    const db = await this.getDb();
    await db.put('portfolioSnapshots', snapshot);
  }

  async getSettings(): Promise<UserSettings> {
    const db = await this.getDb();
    const settings = await db.get('settings', 'settings');
    return { ...DEFAULT_SETTINGS, ...settings, id: 'settings' };
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    const db = await this.getDb();
    await db.put('settings', settings);
  }

  async getAllWatchlistItems(): Promise<WatchlistItem[]> {
    const db = await this.getDb();
    return db.getAll('watchlist');
  }

  async saveWatchlistItem(item: WatchlistItem): Promise<void> {
    const db = await this.getDb();
    await db.put('watchlist', item);
  }

  async deleteWatchlistItem(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('watchlist', id);
  }

  async exportPortfolio(): Promise<PortfolioExport> {
    const [holdings, dividendSchedules, portfolioSnapshots, settings, watchlist] = await Promise.all([
      this.getAllHoldings(),
      this.getAllDividendSchedules(),
      this.getPortfolioSnapshots(),
      this.getSettings(),
      this.getAllWatchlistItems(),
    ]);

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      holdings,
      dividendSchedules,
      portfolioSnapshots,
      settings,
      watchlist,
    };
  }

  async importPortfolio(data: PortfolioExport): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(
      ['holdings', 'dividendSchedules', 'portfolioSnapshots', 'settings', 'watchlist'],
      'readwrite',
    );

    await Promise.all([
      tx.objectStore('holdings').clear(),
      tx.objectStore('dividendSchedules').clear(),
      tx.objectStore('portfolioSnapshots').clear(),
      tx.objectStore('watchlist').clear(),
    ]);

    for (const holding of data.holdings) {
      await tx.objectStore('holdings').put(holding);
    }
    for (const schedule of data.dividendSchedules ?? []) {
      await tx.objectStore('dividendSchedules').put(schedule);
    }
    for (const snapshot of data.portfolioSnapshots ?? []) {
      await tx.objectStore('portfolioSnapshots').put(snapshot);
    }
    for (const item of data.watchlist ?? []) {
      await tx.objectStore('watchlist').put(item);
    }
    await tx.objectStore('settings').put({ ...DEFAULT_SETTINGS, ...data.settings, id: 'settings' });
    await tx.done;
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(
      ['holdings', 'dividendSchedules', 'portfolioSnapshots', 'settings', 'watchlist'],
      'readwrite',
    );

    await Promise.all([
      tx.objectStore('holdings').clear(),
      tx.objectStore('dividendSchedules').clear(),
      tx.objectStore('portfolioSnapshots').clear(),
      tx.objectStore('watchlist').clear(),
      tx.objectStore('settings').put({ ...DEFAULT_SETTINGS }),
      tx.done,
    ]);
  }
}
