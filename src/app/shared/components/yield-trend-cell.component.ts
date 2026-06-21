import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { getYieldTrend, yieldTrendTitle, YieldTrend } from '../../core/calculations/dividend-yield.lib';

@Component({
  selector: 'app-yield-trend-cell',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <span
      class="yield-trend-cell"
      [class.yield-up]="trend === 'up'"
      [class.yield-down]="trend === 'down'"
      [attr.title]="tooltip"
    >
      @if (trend === 'up') {
        <span class="yield-arrow" aria-hidden="true">↑</span>
      } @else if (trend === 'down') {
        <span class="yield-arrow" aria-hidden="true">↓</span>
      }
      <span class="yield-value">{{ value | number: decimals }}%</span>
    </span>
  `,
  styles: [
    `
      .yield-trend-cell {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.125rem 0.375rem;
        border-radius: var(--radius-sm);
        line-height: 1.2;
      }

      .yield-up {
        background: var(--accent-income-muted);
        color: var(--success);
      }

      .yield-down {
        background: rgba(248, 113, 113, 0.1);
        color: var(--danger);
      }

      .yield-arrow {
        font-size: 0.6875rem;
        font-weight: 700;
        line-height: 1;
      }

      .yield-value {
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
export class YieldTrendCellComponent {
  @Input({ required: true }) value!: number;
  @Input() previousValue?: number;
  @Input() decimals = '1.2-2';

  get trend(): YieldTrend | null {
    return getYieldTrend(this.value, this.previousValue);
  }

  get tooltip(): string | null {
    return yieldTrendTitle(this.value, this.previousValue);
  }
}
