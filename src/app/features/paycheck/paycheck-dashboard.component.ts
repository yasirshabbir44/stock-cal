import { Component, computed, inject, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChartData } from 'chart.js';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { MetricCardComponent } from '../../shared/components/metric-card.component';
import { ChartComponent } from '../../shared/components/chart.component';

@Component({
  selector: 'app-paycheck-dashboard',
  standalone: true,
  imports: [MetricCardComponent, ChartComponent, CurrencyPipe, DecimalPipe, DatePipe],
  templateUrl: './paycheck-dashboard.component.html',
  styleUrl: './paycheck-dashboard.component.scss',
})
export class PaycheckDashboardComponent implements OnInit {
  private readonly portfolio = inject(PortfolioFacadeService);

  readonly metrics = this.portfolio.metrics;
  readonly schedules = this.portfolio.dividendSchedules;
  readonly settings = this.portfolio.settings;
  readonly incomeGoalProgress = this.portfolio.incomeGoalProgress;
  readonly loading = this.portfolio.loading;

  readonly monthlyTotals = computed(() => this.portfolio.monthlyDividendTotals());

  readonly chartData = computed<ChartData<'bar'>>(() => {
    const totals = this.monthlyTotals();
    const labels = [...totals.keys()].map((key) => {
      const [year, month] = key.split('-');
      return new Date(Number(year), Number(month) - 1).toLocaleDateString(undefined, {
        month: 'short',
        year: '2-digit',
      });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Projected Dividends',
          data: [...totals.values()],
          backgroundColor: '#10b981',
          borderRadius: 6,
        },
      ],
    };
  });

  readonly chartOptions = {
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
          callback: (value: string | number) => `$${Number(value).toFixed(0)}`,
        },
      },
    },
  };

  readonly averageYieldOnCost = computed(() => {
    const m = this.metrics();
    if (!m || m.holdings.length === 0) {
      return 0;
    }
    const total = m.holdings.reduce((sum, h) => sum + h.yieldOnCostPercent, 0);
    return total / m.holdings.length;
  });

  ngOnInit(): void {
    void this.portfolio.init();
  }

  payoutAmount(ticker: string, amountPerShare: number): number {
    const holding = this.portfolio.holdings().find((h) => h.ticker === ticker);
    return (holding?.shares ?? 0) * amountPerShare;
  }
}
