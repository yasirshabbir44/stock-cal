import { Component, Input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [DecimalPipe, CurrencyPipe],
  template: `
    <article class="metric-card" [class.positive]="positive" [class.negative]="negative">
      <p class="metric-label">{{ label }}</p>
      <p class="metric-value">
        @if (isPercent) {
          {{ value | number: '1.2-2' }}%
        } @else if (isCurrency) {
          {{ value | currency: 'USD' : 'symbol' : '1.2-2' }}
        } @else {
          {{ value | number: '1.0-2' }}
        }
      </p>
      @if (subtitle) {
        <p class="metric-subtitle">{{ subtitle }}</p>
      }
    </article>
  `,
  styles: [
    `
      .metric-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 1.25rem;
      }

      .metric-label {
        margin: 0 0 0.5rem;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .metric-value {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.2;
        word-break: break-word;
      }

      .metric-subtitle {
        margin: 0.5rem 0 0;
        font-size: 0.875rem;
        color: var(--text-muted);
      }

      .positive .metric-value {
        color: var(--success);
      }

      .negative .metric-value {
        color: var(--danger);
      }

      @media (max-width: 768px) {
        .metric-card {
          padding: 1rem;
        }

        .metric-value {
          font-size: 1.375rem;
        }

        .metric-label {
          font-size: 0.75rem;
        }
      }
    `,
  ],
})
export class MetricCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: number;
  @Input() subtitle = '';
  @Input() isCurrency = false;
  @Input() isPercent = false;
  @Input() positive = false;
  @Input() negative = false;
}
