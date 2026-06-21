import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PortfolioFacadeService } from './portfolio-facade.service';
import { ThemeService } from './theme.service';
import { QuickAddService } from './quick-add.service';
import { PaycheckViewService } from './paycheck-view.service';
import { ConfirmDialogService } from './confirm-dialog.service';
import { ToastService } from './toast.service';
import { downloadHoldingsCsv, downloadPortfolioBackup } from '../utils/portfolio-export.util';
import { POPULAR_STOCKS } from '../constants/popular-stocks';

export type CommandCategory = 'navigation' | 'actions' | 'portfolio' | 'settings' | 'research';

export interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  keywords?: string[];
  when?: () => boolean;
  action: () => void | Promise<void>;
}

function matchesQuery(command: PaletteCommand, query: string): boolean {
  const haystack = [command.label, command.description ?? '', ...(command.keywords ?? [])]
    .join(' ')
    .toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly router = inject(Router);
  private readonly portfolio = inject(PortfolioFacadeService);
  private readonly theme = inject(ThemeService);
  private readonly quickAdd = inject(QuickAddService);
  private readonly paycheckView = inject(PaycheckViewService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly open = signal(false);
  readonly query = signal('');
  readonly activeIndex = signal(0);

  private readonly staticCommands: PaletteCommand[] = this.buildStaticCommands();

  readonly dynamicCommands = computed<PaletteCommand[]>(() => {
    const holdings = this.portfolio.holdings();
    const holdingTickers = new Set(holdings.map((h) => h.ticker));

    const holdingCommands: PaletteCommand[] = holdings.map((h) => ({
      id: `research-${h.ticker}`,
      label: `Research ${h.ticker}`,
      description: h.companyName ?? 'Open stock research report',
      category: 'research' as const,
      keywords: [h.ticker, 'analyze', 'stock'],
      action: () => void this.router.navigate(['/research', h.ticker]),
    }));

    const popularCommands: PaletteCommand[] = POPULAR_STOCKS.filter(
      (stock) => !holdingTickers.has(stock.symbol),
    )
      .slice(0, 8)
      .map((stock) => ({
        id: `research-popular-${stock.symbol}`,
        label: `Research ${stock.symbol}`,
        description: stock.name,
        category: 'research' as const,
        keywords: [stock.symbol, stock.name, 'popular'],
        action: () => void this.router.navigate(['/research', stock.symbol]),
      }));

    return [...holdingCommands, ...popularCommands];
  });

  readonly visibleCommands = computed(() => {
    const q = this.query().trim();
    const all = [...this.staticCommands, ...this.dynamicCommands()];
    const available = all.filter((c) => !c.when || c.when());

    if (!q) {
      return available;
    }

    return available.filter((c) => matchesQuery(c, q));
  });

  toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.show();
    }
  }

  show(): void {
    this.open.set(true);
    this.query.set('');
    this.activeIndex.set(0);
  }

  close(): void {
    this.open.set(false);
    this.query.set('');
    this.activeIndex.set(0);
  }

  setQuery(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  selectNext(): void {
    const count = this.visibleCommands().length;
    if (count === 0) {
      return;
    }
    this.activeIndex.update((i) => (i + 1) % count);
  }

  selectPrev(): void {
    const count = this.visibleCommands().length;
    if (count === 0) {
      return;
    }
    this.activeIndex.update((i) => (i - 1 + count) % count);
  }

  async executeActive(): Promise<void> {
    const commands = this.visibleCommands();
    const command = commands[this.activeIndex()];
    if (command) {
      await this.execute(command);
    }
  }

  async execute(command: PaletteCommand): Promise<void> {
    this.close();
    await command.action();
  }

  canHandleGlobalShortcut(): boolean {
    return !this.confirm.state();
  }

  private buildStaticCommands(): PaletteCommand[] {
    const navigate = (path: string, label: string, description: string, keywords: string[] = []): PaletteCommand => ({
      id: `nav-${path}`,
      label,
      description,
      category: 'navigation',
      keywords,
      action: () => void this.router.navigate([path]),
    });

    return [
      navigate('/home', 'Go to Home', 'Portfolio overview dashboard', ['dashboard', 'overview']),
      navigate('/wealth', 'Go to Wealth', 'Asset growth and allocation', ['assets', 'portfolio']),
      navigate('/paycheck', 'Go to Paycheck', 'Dividend income dashboard', ['income', 'dividends']),
      navigate('/plan', 'Go to Plan', 'FIRE and retirement projections', ['fire', 'retirement']),
      navigate('/insights', 'Go to Insights', 'Portfolio analytics and watchlist', ['analytics']),
      navigate('/research', 'Go to Research', 'Stock analysis and reports', ['stocks', 'analyze']),
      navigate('/holdings', 'Go to Holdings', 'Manage portfolio positions', ['positions', 'stocks']),
      navigate('/settings', 'Go to Settings', 'Preferences and data management', ['preferences', 'config']),

      {
        id: 'add-stock',
        label: 'Add New Stock',
        description: 'Open quick-add dialog to add a holding',
        category: 'actions',
        keywords: ['holding', 'position', 'buy', 'new'],
        action: () => this.quickAdd.show(),
      },
      {
        id: 'refresh-prices',
        label: 'Refresh Market Data',
        description: 'Update prices and dividend data for all holdings',
        category: 'actions',
        keywords: ['prices', 'quotes', 'update', 'sync'],
        when: () => this.portfolio.holdings().length > 0,
        action: async () => {
          await this.portfolio.refreshMarketData();
        },
      },
      {
        id: 'export-backup',
        label: 'Export Data',
        description: 'Download full portfolio backup as JSON',
        category: 'settings',
        keywords: ['backup', 'json', 'download', 'save'],
        when: () => this.portfolio.holdings().length > 0,
        action: async () => {
          const hash = await downloadPortfolioBackup(this.portfolio, this.toast);
          void hash;
        },
      },
      {
        id: 'export-csv',
        label: 'Export Holdings CSV',
        description: 'Download holdings spreadsheet',
        category: 'settings',
        keywords: ['csv', 'spreadsheet', 'download'],
        when: () => this.portfolio.holdings().length > 0,
        action: () => downloadHoldingsCsv(this.portfolio),
      },
      {
        id: 'import-data',
        label: 'Import Backup',
        description: 'Go to Settings to restore from JSON backup',
        category: 'settings',
        keywords: ['restore', 'upload', 'json'],
        action: () => void this.router.navigate(['/settings']),
      },
      {
        id: 'load-demo',
        label: 'Load Demo Portfolio',
        description: 'Populate with sample dividend holdings',
        category: 'portfolio',
        keywords: ['sample', 'example', 'starter'],
        when: () => this.portfolio.holdings().length === 0,
        action: async () => {
          await this.portfolio.loadDemoPortfolio();
        },
      },
      {
        id: 'view-monthly',
        label: 'Switch to Monthly View',
        description: 'Show upcoming dividends by month on Paycheck',
        category: 'actions',
        keywords: ['paycheck', 'chart', 'dividends'],
        when: () => this.paycheckView.dividendChartGranularity() === 'yearly',
        action: () => {
          this.paycheckView.setDividendChartGranularity('monthly');
          void this.router.navigate(['/paycheck']);
        },
      },
      {
        id: 'view-yearly',
        label: 'Switch to Yearly View',
        description: 'Aggregate upcoming dividends by year on Paycheck',
        category: 'actions',
        keywords: ['paycheck', 'chart', 'dividends', 'annual'],
        when: () => this.paycheckView.dividendChartGranularity() === 'monthly',
        action: () => {
          this.paycheckView.setDividendChartGranularity('yearly');
          void this.router.navigate(['/paycheck']);
        },
      },
      {
        id: 'toggle-theme',
        label: 'Toggle Theme',
        description: `Switch to ${this.theme.theme() === 'dark' ? 'light' : 'dark'} mode`,
        category: 'settings',
        keywords: ['dark', 'light', 'appearance'],
        action: () => this.theme.toggle(),
      },
      {
        id: 'theme-light',
        label: 'Use Light Theme',
        description: 'Set appearance to light mode',
        category: 'settings',
        keywords: ['appearance', 'bright'],
        when: () => this.theme.theme() !== 'light',
        action: () => this.theme.setPreference('light'),
      },
      {
        id: 'theme-dark',
        label: 'Use Dark Theme',
        description: 'Set appearance to dark mode',
        category: 'settings',
        keywords: ['appearance'],
        when: () => this.theme.theme() !== 'dark',
        action: () => this.theme.setPreference('dark'),
      },
      {
        id: 'clear-simulations',
        label: 'Clear All Simulations',
        description: 'Reset what-if share purchase scenarios',
        category: 'portfolio',
        keywords: ['what-if', 'simulate'],
        when: () => this.portfolio.hasActiveSimulations(),
        action: () => this.portfolio.clearAllSimulations(),
      },
      {
        id: 'refresh-watchlist',
        label: 'Refresh Watchlist',
        description: 'Update watchlist quote prices',
        category: 'actions',
        keywords: ['watchlist', 'quotes'],
        when: () => this.portfolio.watchlist().length > 0,
        action: async () => {
          await this.portfolio.refreshWatchlist();
        },
      },
      {
        id: 'clear-portfolio',
        label: 'Clear All Data',
        description: 'Delete all holdings and reset portfolio',
        category: 'settings',
        keywords: ['delete', 'reset', 'wipe'],
        when: () => this.portfolio.holdings().length > 0,
        action: async () => {
          const confirmed = await this.confirm.confirm({
            title: 'Clear all data',
            message: 'Delete all holdings and reset your portfolio? This cannot be undone.',
            confirmLabel: 'Delete everything',
            danger: true,
          });
          if (confirmed) {
            await this.portfolio.clearPortfolio();
          }
        },
      },
    ];
  }
}
