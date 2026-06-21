import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChartData } from 'chart.js';
import { METRIC_FORMULAS } from '../../core/constants/metric-formulas';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { MetricCardComponent } from '../../shared/components/metric-card.component';
import { ChartComponent } from '../../shared/components/chart.component';

@Component({
  selector: 'app-plan-dashboard',
  standalone: true,
  imports: [FormsModule, MetricCardComponent, ChartComponent, RouterLink, CurrencyPipe, DecimalPipe],
  templateUrl: './plan-dashboard.component.html',
  styleUrl: './plan-dashboard.component.scss',
})
export class PlanDashboardComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);

  readonly formulas = METRIC_FORMULAS;
  readonly metrics = this.portfolio.metrics;
  readonly settings = this.portfolio.settings;
  readonly incomeGoalProgress = this.portfolio.incomeGoalProgress;

  readonly monthlyContribution = signal(500);
  readonly dividendGrowthRate = signal(5);
  readonly portfolioGrowthRate = signal(7);
  readonly withdrawalRate = signal(4);
  readonly projectionYears = signal(20);

  readonly firePlan = computed(() =>
    this.portfolio.computeFirePlan(
      this.monthlyContribution(),
      this.dividendGrowthRate(),
      this.portfolioGrowthRate(),
      this.withdrawalRate(),
    ),
  );

  readonly fireProjection = computed(() =>
    this.portfolio.projectFirePath(
      this.monthlyContribution(),
      this.dividendGrowthRate(),
      this.portfolioGrowthRate(),
      this.projectionYears(),
    ),
  );

  readonly incomeChart = computed<ChartData<'line'>>(() => {
    const projection = this.fireProjection();
    return {
      labels: projection.map((p) => String(p.year)),
      datasets: [
        {
          label: 'Projected Monthly Income',
          data: projection.map((p) => p.monthlyIncome),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
        {
          label: 'Income Goal',
          data: projection.map(() => this.settings().monthlyIncomeGoal),
          borderColor: '#f59e0b',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  });

  readonly wealthChart = computed<ChartData<'line'>>(() => {
    const projection = this.fireProjection();
    return {
      labels: projection.map((p) => String(p.year)),
      datasets: [
        {
          label: 'Projected Portfolio Value',
          data: projection.map((p) => p.portfolioValue),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
        {
          label: 'Freedom Number',
          data: projection.map(() => this.firePlan().freedomNumber),
          borderColor: '#8b5cf6',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  });

  readonly chartOptions = {
    layout: {
      padding: { bottom: 4 },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { padding: 14, boxWidth: 12, usePointStyle: true, pointStyle: 'line' as const },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: $${(ctx.parsed.y ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 10,
          autoSkip: true,
          maxRotation: 0,
          minRotation: 0,
        },
      },
      y: {
        ticks: {
          callback: (value: string | number) =>
            `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        },
      },
    },
  };

  ngOnInit(): void {
    void this.portfolio.init();
    void this.portfolio.ensureProjectionsLoaded();
  }

  yearsToGoalLabel(): string {
    const years = this.firePlan().yearsToGoal;
    if (years === null) {
      return 'Beyond projection — adjust assumptions';
    }
    if (years === 0) {
      return 'Goal reached!';
    }
    return `${years} year${years === 1 ? '' : 's'} to income goal`;
  }

  yearsToGoalDisplay(): string {
    const years = this.firePlan().yearsToGoal;
    if (years === null) {
      return '50+';
    }
    if (years === 0) {
      return '0';
    }
    return String(years);
  }

  incomeGoalSubtitle(): string {
    return `${this.incomeGoalProgress().toFixed(0)}% of goal`;
  }

  freedomProgressSubtitle(): string {
    const plan = this.firePlan();
    const metrics = this.metrics();
    if (!metrics || plan.freedomNumber <= 0) {
      return 'Set a withdrawal rate to calculate';
    }
    const pct = (metrics.totalPortfolioValue / plan.freedomNumber) * 100;
    return `${pct.toFixed(0)}% of freedom number`;
  }

  goalStatusClass(monthlyIncome: number): string {
    const goal = this.settings().monthlyIncomeGoal;
    if (goal <= 0) {
      return 'pending';
    }
    const ratio = monthlyIncome / goal;
    if (ratio >= 0.75) {
      return 'close';
    }
    if (ratio >= 0.4) {
      return 'approaching';
    }
    return 'pending';
  }
}
