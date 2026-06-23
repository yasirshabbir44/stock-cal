import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { ChartConfiguration, ChartData } from 'chart.js';
import {
  CompactType,
  DisplayGrid,
  GridsterComponent,
  GridsterItemComponent,
  type GridsterConfig,
  GridType,
} from 'angular-gridster2';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { SaveFeedbackService } from '../../core/services/save-feedback.service';
import { ThemeService } from '../../core/services/theme.service';
import { QuickAddService } from '../../core/services/quick-add.service';
import { DashboardLayoutService } from '../../core/services/dashboard-layout.service';
import { HOME_DASHBOARD_LAYOUT } from '../../core/constants/home-dashboard-layout';
import type { DashboardWidgetLayout } from '../../core/models/dashboard-layout.model';
import { ChartComponent } from '../../shared/components/chart.component';
import { StockIconComponent } from '../../shared/components/stock-icon.component';
import { GetStartedGuideComponent } from '../../shared/components/get-started-guide.component';
import { POPULAR_STOCKS } from '../../core/constants/popular-stocks';

const HOME_DASHBOARD_ID = 'home';

@Component({
  selector: 'app-home-dashboard',
  standalone: true,
  imports: [
    GridsterComponent,
    GridsterItemComponent,
    ChartComponent,
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DecimalPipe,
    DatePipe,
    StockIconComponent,
    GetStartedGuideComponent,
    NgTemplateOutlet,
  ],
  templateUrl: './home-dashboard.component.html',
  styleUrl: './home-dashboard.component.scss',
})
export class HomeDashboardComponent implements OnInit, OnDestroy {
  private readonly portfolio = inject(PortfolioFacadeService);
  private readonly theme = inject(ThemeService);
  private readonly quickAdd = inject(QuickAddService);
  private readonly layoutService = inject(DashboardLayoutService);
  readonly feedback = inject(SaveFeedbackService);

  readonly metrics = this.portfolio.metrics;
  readonly insights = this.portfolio.portfolioInsights;
  readonly holdings = this.portfolio.holdings;
  readonly loading = this.portfolio.loading;
  readonly fireProgress = this.portfolio.fireProgress;
  readonly freedomNumber = this.portfolio.freedomNumber;
  readonly settings = this.portfolio.settings;
  readonly lastUpdated = this.portfolio.lastUpdated;
  readonly milestones = this.portfolio.portfolioMilestones;
  readonly achievedMilestones = this.portfolio.achievedMilestones;
  readonly snapshots = this.portfolio.portfolioSnapshots;
  readonly schedules = this.portfolio.dividendSchedules;
  readonly quickStartStocks = POPULAR_STOCKS.slice(0, 5);
  readonly customizeMode = signal(false);
  readonly layout = signal<DashboardWidgetLayout[]>(
    this.layoutService.loadLayout(HOME_DASHBOARD_ID, HOME_DASHBOARD_LAYOUT),
  );

  freedomTarget = 0;
  withdrawalRate = 4;
  private fireTargetSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private withdrawalSaveTimer: ReturnType<typeof setTimeout> | null = null;

  private saveLayoutTimer: ReturnType<typeof setTimeout> | null = null;

  readonly gridOptions = signal<GridsterConfig>(this.buildGridOptions(false));

  readonly displayWidgetOrder = HOME_DASHBOARD_LAYOUT.map((item) => item.id);

  readonly topHoldings = computed(() => {
    const metrics = this.metrics();
    if (!metrics) return [];

    const total = metrics.totalPortfolioValue;
    return metrics.holdings
      .slice()
      .sort((a, b) => b.assetValue - a.assetValue)
      .slice(0, 5)
      .map((item) => ({
        ...item,
        allocationPercent: total > 0 ? (item.assetValue / total) * 100 : 0,
      }));
  });

  readonly allocationChart = computed<ChartData<'doughnut'>>(() => {
    const allocation = this.portfolio.allocationByTicker();
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    return {
      labels: allocation.map((a) => a.ticker),
      datasets: [
        {
          data: allocation.map((a) => a.value),
          backgroundColor: allocation.map((_, i) => colors[i % colors.length]),
          borderWidth: 0,
        },
      ],
    };
  });

  readonly portfolioGrowthChart = computed<ChartData<'line'>>(() => {
    const snapshots = this.snapshots();
    return {
      labels: snapshots.map((s) => s.date),
      datasets: [
        {
          label: 'Portfolio Value',
          data: snapshots.map((s) => s.totalValue),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    };
  });

  readonly portfolioGrowthOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) =>
            `$${(ctx.parsed.y ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value: string | number) =>
            `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        },
      },
    },
    maintainAspectRatio: false,
  };

  readonly sortedSchedules = computed(() =>
    [...this.schedules()].sort((a, b) => a.payDate.localeCompare(b.payDate)).slice(0, 8),
  );

  readonly nextMilestones = computed(() =>
    this.milestones()
      .filter((m) => !m.achieved)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3),
  );

  readonly allocationOptions = computed<ChartConfiguration<'doughnut'>['options']>(() => ({
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 16,
          color: this.theme.theme() === 'dark' ? '#94a3b8' : '#64748b',
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label?: string; parsed: number }) =>
            `${ctx.label}: $${ctx.parsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
    },
  }));

  ngOnInit(): void {
    void this.portfolio.init().then(() => this.syncFireInputs());
    void this.portfolio.ensureProjectionsLoaded();
  }

  ngOnDestroy(): void {
    if (this.saveLayoutTimer) {
      clearTimeout(this.saveLayoutTimer);
    }
    if (this.fireTargetSaveTimer) {
      clearTimeout(this.fireTargetSaveTimer);
    }
    if (this.withdrawalSaveTimer) {
      clearTimeout(this.withdrawalSaveTimer);
    }
  }

  onFreedomTargetChange(): void {
    if (this.fireTargetSaveTimer) {
      clearTimeout(this.fireTargetSaveTimer);
    }

    this.fireTargetSaveTimer = setTimeout(() => {
      void this.saveFreedomTarget();
    }, 800);
  }

  async saveFreedomTarget(): Promise<void> {
    await this.portfolio.updateFreedomTarget(this.freedomTarget);
    this.feedback.persisted('fire-target', 'Saved to local storage', false);
    this.syncFireInputs();
  }

  onWithdrawalRateChange(): void {
    if (this.withdrawalSaveTimer) {
      clearTimeout(this.withdrawalSaveTimer);
    }

    this.withdrawalSaveTimer = setTimeout(() => {
      void this.saveWithdrawalRate();
    }, 800);
  }

  async saveWithdrawalRate(): Promise<void> {
    await this.portfolio.updateWithdrawalRate(this.withdrawalRate);
    this.feedback.persisted('fire-withdrawal', 'Saved to local storage', false);
    this.syncFireInputs();
  }

  private syncFireInputs(): void {
    this.freedomTarget = Math.round(this.freedomNumber());
    this.withdrawalRate = this.settings().withdrawalRatePercent;
  }

  toggleCustomizeMode(): void {
    const next = !this.customizeMode();
    this.customizeMode.set(next);
    this.gridOptions.set(this.buildGridOptions(next));
  }

  resetLayout(): void {
    this.layoutService.resetLayout(HOME_DASHBOARD_ID);
    this.layout.set(HOME_DASHBOARD_LAYOUT.map((item) => ({ ...item })));
    this.gridOptions.set(this.buildGridOptions(this.customizeMode()));
  }

  onLayoutChange(): void {
    this.layout.update((items) => [...items]);

    if (this.saveLayoutTimer) {
      clearTimeout(this.saveLayoutTimer);
    }

    this.saveLayoutTimer = setTimeout(() => {
      this.layoutService.saveLayout(HOME_DASHBOARD_ID, this.layout());
    }, 300);
  }

  openQuickAdd(ticker = ''): void {
    this.quickAdd.show(ticker);
  }

  async refresh(): Promise<void> {
    await this.portfolio.refreshMarketData();
  }

  payoutAmount(ticker: string, amountPerShare: number): number {
    const holding = this.holdings().find((h) => h.ticker === ticker);
    return (holding?.shares ?? 0) * amountPerShare;
  }

  widgetLabel(id: DashboardWidgetLayout['id']): string {
    const labels: Record<DashboardWidgetLayout['id'], string> = {
      'income-goal': 'Financial Independence',
      'portfolio-growth': 'Portfolio Growth',
      'dividend-calendar': 'Dividend Calendar',
      'asset-allocation': 'Asset Allocation',
      'top-holdings': 'Top Holdings',
      milestones: 'Milestones',
      alerts: 'Portfolio Alerts',
      explore: 'Explore',
    };
    return labels[id];
  }

  private buildGridOptions(editing: boolean): GridsterConfig {
    return {
      gridType: GridType.ScrollVertical,
      displayGrid: editing ? DisplayGrid.Always : DisplayGrid.None,
      compactType: CompactType.None,
      margin: 12,
      outerMargin: false,
      minCols: 12,
      maxCols: 12,
      minRows: 1,
      fixedRowHeight: 88,
      mobileBreakpoint: 768,
      pushItems: true,
      disableWarnings: true,
      draggable: {
        enabled: editing,
        dragHandleClass: 'widget-drag-handle',
        ignoreContentClass: 'widget-content',
      },
      resizable: {
        enabled: editing,
      },
      itemChangeCallback: () => this.onLayoutChange(),
      itemResizeCallback: () => this.onLayoutChange(),
    };
  }
}
