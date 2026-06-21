import { CurrencyPipe } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DEMO_PORTFOLIO,
  estimateDemoPortfolioCost,
} from '../../core/constants/demo-portfolio';
import { PortfolioFacadeService } from '../../core/services/portfolio-facade.service';
import { StockIconComponent } from './stock-icon.component';

@Component({
  selector: 'app-get-started-guide',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, StockIconComponent],
  template: `
    <div class="get-started-guide" [class.compact]="compact()">
      @if (!compact()) {
        <ol class="guide-steps">
          <li>
            <span class="step-num">1</span>
            <div>
              <strong>Load the demo portfolio</strong>
              <span>Pre-filled positions with realistic cost basis — no typing required.</span>
            </div>
          </li>
          <li>
            <span class="step-num">2</span>
            <div>
              <strong>Explore every dashboard</strong>
              <span>Wealth, paycheck, insights, and FIRE planning light up instantly.</span>
            </div>
          </li>
          <li>
            <span class="step-num">3</span>
            <div>
              <strong>Make it yours</strong>
              <span>Edit holdings, clear data anytime, or add your real positions.</span>
            </div>
          </li>
        </ol>
      }

      <div class="demo-card">
        <div class="demo-card-header">
          <div>
            <h3>{{ demo.name }}</h3>
            <p>{{ demo.description }}</p>
          </div>
          <span class="demo-badge">{{ demo.holdings.length }} holdings</span>
        </div>

        <div class="demo-table-wrap">
          <table class="demo-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th class="col-num">Shares</th>
                <th class="col-num">Cost</th>
              </tr>
            </thead>
            <tbody>
              @for (holding of demo.holdings; track holding.ticker) {
                <tr>
                  <td>
                    <span class="ticker-cell">
                      <app-stock-icon [symbol]="holding.ticker" size="sm" />
                      <span class="ticker">{{ holding.ticker }}</span>
                    </span>
                  </td>
                  <td class="col-num">{{ holding.shares }}</td>
                  <td class="col-num">{{ holding.purchasePrice | currency: 'USD' : 'symbol' : '1.2-2' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (demo.watchlist.length > 0) {
          <div class="demo-watchlist">
            <span class="demo-watchlist-label">Also includes watchlist:</span>
            @for (item of demo.watchlist; track item.ticker) {
              <span class="watchlist-chip">
                <app-stock-icon [symbol]="item.ticker" size="sm" />
                {{ item.ticker }}
              </span>
            }
          </div>
        }

        <div class="demo-footer">
          <span class="demo-cost">
            ~{{ estimatedCost | currency: 'USD' : 'symbol' : '1.0-0' }} sample cost basis
          </span>
          <div class="demo-actions">
            <button
              type="button"
              class="btn-primary"
              [disabled]="loading()"
              (click)="loadDemo()"
            >
              @if (loading()) {
                Loading…
              } @else {
                Load Demo Portfolio
              }
            </button>
            @if (showManualAdd()) {
              <button type="button" class="btn-secondary" (click)="addManually.emit()">
                Add Manually
              </button>
            } @else {
              <a routerLink="/holdings" class="btn-secondary link-btn">Add Manually</a>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .get-started-guide {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      text-align: left;
    }

    .guide-steps {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.875rem;
    }

    @media (max-width: 768px) {
      .guide-steps {
        grid-template-columns: 1fr;
      }
    }

    .guide-steps li {
      display: flex;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--surface-muted);
      border: 1px solid var(--border);
      border-radius: 10px;
    }

    .step-num {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 50%;
      background: var(--accent-wealth-muted);
      color: var(--accent-wealth);
      font-size: 0.8125rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .guide-steps strong {
      display: block;
      font-size: 0.875rem;
      margin-bottom: 0.125rem;
    }

    .guide-steps span {
      font-size: 0.8125rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .demo-card {
      padding: 1.25rem;
      background: var(--surface-muted);
      border: 1px solid var(--border);
      border-radius: 12px;
    }

    .demo-card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .demo-card-header h3 {
      margin: 0 0 0.25rem;
      font-size: 1rem;
      font-weight: 600;
    }

    .demo-card-header p {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--text-muted);
      line-height: 1.5;
      max-width: 36rem;
    }

    .demo-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      background: var(--accent-income-muted);
      color: var(--accent-income);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .demo-table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
    }

    .demo-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .demo-table th,
    .demo-table td {
      padding: 0.5625rem 0.75rem;
      border-bottom: 1px solid var(--border);
    }

    .demo-table th {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      text-align: left;
    }

    .demo-table tbody tr:last-child td {
      border-bottom: none;
    }

    .col-num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .ticker-cell {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .ticker {
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .demo-watchlist {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.875rem;
    }

    .demo-watchlist-label {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .watchlist-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--border);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .demo-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1.125rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }

    .demo-cost {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .demo-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .get-started-guide.compact .demo-card {
      padding: 1rem;
    }

    .get-started-guide.compact .demo-card-header {
      flex-direction: column;
      gap: 0.5rem;
    }

    .get-started-guide.compact .demo-footer {
      flex-direction: column;
      align-items: stretch;
    }

    .get-started-guide.compact .demo-actions {
      flex-direction: column;
    }

    .get-started-guide.compact .demo-actions .btn-primary,
    .get-started-guide.compact .demo-actions .btn-secondary {
      width: 100%;
      justify-content: center;
    }
  `,
})
export class GetStartedGuideComponent {
  private readonly portfolio = inject(PortfolioFacadeService);

  readonly compact = input(false);
  readonly showManualAdd = input(false);

  readonly addManually = output<void>();
  readonly demoLoaded = output<void>();

  readonly demo = DEMO_PORTFOLIO;
  readonly estimatedCost = estimateDemoPortfolioCost();
  readonly loading = this.portfolio.loading;

  async loadDemo(): Promise<void> {
    const loaded = await this.portfolio.loadDemoPortfolio();
    if (loaded) {
      this.demoLoaded.emit();
    }
  }
}
